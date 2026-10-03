// background/service-worker.js
// Production Background Service Worker & Automation State Machine for PromptFlow

import storage, { AUTOMATION_STATE, PROMPT_STATUS, createInitialSession, createQueueItem, resolveImageFilename } from '../utils/storage.js';
import { Downloader } from '../utils/downloader.js';
import logger from '../utils/logger.js';

class AutomationEngine {
  constructor() {
    this.isRunning = false;
    this.isPaused = false;
    this.stopRequested = false;
    this.activeTabId = null;
    this.executionId = 0;
  }

  /**
   * Broadcasts the current session state to popup and any active views
   */
  async broadcastState(session) {
    try {
      await chrome.runtime.sendMessage({
        type: 'STATE_CHANGED',
        session
      });
    } catch (e) {
      // Popup might be closed; this is normal
    }

    // Always sync state with in-page floating HUD on ChatGPT so UI stays visible on page
    if (this.activeTabId) {
      try {
        await chrome.tabs.sendMessage(this.activeTabId, {
          type: 'SYNC_SESSION_OVERLAY',
          session
        });
      } catch (e) {
        // Tab might be loading or closed
      }
    }
  }

  /**
   * Transition state helper
   */
  async setState(state, statusMessage = '', extra = {}, runId = null) {
    if (runId && this.executionId !== runId) return null;
    const updates = { state, statusMessage, ...extra };
    const session = await storage.updateSession(updates);
    logger.info(`[State -> ${state}] ${statusMessage}`);
    await this.broadcastState(session);
    return session;
  }

  /**
   * Updates a single prompt in the active session
   */
  async updatePrompt(index, updates, runId = null) {
    if (runId && this.executionId !== runId) return null;
    const session = await storage.getSession();
    if (session.prompts && session.prompts[index]) {
      session.prompts[index] = { ...session.prompts[index], ...updates };
      await storage.saveSession(session);
      await this.broadcastState(session);
    }
    return session;
  }

  /**
   * Finds an existing ChatGPT tab or opens a new one
   */
  async getOrOpenChatGPTTab() {
    logger.info('Searching for active ChatGPT tab...');

    // 1. If currently on a ChatGPT tab in the active window, stay on it without changing tabs
    try {
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (currentTab && currentTab.url && (currentTab.url.includes('chatgpt.com') || currentTab.url.includes('chat.openai.com'))) {
        this.activeTabId = currentTab.id;
        logger.success(`Operating in current active ChatGPT tab (ID: ${this.activeTabId}) without changing tabs`);
        return currentTab;
      }
    } catch (e) {}

    const tabs = await chrome.tabs.query({
      url: ['https://chatgpt.com/*', 'https://chat.openai.com/*']
    });

    if (tabs.length > 0) {
      // Prefer active tab in current or any window
      const activeTab = tabs.find((t) => t.active) || tabs[0];
      await chrome.tabs.update(activeTab.id, { active: true });
      if (activeTab.windowId) {
        await chrome.windows.update(activeTab.windowId, { focused: true });
      }
      this.activeTabId = activeTab.id;
      try {
        await chrome.tabs.update(this.activeTabId, { autoDiscardable: false });
      } catch (e) {}
      logger.success(`Using existing ChatGPT tab (ID: ${this.activeTabId})`);
      return activeTab;
    }

    logger.info('Opening new ChatGPT tab...');
    const newTab = await chrome.tabs.create({
      url: 'https://chatgpt.com/',
      active: true
    });
    this.activeTabId = newTab.id;

    // Wait until tab finishes loading
    await new Promise((resolve) => {
      const listener = (tabId, info) => {
        if (tabId === newTab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
      // Timeout fallback
      setTimeout(resolve, 20000);
    });

    return newTab;
  }

  /**
   * Ensures content script is injected and ready to respond
   */
  async ensureContentScriptReady(tabId, maxRetries = 10) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const res = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
        if (res && res.success) {
          logger.info('ChatGPT content script responded to PING');
          return res;
        }
      } catch (e) {
        logger.debug(`Content script not ready yet, retry ${i + 1}/${maxRetries}...`);
        // If tab was already loaded before extension installed, inject programmatically
        if (i === 2) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId },
              files: ['content/chatgpt.js']
            });
            await chrome.scripting.insertCSS({
              target: { tabId },
              files: ['content/chatgpt.css']
            });
          } catch (injectErr) {
            logger.warn('Script injection attempt note:', injectErr.message);
          }
        }
      }
      await new Promise((r) => setTimeout(r, 1200));
    }
    throw new Error('Could not establish connection with ChatGPT tab. Please ensure page is loaded.');
  }

  /**
   * Main automation entry point
   */
  async startAutomation() {
    if (this.isRunning) {
      logger.warn('Automation is already running');
      return;
    }

    const currentRunId = ++this.executionId;
    this.isRunning = true;
    this.isPaused = false;
    this.stopRequested = false;

    let session = await storage.getSession();
    const settings = await storage.getSettings();

    try {
      // 1. Validate inputs & initialize queue
      if ((!session.queue || session.queue.length === 0) && !session.referenceImage) {
        throw new Error('Please upload at least one reference image before starting.');
      }

      if (!Array.isArray(session.queue) || session.queue.length === 0) {
        session.queue = [createQueueItem(session.referenceImage, 0, settings)];
        session.prompts = session.queue[0].prompts;
      }

      session.startedAt = Date.now();
      session.completedAt = null;
      session.error = null;
      await storage.saveSession(session);

      await this.setState(AUTOMATION_STATE.PREPARING, 'Preparing session & queue...', {}, currentRunId);

      // 2. Open / Activate ChatGPT tab
      await this.setState(AUTOMATION_STATE.OPENING_CHATGPT, 'Locating or opening ChatGPT tab...', {}, currentRunId);
      const tab = await this.getOrOpenChatGPTTab();
      session.tabId = tab.id;
      await storage.saveSession(session);

      // 3. Verify content script & authentication
      await this.setState(AUTOMATION_STATE.CHECKING_CHATGPT, 'Checking ChatGPT status & authentication...', {}, currentRunId);
      const statusRes = await this.ensureContentScriptReady(tab.id);

      if (!statusRes.authenticated) {
        throw new Error('Please log in to your ChatGPT account first and keep the tab open.');
      }

      logger.success('ChatGPT authentication & composer confirmed ready');

      // 4. Process each item in the Queue
      for (let qIdx = 0; qIdx < session.queue.length; qIdx++) {
        session = await storage.getSession();
        if (this.executionId !== currentRunId || this.stopRequested) break;

        const queueItem = session.queue[qIdx];
        if (queueItem.status === 'completed') {
          logger.info(`Queue item ${qIdx + 1} (${queueItem.name}) already completed. Skipping.`);
          continue;
        }

        session.currentQueueIndex = qIdx;
        session.referenceImage = queueItem.referenceImage;
        session.referenceUploaded = false; // Fresh upload required for each queue item!
        session.baseFilename = queueItem.baseFilename || `design_${qIdx + 1}`;
        session.prompts = queueItem.prompts || session.prompts;
        queueItem.status = 'in_progress';
        await storage.saveSession(session);
        await this.broadcastState(session);

        logger.info(`=== STARTING QUEUE ITEM ${qIdx + 1} / ${session.queue.length}: ${queueItem.name} ===`);

        // All queue items execute sequentially inside ONE continuous chat!
        if (qIdx > 0) {
          logger.info(`Continuing in same continuous chat for Design ${qIdx + 1} of ${session.queue.length}`);
          await new Promise((r) => setTimeout(r, 1200));
        }

        const enabledPrompts = session.prompts.filter((p) => p.enabled && p.text.trim().length > 0);

        // Execute prompt sequence for this queue item
        for (let i = 0; i < session.prompts.length; i++) {
          session = await storage.getSession();

          if (this.executionId !== currentRunId || this.stopRequested) {
            if (this.executionId === currentRunId) {
              await this.setState(AUTOMATION_STATE.STOPPED, `Automation stopped. Completed: ${this.getCompletedCount(session)} / ${enabledPrompts.length}`, {}, currentRunId);
            }
            break;
          }

          while (this.isPaused) {
            await this.setState(AUTOMATION_STATE.PAUSED, 'Automation paused by user.', {}, currentRunId);
            await new Promise((r) => setTimeout(r, 1000));
            if (this.stopRequested || this.executionId !== currentRunId) break;
          }
          if (this.stopRequested || this.executionId !== currentRunId) break;

          const prompt = session.prompts[i];
          if (!prompt.enabled || !prompt.text.trim()) {
            if (prompt.status !== PROMPT_STATUS.COMPLETED) {
              await this.updatePrompt(i, { status: PROMPT_STATUS.SKIPPED }, currentRunId);
            }
            continue;
          }

          if (prompt.status === PROMPT_STATUS.COMPLETED) {
            continue;
          }

          session.currentPromptIndex = i;
          await storage.saveSession(session);

          logger.info(`Design ${qIdx + 1}/${session.queue.length} -> Prompt ${i + 1}/${session.prompts.length}: ${prompt.title}`);

          let promptSubmitted = false;
          let promptSuccess = false;
          let attempt = 0;
          const maxPromptRetries = 3; // Up to 3 resilient attempts so middle prompts are never skipped

          while (!promptSuccess && attempt < maxPromptRetries) {
            attempt++;
            if (this.executionId !== currentRunId || this.stopRequested) break;

            try {
              // Upload Reference Image (only once for this queue item's chat!)
              if (!session.referenceUploaded) {
                await this.setState(
                  AUTOMATION_STATE.UPLOADING_REFERENCE,
                  `Uploading reference for Design ${qIdx + 1} (${queueItem.name})...`,
                  {},
                  currentRunId
                );
                await this.updatePrompt(i, {
                  status: PROMPT_STATUS.UPLOADING,
                  startedAt: Date.now(),
                  error: null
                }, currentRunId);

                const uploadRes = await chrome.tabs.sendMessage(tab.id, {
                  type: 'PREPARE_REFERENCE_UPLOAD',
                  fileData: queueItem.referenceImage
                });

                if (!uploadRes || !uploadRes.success) {
                  throw new Error(uploadRes?.error || 'Failed to attach reference image to ChatGPT composer');
                }

                session.referenceUploaded = true;
                await storage.saveSession(session);
                logger.success(`Reference image uploaded for Design ${qIdx + 1}`);
                await new Promise((r) => setTimeout(r, 1500));
              }

              if (this.executionId !== currentRunId || this.stopRequested) break;

              // Send Prompt ONLY if not yet dispatched to ChatGPT!
              if (!promptSubmitted) {
                // Pre-prompt Image Snapshot
                logger.info(`Taking pre-prompt DOM snapshot for Prompt ${i + 1}...`);
                await chrome.tabs.sendMessage(tab.id, { type: 'TAKE_IMAGE_SNAPSHOT' });

                await this.setState(
                  AUTOMATION_STATE.SENDING_PROMPT,
                  `[Design ${qIdx + 1}/${session.queue.length}] Sending Prompt ${i + 1}: ${prompt.title}...`,
                  {},
                  currentRunId
                );
                const submitRes = await chrome.tabs.sendMessage(tab.id, {
                  type: 'SUBMIT_PROMPT',
                  promptIndex: i + 1,
                  promptText: prompt.text
                });

                if (!submitRes || !submitRes.success) {
                  throw new Error(submitRes?.error || 'Failed to submit prompt text');
                }

                promptSubmitted = true;
                logger.info(`Prompt ${i + 1} dispatched successfully to ChatGPT.`);
              }

              if (this.executionId !== currentRunId || this.stopRequested) break;

              if (prompt.skipDownload || prompt.isTextOnly || i === 6) {
                // Text-only prompt (e.g. Prompt 7: Flipkart Catalog Specialist JSON)
                await this.setState(
                  AUTOMATION_STATE.WAITING_FOR_GENERATION,
                  `[Design ${qIdx + 1}/${session.queue.length}] Generating Catalog JSON for Prompt ${i + 1}...`,
                  {},
                  currentRunId
                );
                await this.updatePrompt(i, { status: PROMPT_STATUS.GENERATING }, currentRunId);

                const textRes = await chrome.tabs.sendMessage(tab.id, {
                  type: 'WAIT_FOR_TEXT_RESPONSE',
                  promptIndex: i + 1,
                  timeoutMinutes: Math.min(settings.generationTimeoutMinutes || 5, 8)
                });

                if (this.executionId !== currentRunId || this.stopRequested) break;

                if (!textRes || !textRes.success) {
                  throw new Error(textRes?.error || 'Catalog text generation failed or timed out');
                }

                const generatedText = textRes.text || '';
                logger.success(`Catalog JSON received for Prompt ${i + 1} (${generatedText.length} chars)`);

                // Mark prompt complete and store response text - DO NOT DOWNLOAD RESULT
                await this.updatePrompt(i, {
                  status: PROMPT_STATUS.COMPLETED,
                  imageUrl: null,
                  textResponse: generatedText,
                  completedAt: Date.now(),
                  error: null
                }, currentRunId);

                promptSuccess = true;
                logger.success(`Prompt ${i + 1} (Catalog JSON) generated successfully (download skipped)!`);
              } else {
                // Fast Wait and Detect Generated Image directly (Prompts 1-6)
                await this.setState(
                  AUTOMATION_STATE.WAITING_FOR_GENERATION,
                  `[Design ${qIdx + 1}/${session.queue.length}] Generating image for Prompt ${i + 1}...`,
                  {},
                  currentRunId
                );
                await this.updatePrompt(i, { status: PROMPT_STATUS.GENERATING }, currentRunId);

                const genRes = await chrome.tabs.sendMessage(tab.id, {
                  type: 'WAIT_AND_DETECT_IMAGE',
                  promptIndex: i + 1,
                  timeoutMinutes: Math.min(settings.generationTimeoutMinutes || 5, 8)
                });

                if (this.executionId !== currentRunId || this.stopRequested) break;

                if (!genRes || !genRes.success || !genRes.imageUrl) {
                  throw new Error(genRes?.error || 'Image generation failed or timed out');
                }

                const generatedUrl = genRes.imageUrl;
                logger.success(`Image detected for Prompt ${i + 1}: ${generatedUrl.slice(0, 60)}...`);

                // Mark prompt complete and store image URL
                await this.updatePrompt(i, {
                  status: PROMPT_STATUS.COMPLETED,
                  imageUrl: generatedUrl,
                  completedAt: Date.now(),
                  error: null
                }, currentRunId);

                promptSuccess = true;
                logger.success(`Prompt ${i + 1} generated successfully!`);
              }

            } catch (promptErr) {
              if (this.executionId !== currentRunId || this.stopRequested) break;
              logger.error(`Prompt ${i + 1} attempt ${attempt} error: ${promptErr.message}`);
              if (attempt >= maxPromptRetries) {
                await this.updatePrompt(i, {
                  status: PROMPT_STATUS.FAILED,
                  error: promptErr.message
                }, currentRunId);
                logger.error(`Prompt ${i + 1} marked as failed.`);
              } else {
                await new Promise((r) => setTimeout(r, 2000));
              }
            }
          }

          // Delay before next prompt: allow ChatGPT to fully clear image generation state
          if (i < session.prompts.length - 1 && !this.stopRequested && this.executionId === currentRunId) {
            const delaySec = Math.max(settings.delayBetweenPromptsSeconds || 4, 3);
            await this.setState(
              AUTOMATION_STATE.NEXT_PROMPT,
              `Waiting ${delaySec}s before next prompt...`,
              {},
              currentRunId
            );
            await new Promise((r) => setTimeout(r, delaySec * 1000));
          }
        }

        if (this.executionId !== currentRunId || this.stopRequested) break;

        // Finalize this queue item
        session = await storage.getSession();
        queueItem.status = 'completed';
        queueItem.prompts = session.prompts;
        const itemCompleted = session.prompts.filter(p => p.status === PROMPT_STATUS.COMPLETED && p.imageUrl);
        queueItem.completedCount = itemCompleted.length;



        session.queue[qIdx] = queueItem;
        await storage.saveSession(session);
        await this.broadcastState(session);
      }

      // 5. Finalize Session & Auto-Download All Images from All Designs in a Single Final ZIP
      if (!this.stopRequested && this.executionId === currentRunId) {
        session = await storage.getSession();
        const totalCompletedQueue = (session.queue || []).filter(q => q.status === 'completed').length;
        const totalQueue = session.queue.length;

        // Collect all completed images from all queue items
        const allCompletedImages = [];
        for (let q = 0; q < session.queue.length; q++) {
          const qItem = session.queue[q];
          const designIndex = q + 1;
          const customName = qItem.customName || '';
          const completedPrompts = (qItem.prompts || []).filter(
            (p) => p.status === PROMPT_STATUS.COMPLETED && p.imageUrl
          );

          for (let p = 0; p < completedPrompts.length; p++) {
            const promptItem = completedPrompts[p];
            const promptIndex = promptItem.id || (p + 1);
            // Option to name images: name_x if provided, or image_x_x if not provided
            const filename = resolveImageFilename(customName, designIndex, promptIndex, 'png');

            try {
              const bytes = await Downloader.fetchImageBytes(promptItem.imageUrl, tab.id);
              allCompletedImages.push({ name: filename, data: bytes });
            } catch (bErr) {
              logger.error(`Could not fetch bytes for ${filename}: ${bErr.message}`);
            }
          }
        }

        // If queue was empty but single design was run directly via session.prompts
        if (session.queue.length === 0 && session.prompts) {
          const customName = (session.baseFilename || '').trim();
          const completedPrompts = (session.prompts || []).filter(
            (p) => p.status === PROMPT_STATUS.COMPLETED && p.imageUrl
          );
          for (let p = 0; p < completedPrompts.length; p++) {
            const promptItem = completedPrompts[p];
            const promptIndex = promptItem.id || (p + 1);
            const filename = resolveImageFilename(customName, 1, promptIndex, 'png');
            try {
              const bytes = await Downloader.fetchImageBytes(promptItem.imageUrl, tab.id);
              allCompletedImages.push({ name: filename, data: bytes });
            } catch (bErr) {
              logger.error(`Could not fetch bytes for ${filename}: ${bErr.message}`);
            }
          }
        }

        // Automatically download every image ONE TIME in a single consolidated ZIP
        if (allCompletedImages.length > 0) {
          try {
            await this.setState(
              AUTOMATION_STATE.DOWNLOADING_IMAGE,
              `Packaging all ${allCompletedImages.length} images into 1 single final ZIP archive...`,
              {},
              currentRunId
            );
            const baseFolder = (settings.downloadFolder || 'PromptFlow').trim().replace(/^[/\\]+|[/\\]+$/g, '');
            const globalBase = (session.baseFilename || '').trim();
            const zipName = globalBase
              ? `${Downloader.slugify(globalBase, 30)}_all_images.zip`
              : 'all_generated_images.zip';
            const finalZipPath = `${baseFolder}/${zipName}`;

            await Downloader.downloadZip(allCompletedImages, finalZipPath);
            session.finalZipPath = finalZipPath;
            logger.success(`Downloaded all ${allCompletedImages.length} images ONE TIME in single ZIP: ${finalZipPath}`);
          } catch (zipErr) {
            logger.error(`Final combined ZIP creation error: ${zipErr.message}`);
          }
        }

        session.completedAt = Date.now();
        await storage.saveSession(session);

        await this.setState(
          AUTOMATION_STATE.COMPLETED,
          `Queue Complete! Downloaded ZIP with all ${allCompletedImages.length} images across ${totalCompletedQueue} / ${totalQueue} designs.`,
          {},
          currentRunId
        );

        // Update badge on ChatGPT tab
        try {
          await chrome.tabs.sendMessage(tab.id, {
            type: 'UPDATE_BADGE',
            title: 'PromptFlow',
            status: `Done (${totalCompletedQueue}/${totalQueue} designs)`,
            state: 'completed'
          });
        } catch (e) {}

        // Add to history
        if (settings.keepSessionHistory) {
          const durationSeconds = Math.round((session.completedAt - session.startedAt) / 1000);
          await storage.addHistoryEntry({
            sessionId: session.sessionId,
            date: new Date().toISOString(),
            totalDesigns: totalQueue,
            completedDesigns: totalCompletedQueue,
            status: 'completed',
            durationSeconds
          });
        }
      }

    } catch (fatalError) {
      if (this.executionId !== currentRunId) {
        logger.info('Ignored error from superseded/reset run');
        return;
      }
      logger.error('Fatal automation error:', fatalError.message);
      await this.setState(AUTOMATION_STATE.ERROR, fatalError.message, { error: fatalError.message }, currentRunId);
      if (this.activeTabId) {
        try {
          await chrome.tabs.sendMessage(this.activeTabId, {
            type: 'UPDATE_BADGE',
            title: 'PromptFlow',
            status: `Error: ${fatalError.message}`,
            state: 'error'
          });
        } catch (e) {}
      }
    } finally {
      if (this.executionId === currentRunId) {
        this.isRunning = false;
        this.isPaused = false;
        this.stopRequested = false;
      }
    }
  }

  getCompletedCount(session) {
    return (session.prompts || []).filter((p) => p.status === PROMPT_STATUS.COMPLETED).length;
  }

  stopAutomation() {
    this.executionId = (this.executionId || 0) + 1;
    this.stopRequested = true;
    this.isRunning = false;
    this.isPaused = false;
    logger.warn(`Stop requested by user (executionId: ${this.executionId})`);
  }

  pauseAutomation() {
    if (!this.isRunning || this.isPaused) return;
    logger.info('Pause requested by user');
    this.isPaused = true;
  }

  resumeAutomation() {
    if (!this.isRunning || !this.isPaused) return;
    logger.info('Resume requested by user');
    this.isPaused = false;
  }

  reset() {
    this.executionId = (this.executionId || 0) + 1;
    this.isRunning = false;
    this.isPaused = false;
    this.stopRequested = true;
    this.activeTabId = null;
    logger.info(`Automation engine reset (new executionId: ${this.executionId})`);
  }
}

const engine = new AutomationEngine();

// Handle messages from Popup or Content Scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  logger.debug(`Background received message: ${message.type}`);

  (async () => {
    switch (message.type) {
      case 'START_AUTOMATION': {
        if (!engine.isRunning) {
          engine.startAutomation();
          sendResponse({ success: true, message: 'Automation initiated' });
        } else {
          sendResponse({ success: false, message: 'Automation is already running' });
        }
        break;
      }

      case 'STOP_AUTOMATION': {
        engine.stopAutomation();
        sendResponse({ success: true });
        break;
      }

      case 'PAUSE_AUTOMATION': {
        engine.pauseAutomation();
        sendResponse({ success: true });
        break;
      }

      case 'RESUME_AUTOMATION': {
        engine.resumeAutomation();
        sendResponse({ success: true });
        break;
      }

      case 'RESET_SESSION': {
        engine.reset();
        const session = await storage.resetSession();
        await engine.broadcastState(session);
        sendResponse({ success: true, session });
        break;
      }

      case 'DOWNLOAD_ALL': {
        const session = await storage.getSession();
        const settings = await storage.getSettings();
        const baseName = (message.baseName || session.baseFilename || 'name').trim();
        const asZip = message.asZip === true;
        const completedPrompts = (session.prompts || []).filter(
          (p) => p.status === PROMPT_STATUS.COMPLETED && p.imageUrl
        );

        if (completedPrompts.length === 0) {
          sendResponse({ success: false, message: 'No generated images available to download' });
          break;
        }

        const cleanBase = Downloader.slugify(baseName || 'name', 30) || 'name';
        const baseFolder = (settings.downloadFolder || 'PromptFlow').trim().replace(/^[/\\]+|[/\\]+$/g, '');

        if (asZip) {
          logger.info(`Starting single-file ZIP archive bundle for ${completedPrompts.length} images...`);
          const files = [];

          for (let idx = 0; idx < completedPrompts.length; idx++) {
            const p = completedPrompts[idx];
            const num = idx + 1;
            const fileName = `${cleanBase}_${num}.png`;

            try {
              const bytes = await Downloader.fetchImageBytes(p.imageUrl, engine.activeTabId);
              files.push({ name: fileName, data: bytes });
              logger.info(`Buffered ${fileName} (${Math.round(bytes.length / 1024)} KB) into ZIP payload`);
            } catch (fetchErr) {
              logger.error(`Could not fetch image data for ${fileName}: ${fetchErr.message}`);
            }
          }

          if (files.length === 0) {
            sendResponse({ success: false, message: 'Failed to fetch image bytes for any generated image' });
            break;
          }

          const zipPath = `${baseFolder}/${cleanBase}_images.zip`;
          try {
            await Downloader.downloadZip(files, zipPath);
            session.baseFilename = baseName;
            await storage.saveSession(session);
            await engine.broadcastState(session);

            sendResponse({
              success: true,
              asZip: true,
              count: files.length,
              total: completedPrompts.length,
              path: zipPath
            });
          } catch (zipErr) {
            logger.error(`Failed to download ZIP: ${zipErr.message}`);
            sendResponse({ success: false, message: `ZIP download failed: ${zipErr.message}` });
          }
        } else {
          logger.info(`Starting batch download of ${completedPrompts.length} individual images with format "${baseName}_X"`);
          const downloadedPaths = [];

          for (let idx = 0; idx < completedPrompts.length; idx++) {
            const p = completedPrompts[idx];
            const num = idx + 1; // 1, 2, 3...
            const path = Downloader.buildBatchDownloadPath(
              num,
              baseName,
              settings,
              session.sessionId
            );

            try {
              await Downloader.downloadWithRetries(p.imageUrl, path, settings.downloadRetries || 3);
              downloadedPaths.push(path);
              const promptIdx = session.prompts.findIndex((item) => item.id === p.id);
              if (promptIdx !== -1) {
                session.prompts[promptIdx].filename = path;
              }
            } catch (dlErr) {
              logger.error(`Failed downloading ${path}: ${dlErr.message}`);
            }
          }

          session.baseFilename = baseName;
          await storage.saveSession(session);
          await engine.broadcastState(session);

          sendResponse({
            success: true,
            asZip: false,
            count: downloadedPaths.length,
            total: completedPrompts.length,
            paths: downloadedPaths
          });
        }
        break;
      }

      case 'DOWNLOAD_QUEUE_ITEM_ZIP': {
        const session = await storage.getSession();
        const settings = await storage.getSettings();
        const queueItem = (session.queue || []).find((q) => q.id === message.queueId);

        if (!queueItem) {
          sendResponse({ success: false, message: 'Queue item not found' });
          break;
        }

        const completedPrompts = (queueItem.prompts || []).filter(
          (p) => p.status === PROMPT_STATUS.COMPLETED && p.imageUrl
        );

        if (completedPrompts.length === 0) {
          sendResponse({ success: false, message: 'No completed images for this design' });
          break;
        }

        const cleanBase = Downloader.slugify(queueItem.baseFilename || 'design', 30) || 'design';
        const baseFolder = (settings.downloadFolder || 'PromptFlow').trim().replace(/^[/\\]+|[/\\]+$/g, '');
        const zipPath = `${baseFolder}/${cleanBase}_images.zip`;
        const files = [];

        for (let idx = 0; idx < completedPrompts.length; idx++) {
          const p = completedPrompts[idx];
          const fileName = `${cleanBase}_${idx + 1}.png`;
          try {
            const bytes = await Downloader.fetchImageBytes(p.imageUrl, engine.activeTabId);
            files.push({ name: fileName, data: bytes });
          } catch (err) {
            logger.error(`Error fetching image for ${fileName}: ${err.message}`);
          }
        }

        if (files.length === 0) {
          sendResponse({ success: false, message: 'Failed to buffer image bytes for ZIP' });
          break;
        }

        try {
          await Downloader.downloadZip(files, zipPath);
          queueItem.zipPath = zipPath;
          await storage.saveSession(session);
          sendResponse({ success: true, count: files.length, path: zipPath });
        } catch (err) {
          sendResponse({ success: false, message: err.message });
        }
        break;
      }

      case 'DOWNLOAD_ALL_QUEUE_ZIPS': {
        const session = await storage.getSession();
        const settings = await storage.getSettings();
        const completedItems = (session.queue || []).filter(
          (q) => (q.prompts || []).some((p) => p.status === PROMPT_STATUS.COMPLETED && p.imageUrl)
        );

        if (completedItems.length === 0) {
          sendResponse({ success: false, message: 'No completed designs ready in queue' });
          break;
        }

        let downloadedCount = 0;
        const baseFolder = (settings.downloadFolder || 'PromptFlow').trim().replace(/^[/\\]+|[/\\]+$/g, '');

        for (const queueItem of completedItems) {
          const completedPrompts = queueItem.prompts.filter(
            (p) => p.status === PROMPT_STATUS.COMPLETED && p.imageUrl
          );
          if (completedPrompts.length === 0) continue;

          const cleanBase = Downloader.slugify(queueItem.baseFilename || 'design', 30) || 'design';
          const zipPath = `${baseFolder}/${cleanBase}_images.zip`;
          const files = [];

          for (let idx = 0; idx < completedPrompts.length; idx++) {
            const p = completedPrompts[idx];
            const fileName = `${cleanBase}_${idx + 1}.png`;
            try {
              const bytes = await Downloader.fetchImageBytes(p.imageUrl, engine.activeTabId);
              files.push({ name: fileName, data: bytes });
            } catch (err) {}
          }

          if (files.length > 0) {
            try {
              await Downloader.downloadZip(files, zipPath);
              queueItem.zipPath = zipPath;
              downloadedCount++;
              await new Promise((r) => setTimeout(r, 1200));
            } catch (err) {
              logger.error(`Error downloading ZIP for ${queueItem.name}: ${err.message}`);
            }
          }
        }

        await storage.saveSession(session);
        await engine.broadcastState(session);
        sendResponse({ success: true, count: downloadedCount, total: completedItems.length });
        break;
      }

      case 'GET_STATUS': {
        const session = await storage.getSession();
        sendResponse({
          isRunning: engine.isRunning,
          isPaused: engine.isPaused,
          session
        });
        break;
      }

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  })();

  return true; // Keep channel open for async response
});

logger.info('PromptFlow Service Worker initialized');
