// background/service-worker.js
// Production Background Service Worker & Automation State Machine for PromptFlow

import storage, { AUTOMATION_STATE, PROMPT_STATUS, createInitialSession } from '../utils/storage.js';
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
    logger.info('Searching for open ChatGPT tabs...');
    const tabs = await chrome.tabs.query({
      url: ['https://chatgpt.com/*', 'https://chat.openai.com/*']
    });

    if (tabs.length > 0) {
      const activeTab = tabs[0];
      await chrome.tabs.update(activeTab.id, { active: true });
      if (activeTab.windowId) {
        await chrome.windows.update(activeTab.windowId, { focused: true });
      }
      this.activeTabId = activeTab.id;
      logger.success(`Found existing ChatGPT tab (ID: ${this.activeTabId})`);
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
      // 1. Validate inputs
      if (!session.referenceImage) {
        throw new Error('Please upload a reference image before starting.');
      }

      const enabledPrompts = session.prompts.filter((p) => p.enabled && p.text.trim().length > 0);
      if (enabledPrompts.length === 0) {
        throw new Error('Please provide at least one prompt with text.');
      }

      session.startedAt = Date.now();
      session.completedAt = null;
      session.error = null;
      await storage.saveSession(session);

      await this.setState(AUTOMATION_STATE.PREPARING, 'Preparing session...', {}, currentRunId);

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

      // 4. Execute prompt sequence
      for (let i = 0; i < session.prompts.length; i++) {
        // Refresh session data
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

        // Skip disabled or empty prompts
        if (!prompt.enabled || !prompt.text.trim()) {
          if (prompt.status !== PROMPT_STATUS.COMPLETED) {
            await this.updatePrompt(i, { status: PROMPT_STATUS.SKIPPED }, currentRunId);
          }
          continue;
        }

        // If prompt was already completed in a resumed session, skip to next
        if (prompt.status === PROMPT_STATUS.COMPLETED) {
          logger.info(`Prompt ${i + 1} already completed. Skipping.`);
          continue;
        }

        session.currentPromptIndex = i;
        await storage.saveSession(session);

        logger.info(`=== Starting Prompt ${i + 1} / ${session.prompts.length} ===`);

        let promptSuccess = false;
        let attempt = 0;
        const maxPromptRetries = 1; // 1 attempt per prompt prevents long waiting loops

        while (!promptSuccess && attempt < maxPromptRetries) {
          attempt++;
          if (this.executionId !== currentRunId || this.stopRequested) break;

          try {
            // STEP A: Upload Reference Image (ONLY ONCE for the chat session!)
            if (!session.referenceUploaded) {
              await this.setState(
                AUTOMATION_STATE.UPLOADING_REFERENCE,
                `Uploading reference image for the chat...`,
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
                fileData: session.referenceImage
              });

              if (!uploadRes || !uploadRes.success) {
                throw new Error(uploadRes?.error || 'Failed to attach reference image to ChatGPT composer');
              }

              session.referenceUploaded = true;
              await storage.saveSession(session);
              logger.success('Reference image uploaded once for chat session');

              // Small delay to ensure attachment thumbnail settled
              await new Promise((r) => setTimeout(r, 1500));
            } else {
              logger.info(`Reference image already uploaded for this chat. Proceeding directly with Prompt ${i + 1}.`);
            }

            if (this.executionId !== currentRunId || this.stopRequested) break;

            // STEP B: Pre-prompt Image Snapshot & Baseline Turn Tracking
            logger.info(`Taking pre-prompt DOM snapshot for Prompt ${i + 1}...`);
            await chrome.tabs.sendMessage(tab.id, { type: 'TAKE_IMAGE_SNAPSHOT' });

            // STEP C: Send Prompt
            await this.setState(
              AUTOMATION_STATE.SENDING_PROMPT,
              `Sending Prompt ${i + 1}...`,
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

            if (this.executionId !== currentRunId || this.stopRequested) break;

            // STEP D: Fast Wait and Detect Generated Image directly
            await this.setState(
              AUTOMATION_STATE.WAITING_FOR_GENERATION,
              `Generating image for Prompt ${i + 1}...`,
              {},
              currentRunId
            );
            await this.updatePrompt(i, { status: PROMPT_STATUS.GENERATING }, currentRunId);

            const genRes = await chrome.tabs.sendMessage(tab.id, {
              type: 'WAIT_AND_DETECT_IMAGE',
              promptIndex: i + 1,
              timeoutMinutes: Math.min(settings.generationTimeoutMinutes || 3, 3)
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

        // STEP E: Delay before next prompt
        if (i < session.prompts.length - 1 && !this.stopRequested && this.executionId === currentRunId) {
          await this.setState(
            AUTOMATION_STATE.NEXT_PROMPT,
            `Waiting ${settings.delayBetweenPromptsSeconds}s before next prompt...`,
            {},
            currentRunId
          );
          await new Promise((r) => setTimeout(r, (settings.delayBetweenPromptsSeconds || 2) * 1000));
        }
      }

      // 5. Finalize Session
      if (!this.stopRequested && this.executionId === currentRunId) {
        session = await storage.getSession();
        const completedCount = this.getCompletedCount(session);
        const totalEnabled = session.prompts.filter((p) => p.enabled && p.text.trim().length > 0).length;

        session.completedAt = Date.now();
        session.stats = {
          total: totalEnabled,
          completed: completedCount,
          failed: totalEnabled - completedCount,
          skipped: session.prompts.filter((p) => p.status === PROMPT_STATUS.SKIPPED).length
        };

        await storage.saveSession(session);
        await this.setState(
          AUTOMATION_STATE.COMPLETED,
          `Automation Complete! ${completedCount} / ${totalEnabled} images ready.`,
          {},
          currentRunId
        );

        // Update badge on ChatGPT tab
        try {
          await chrome.tabs.sendMessage(tab.id, {
            type: 'UPDATE_BADGE',
            title: 'PromptFlow',
            status: `Completed (${completedCount}/${totalEnabled})`,
            state: 'completed'
          });
        } catch (e) {}

        // Add to history
        if (settings.keepSessionHistory) {
          const durationSeconds = Math.round((session.completedAt - session.startedAt) / 1000);
          await storage.addHistoryEntry({
            sessionId: session.sessionId,
            date: new Date().toISOString(),
            totalPrompts: totalEnabled,
            completedPrompts: completedCount,
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
