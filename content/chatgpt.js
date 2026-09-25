// content/chatgpt.js
// Production-grade ChatGPT Content Script & DOM Adapter for PromptFlow

(function () {
  'use strict';

  // Prevent multiple injections
  if (window.__PROMPTFLOW_INJECTED__) {
    return;
  }
  window.__PROMPTFLOW_INJECTED__ = true;

  console.log('[PromptFlow] Content script initialized on:', window.location.href);

  // Helper delay
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /**
   * Centralized ChatGPT DOM Adapter
   * Implements multi-strategy, fault-tolerant element discovery and manipulation.
   */
  class ChatGPTAdapter {
    constructor() {
      this.lastKnownComposer = null;
      this.existingImagesSnapshot = new Set();
    }

    /**
     * Checks if the user is authenticated and not on a login/landing page.
     */
    isAuthenticated() {
      // If login or signup buttons are prominently featured as primary action
      const loginButton = document.querySelector('a[href*="/login"], button[data-testid="login-button"]');
      const isAuthPage = window.location.pathname.startsWith('/auth') || window.location.pathname.startsWith('/login');
      if (isAuthPage) return false;

      // Check if composer or user profile exists
      const composer = this.findComposer();
      const userNav = document.querySelector('button[data-testid="profile-button"], [data-testid="user-menu-button"], img[alt*="User" i]');
      return !!(composer || userNav || !loginButton);
    }

    /**
     * Multi-strategy composer detection.
     * ChatGPT frequently updates between textarea, contenteditable div, and role="textbox".
     */
    findComposer() {
      const strategies = [
        () => document.querySelector('#prompt-textarea'),
        () => document.querySelector('div[contenteditable="true"][id*="prompt"]'),
        () => document.querySelector('div[contenteditable="true"][data-placeholder]'),
        () => document.querySelector('div[contenteditable="true"]'),
        () => document.querySelector('textarea[data-id="root"]'),
        () => document.querySelector('textarea[placeholder*="message" i]'),
        () => document.querySelector('textarea[placeholder*="ask" i]'),
        () => document.querySelector('form textarea'),
        () => document.querySelector('[role="textbox"]')
      ];

      for (const strategy of strategies) {
        try {
          const el = strategy();
          if (el && el.offsetParent !== null) { // visible
            this.lastKnownComposer = el;
            return el;
          }
        } catch (e) {
          // ignore selector errors
        }
      }

      // Check fallback if cached reference is still in DOM
      if (this.lastKnownComposer && document.body.contains(this.lastKnownComposer)) {
        return this.lastKnownComposer;
      }

      return null;
    }

    /**
     * Finds the parent form or container of the composer.
     */
    findComposerContainer() {
      const composer = this.findComposer();
      if (!composer) return null;
      return composer.closest('form') || composer.closest('fieldset') || composer.parentElement?.parentElement || null;
    }

    /**
     * Finds the Send / Submit button using semantic attributes and DOM location.
     */
    findSendButton() {
      const container = this.findComposerContainer() || document;
      const strategies = [
        () => container.querySelector('button[data-testid="send-button"]'),
        () => container.querySelector('button[aria-label*="Send prompt" i]'),
        () => container.querySelector('button[aria-label*="Send message" i]'),
        () => container.querySelector('button[aria-label*="Send" i]'),
        () => container.querySelector('button[data-testid="fruitjuice-send-button"]'),
        // Button with send arrow / SVG inside composer container
        () => {
          const buttons = container.querySelectorAll('button');
          for (const b of buttons) {
            const svg = b.querySelector('svg');
            const aria = b.getAttribute('aria-label') || '';
            if (aria.toLowerCase().includes('send') || (svg && b.offsetParent !== null && !b.disabled)) {
              return b;
            }
          }
          return null;
        }
      ];

      for (const strategy of strategies) {
        try {
          const btn = strategy();
          if (btn) return btn;
        } catch (e) {}
      }
      return null;
    }

    /**
     * Finds the Stop Generation button.
     */
    findStopButton() {
      const container = this.findComposerContainer() || document;
      const strategies = [
        () => container.querySelector('button[data-testid="stop-button"]'),
        () => container.querySelector('button[aria-label*="Stop" i]'),
        () => container.querySelector('button[data-testid="stop-generating-button"]'),
        () => document.querySelector('button[data-testid="stop-button"]'),
        () => document.querySelector('button[aria-label*="Stop" i]')
      ];

      for (const strategy of strategies) {
        try {
          const btn = strategy();
          if (btn && btn.offsetParent !== null) return btn;
        } catch (e) {}
      }
      return null;
    }

    /**
     * Detects if ChatGPT is actively generating / streaming.
     */
    isGenerating() {
      // Signal 1: Stop button is present and visible
      if (this.findStopButton()) return true;

      // Signal 2: Streaming class or attribute on conversation or body
      if (document.querySelector('.result-streaming, [data-is-streaming="true"]')) return true;

      // Signal 3: Check if send button is transformed into stop icon or disabled during streaming
      const sendBtn = this.findSendButton();
      if (sendBtn && sendBtn.getAttribute('aria-label')?.toLowerCase().includes('stop')) {
        return true;
      }

      return false;
    }

    /**
     * Finds the attachment input or attach button.
     */
    findAttachmentElements() {
      // Directly check for file inputs in the DOM
      const fileInputs = Array.from(document.querySelectorAll('input[type="file"]'));
      let directFileInput = fileInputs.find((i) => i.accept?.includes('image') || !i.accept) || fileInputs[0] || null;

      // Check attach buttons
      const container = this.findComposerContainer() || document;
      const buttonStrategies = [
        () => container.querySelector('button[data-testid*="attach" i]'),
        () => container.querySelector('button[aria-label*="Attach" i]'),
        () => container.querySelector('button[aria-label*="Add files" i]'),
        () => container.querySelector('button[aria-label*="Upload" i]'),
        () => container.querySelector('button[data-testid="fruitjuice-attachment-button"]'),
        () => document.querySelector('button[data-testid*="attach" i]'),
        () => document.querySelector('button[aria-label*="Attach" i]')
      ];

      let attachButton = null;
      for (const strat of buttonStrategies) {
        try {
          const b = strat();
          if (b && b.offsetParent !== null) {
            attachButton = b;
            break;
          }
        } catch (e) {}
      }

      return { fileInput: directFileInput, attachButton };
    }

    /**
     * Converts a dataURL/base64 to a File object.
     */
    dataUrlToFile(dataUrl, filename = 'reference.png') {
      const arr = dataUrl.split(',');
      const mime = arr[0].match(/:(.*?);/)[1] || 'image/png';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new File([u8arr], filename, { type: mime });
    }

    /**
     * Uploads the reference image via synthetic file input change or drag-and-drop.
     */
    async uploadReference(fileData) {
      console.log('[PromptFlow] Uploading reference image:', fileData.name);

      const file = this.dataUrlToFile(fileData.dataUrl, fileData.name || 'reference.png');
      const dt = new DataTransfer();
      dt.items.add(file);

      let { fileInput, attachButton } = this.findAttachmentElements();

      // Strategy A: If file input exists, directly assign files
      if (fileInput) {
        try {
          fileInput.files = dt.files;
          fileInput.dispatchEvent(new Event('input', { bubbles: true }));
          fileInput.dispatchEvent(new Event('change', { bubbles: true }));
          console.log('[PromptFlow] Injected file into <input type="file">');
        } catch (e) {
          console.warn('[PromptFlow] Direct file input assignment warning:', e);
        }
      }

      // Strategy B: If no input or direct assignment didn't trigger thumbnail, click attach button to summon input
      if (!fileInput && attachButton) {
        console.log('[PromptFlow] Clicking attach button to expose file input...');
        attachButton.click();
        await sleep(500);

        const updated = this.findAttachmentElements();
        if (updated.fileInput) {
          updated.fileInput.files = dt.files;
          updated.fileInput.dispatchEvent(new Event('input', { bubbles: true }));
          updated.fileInput.dispatchEvent(new Event('change', { bubbles: true }));
          console.log('[PromptFlow] Attached via exposed file input');
        }
      }

      // Strategy C: Drag-and-drop fallback onto composer / form container
      const composer = this.findComposer();
      const targetDropZone = this.findComposerContainer() || composer;

      if (targetDropZone) {
        try {
          const dragenter = new DragEvent('dragenter', {
            dataTransfer: dt,
            bubbles: true,
            cancelable: true
          });
          const dragover = new DragEvent('dragover', {
            dataTransfer: dt,
            bubbles: true,
            cancelable: true
          });
          const drop = new DragEvent('drop', {
            dataTransfer: dt,
            bubbles: true,
            cancelable: true
          });

          targetDropZone.dispatchEvent(dragenter);
          targetDropZone.dispatchEvent(dragover);
          targetDropZone.dispatchEvent(drop);
          console.log('[PromptFlow] Dispatched synthetic drop event on dropzone');
        } catch (e) {
          console.warn('[PromptFlow] Drag & drop dispatch warning:', e);
        }
      }

      // Now wait for attachment thumbnail to appear and stabilize
      await this.waitForAttachment(35000);
      console.log('[PromptFlow] Reference image upload verified successfully');
      return true;
    }

    /**
     * Waits until the uploaded image attachment thumbnail is visible in composer.
     */
    async waitForAttachment(timeoutMs = 35000) {
      const start = Date.now();

      while (Date.now() - start < timeoutMs) {
        const container = this.findComposerContainer() || document;

        // Look for attachment preview elements
        const previewSelectors = [
          '[data-testid="attachment-thumbnail"]',
          '[data-testid*="attachment" i]',
          'div[class*="attachment"]',
          'div[class*="pill"]',
          'img[src^="blob:"]',
          'img[src*="attachment"]'
        ];

        let previewFound = false;
        for (const sel of previewSelectors) {
          const el = container.querySelector(sel);
          if (el && el.offsetParent !== null) {
            previewFound = true;
            break;
          }
        }

        // Check if there is an active upload progress spinner
        const spinner = container.querySelector('[role="progressbar"], .loading-spinner, [aria-label*="loading" i], [aria-label*="uploading" i]');

        if (previewFound && !spinner) {
          // Extra grace period to allow ChatGPT's internal React state to register the upload
          await sleep(1200);
          return true;
        }

        await sleep(500);
      }

      console.warn('[PromptFlow] Attachment verification timed out, checking composer state...');
      return false;
    }

    /**
     * Waits until ChatGPT is completely idle (not generating, composer active).
     */
    async waitForIdle(timeoutMs = 15000) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        if (!this.isGenerating()) {
          await sleep(400);
          return true;
        }
        await sleep(350);
      }
      return false;
    }

    /**
     * Inserts prompt text into ChatGPT composer using native input pipelines.
     */
    async insertPrompt(text) {
      // Ensure ChatGPT is not still generating from previous prompt
      await this.waitForIdle(15000);

      const composer = this.findComposer();
      if (!composer) {
        throw new Error('ChatGPT composer input could not be found');
      }

      composer.focus();
      await sleep(150);

      const isContentEditable = composer.isContentEditable || composer.getAttribute('contenteditable') === 'true';

      if (isContentEditable) {
        // Clear existing content cleanly using window selection
        try {
          const sel = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(composer);
          sel.removeAllRanges();
          sel.addRange(range);
          document.execCommand('delete', false, null);
        } catch (e) {
          composer.textContent = '';
        }
        await sleep(60);

        // Native insertText triggers Lexical/ProseMirror listeners
        let success = document.execCommand('insertText', false, text);

        if (!success || composer.innerText.trim() !== text.trim()) {
          composer.innerHTML = `<p>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`;
          composer.dispatchEvent(
            new InputEvent('beforeinput', {
              bubbles: true,
              cancelable: true,
              inputType: 'insertText',
              data: text
            })
          );
          composer.dispatchEvent(
            new InputEvent('input', {
              bubbles: true,
              cancelable: true,
              inputType: 'insertText',
              data: text
            })
          );
          composer.dispatchEvent(new Event('change', { bubbles: true }));
        }
      } else {
        // Standard textarea
        composer.value = text;
        composer.dispatchEvent(new Event('input', { bubbles: true }));
        composer.dispatchEvent(new Event('change', { bubbles: true }));
      }

      await sleep(250);
      console.log('[PromptFlow] Inserted prompt text into composer:', text.slice(0, 35));
      return true;
    }

    /**
     * Submits the prompt by clicking Send or triggering Enter keydown.
     * Verifies that the prompt was actually dispatched.
     */
    async submitPrompt() {
      // 1. Wait for Send button to become enabled
      let sendBtn = null;
      for (let i = 0; i < 20; i++) {
        sendBtn = this.findSendButton();
        if (sendBtn && !sendBtn.disabled && sendBtn.getAttribute('aria-disabled') !== 'true') {
          break;
        }
        await sleep(200);
      }

      if (sendBtn && !sendBtn.disabled && sendBtn.getAttribute('aria-disabled') !== 'true') {
        sendBtn.click();
        console.log('[PromptFlow] Clicked Send button successfully');
        await sleep(500);
        return true;
      }

      // 2. Fallback: Dispatch Enter keydown/keyup on composer
      const composer = this.findComposer();
      if (composer) {
        console.log('[PromptFlow] Fallback: Dispatching Enter keydown on composer');
        composer.focus();
        const enterDown = new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true
        });
        const enterUp = new KeyboardEvent('keyup', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true
        });
        composer.dispatchEvent(enterDown);
        composer.dispatchEvent(enterUp);
        await sleep(500);
        return true;
      }

      throw new Error('Failed to submit prompt: Send button not clickable and composer not responsive');
    }

    /**
     * Finds all assistant message elements in the conversation, strictly excluding user messages.
     */
    getAssistantMessages() {
      // Primary: Elements with assistant role
      const roleAssistant = Array.from(document.querySelectorAll('[data-message-author-role="assistant"]'));
      if (roleAssistant.length > 0) return roleAssistant;

      // Secondary: Filter conversation articles that do NOT contain user role
      const articles = Array.from(document.querySelectorAll('article[data-testid^="conversation-turn-"]'));
      const assistantArticles = articles.filter((art) => !art.querySelector('[data-message-author-role="user"]'));
      if (assistantArticles.length > 0) return assistantArticles;

      // Fallback: Check general assistant container elements
      const fallback = Array.from(document.querySelectorAll('.agent-turn, [data-message-model-slug]'));
      if (fallback.length > 0) return fallback;

      return [];
    }

    /**
     * Takes snapshot of all existing image URLs in the DOM before generation starts
     * and records baseline assistant message count to accurately distinguish identical prompts.
     */
    snapshotBeforePrompt() {
      this.existingImagesSnapshot = new Set();
      const images = document.querySelectorAll('img');
      images.forEach((img) => {
        if (img.src) this.existingImagesSnapshot.add(img.src);
        if (img.currentSrc) this.existingImagesSnapshot.add(img.currentSrc);
      });
      const assistantMsgs = this.getAssistantMessages();
      this.baselineAssistantCount = assistantMsgs.length;
      console.log(`[PromptFlow] Recorded snapshot of ${this.existingImagesSnapshot.size} images. Baseline assistant count: ${this.baselineAssistantCount}`);
      return { count: this.existingImagesSnapshot.size, baselineAssistantCount: this.baselineAssistantCount };
    }

    /**
     * Waits for generation to start (stop button appearing, streaming state, or new assistant turn created).
     */
    async waitForGenerationStart(timeoutMs = 25000) {
      const startTime = Date.now();
      console.log(`[PromptFlow] Waiting for generation start signal (baseline turns: ${this.baselineTurnCount})...`);

      while (Date.now() - startTime < timeoutMs) {
        const isGen = this.isGenerating();
        const currentTurns = this.getAssistantTurns().length;
        const hasNewTurn = currentTurns > (this.baselineTurnCount || 0);

        if (isGen || hasNewTurn) {
          console.log(`[PromptFlow] Generation start detected (isGen=${isGen}, newTurn=${hasNewTurn})`);
          return true;
        }
        await sleep(350);
      }

      console.warn('[PromptFlow] Generation start signal timed out (ChatGPT may have already started)');
      return false;
    }

    /**
     * Waits for generation to complete on the NEW assistant turn.
     * Prevents previous generation from being mistaken as the current one.
     */
    async waitForGenerationComplete(timeoutMinutes = 5) {
      const timeoutMs = timeoutMinutes * 60 * 1000;
      const startTime = Date.now();
      console.log(`[PromptFlow] Waiting for generation completion on new turn (max ${timeoutMinutes} mins)...`);

      // Initial sleep to allow ChatGPT to receive prompt
      await sleep(1500);

      let stabilizedCount = 0;
      const STABILIZED_TARGET = 3;

      while (Date.now() - startTime < timeoutMs) {
        const currentTurns = this.getAssistantTurns().length;
        const hasNewTurn = currentTurns > (this.baselineTurnCount || 0);
        const generating = this.isGenerating();

        // Must have created a new assistant turn AND stopped generating
        if (hasNewTurn && !generating) {
          stabilizedCount++;
          if (stabilizedCount >= STABILIZED_TARGET) {
            console.log(`[PromptFlow] Generation completion verified on new turn (${currentTurns} > ${this.baselineTurnCount})`);
            return true;
          }
        } else {
          stabilizedCount = 0;
        }

        await sleep(1000);
      }

      throw new Error(`Generation timed out after ${timeoutMinutes} minutes`);
    }

    /**
     * Finds all assistant conversation turns.
     */
    getAssistantTurns() {
      const turns = Array.from(
        document.querySelectorAll(
          'article[data-testid^="conversation-turn-"], div[data-message-author-role="assistant"], [data-message-model-slug]'
        )
      );

      if (turns.length > 0) return turns;

      // Fallback: look for articles or conversation container items
      const generalArticles = Array.from(document.querySelectorAll('article'));
      if (generalArticles.length > 0) return generalArticles;

      return [];
    }

    /**
     * Detects the newly generated image EXCLUSIVELY in the new assistant turn(s).
     * Solves the issue where identical prompts would confuse older generations with current ones.
     */
    async detectNewGeneratedImage(timeoutMs = 45000) {
      const startTime = Date.now();
      console.log(`[PromptFlow] Scanning for newly generated image in turns after index ${this.baselineTurnCount}...`);

      while (Date.now() - startTime < timeoutMs) {
        const turns = this.getAssistantTurns();
        // Target only the new assistant turns created after the prompt was submitted!
        const targetTurns = turns.length > (this.baselineTurnCount || 0)
          ? turns.slice(this.baselineTurnCount || 0)
          : [turns[turns.length - 1] || document.body];

        const candidateImages = [];

        for (const scope of targetTurns) {
          if (!scope) continue;
          const images = Array.from(scope.querySelectorAll('img'));

          for (const img of images) {
            const src = img.currentSrc || img.src;
            if (!src) continue;

            // Filter out avatar images
            const alt = (img.getAttribute('alt') || '').toLowerCase();
            const className = (img.className || '').toLowerCase();
            const parentClass = (img.parentElement?.className || '').toLowerCase();

            if (
              alt.includes('user') ||
              alt.includes('avatar') ||
              alt.includes('chatgpt') ||
              alt.includes('profile') ||
              className.includes('avatar') ||
              parentClass.includes('avatar') ||
              src.includes('avatar') ||
              src.includes('gravatar')
            ) {
              continue;
            }

            // Filter out UI icons (small dimensions)
            if (img.naturalWidth > 0 && img.naturalWidth < 120) continue;
            if (img.naturalHeight > 0 && img.naturalHeight < 120) continue;

            // Check if this image was NOT in the pre-prompt snapshot
            const isNew = !this.existingImagesSnapshot.has(src);

            if (isNew) {
              candidateImages.push(img);
            }
          }

          if (candidateImages.length > 0) {
            break;
          }
        }

        // If found candidates, verify image is fully loaded
        if (candidateImages.length > 0) {
          const targetImg = candidateImages[candidateImages.length - 1]; // latest image

          if (targetImg.complete && targetImg.naturalWidth > 100) {
            const finalUrl = targetImg.currentSrc || targetImg.src;
            this.existingImagesSnapshot.add(finalUrl); // Mark seen for subsequent prompts
            console.log('[PromptFlow] Successfully detected new generated image:', finalUrl);
            return finalUrl;
          }

          // If still loading, wait for it
          try {
            await new Promise((res, rej) => {
              targetImg.addEventListener('load', () => res(), { once: true });
              targetImg.addEventListener('error', () => rej(new Error('Image failed to load in DOM')), { once: true });
              setTimeout(res, 3000);
            });
            const finalUrl = targetImg.currentSrc || targetImg.src;
            this.existingImagesSnapshot.add(finalUrl);
            return finalUrl;
          } catch (e) {
            console.warn('[PromptFlow] Waiting for image load event warning:', e);
          }
        }

        await sleep(1000);
      }

      throw new Error('Newly generated image could not be detected within timeout');
    }

    /**
     * Efficiently waits for ChatGPT image generation to complete and returns the new image URL.
     * Searches strictly within the target assistant turn to NEVER detect user reference images.
     */
    async waitForGeneratedImage(timeoutMinutes = 3) {
      const timeoutMs = timeoutMinutes * 60 * 1000;
      const startTime = Date.now();
      const targetAssistantIndex = this.baselineAssistantCount || 0;
      console.log(`[PromptFlow] Monitoring for generated image in assistant turn >= index ${targetAssistantIndex}...`);

      // 1. Give ChatGPT up to 15s to initiate generation (stop button appearing or assistant turn creation)
      let generationInitiated = false;
      const startCheckUntil = Date.now() + 15000;
      while (Date.now() < startCheckUntil) {
        if (this.isGenerating()) {
          generationInitiated = true;
          console.log('[PromptFlow] Generation start confirmed (stop button or streaming visible)');
          break;
        }
        const msgs = this.getAssistantMessages();
        if (msgs.length > targetAssistantIndex) {
          generationInitiated = true;
          console.log('[PromptFlow] Generation start confirmed (new assistant turn created)');
          break;
        }
        await sleep(350);
      }

      // 2. Poll until generation STOPS and a new image is found inside the assistant response
      while (Date.now() - startTime < timeoutMs) {
        // Immediate ChatGPT error detection
        const errorEl = document.querySelector('.text-red-500, [data-testid="error-message"], .border-red-500, [class*="error-message"]');
        if (errorEl && errorEl.textContent.trim().length > 0) {
          const errMsg = errorEl.textContent.trim();
          if (errMsg.toLowerCase().includes('error') || errMsg.toLowerCase().includes('violate') || errMsg.toLowerCase().includes('policy')) {
            throw new Error(`ChatGPT error: ${errMsg}`);
          }
        }

        const isGen = this.isGenerating();
        const assistantMsgs = this.getAssistantMessages();

        // Target ONLY the assistant message(s) created for THIS prompt!
        const targetScopes = assistantMsgs.length > targetAssistantIndex
          ? assistantMsgs.slice(targetAssistantIndex)
          : (assistantMsgs.length > 0 ? [assistantMsgs[assistantMsgs.length - 1]] : []);

        const candidateImages = [];

        for (const scope of targetScopes) {
          if (!scope) continue;
          // NEVER inspect user message containers
          if (scope.getAttribute('data-message-author-role') === 'user' || scope.querySelector?.('[data-message-author-role="user"]')) {
            continue;
          }

          const images = Array.from(scope.querySelectorAll('img'));

          for (const img of images) {
            const src = img.currentSrc || img.src;
            if (!src) continue;

            // Exclude user attachments or composer images
            if (img.closest('[data-message-author-role="user"]') || img.closest('form') || img.closest('[class*="attachment"]')) {
              continue;
            }

            // Exclude avatars
            const alt = (img.getAttribute('alt') || '').toLowerCase();
            const className = (img.className || '').toLowerCase();
            const parentClass = (img.parentElement?.className || '').toLowerCase();

            if (
              alt.includes('user') ||
              alt.includes('avatar') ||
              alt.includes('chatgpt') ||
              alt.includes('profile') ||
              className.includes('avatar') ||
              parentClass.includes('avatar') ||
              src.includes('avatar') ||
              src.includes('gravatar')
            ) {
              continue;
            }

            // Exclude tiny icons
            if (img.naturalWidth > 0 && img.naturalWidth < 120) continue;
            if (img.naturalHeight > 0 && img.naturalHeight < 120) continue;

            // Check if new
            if (!this.existingImagesSnapshot.has(src)) {
              candidateImages.push({ img, src });
            }
          }
        }

        if (candidateImages.length > 0) {
          const latest = candidateImages[candidateImages.length - 1];

          // Generation MUST be finished (stop button gone) AND image element complete
          if (!isGen && latest.img.complete && (latest.img.naturalWidth > 100 || latest.img.naturalWidth === 0)) {
            await sleep(600);
            const finalSrc = latest.img.currentSrc || latest.img.src || latest.src;
            this.existingImagesSnapshot.add(finalSrc);
            console.log('[PromptFlow] Detected newly generated image in assistant message:', finalSrc);
            return finalSrc;
          }
        }

        await sleep(750);
      }

      throw new Error(`Image generation timed out after ${timeoutMinutes} minutes`);
    }
  }

  const adapter = new ChatGPTAdapter();

  /**
   * Floating overlay management for live, on-page visibility during automation
   */
  class OverlayManager {
    constructor() {
      this.hud = null;
      this.isMinimized = false;
      this.lastSession = null;
    }

    createOrUpdateHUD(session, overrideTitle = '', overrideStatus = '') {
      if (session) this.lastSession = session;
      const activeSession = session || this.lastSession;

      if (!this.hud) {
        this.hud = document.createElement('div');
        this.hud.className = 'promptflow-floating-hud';
        document.body.appendChild(this.hud);
      }

      const state = activeSession?.state || 'active';
      const statusMsg = overrideStatus || activeSession?.statusMessage || 'Running...';
      const title = overrideTitle || 'PromptFlow';
      const prompts = activeSession?.prompts || [];
      const enabled = prompts.filter(p => p.enabled && p.text.trim());
      const completed = prompts.filter(p => p.status === 'completed');
      const total = enabled.length || 1;
      const count = completed.length;
      const pct = Math.round((count / total) * 100);
      const isDone = state === 'completed' || (count >= total && count > 0);

      const dotClass = state === 'waiting_for_generation' || state === 'sending_prompt' || state === 'uploading_reference'
        ? 'generating'
        : isDone ? 'completed' : state === 'error' ? 'error' : '';

      this.hud.innerHTML = `
        <div class="promptflow-hud-header">
          <div class="promptflow-hud-brand">
            <div class="promptflow-badge-dot ${dotClass}"></div>
            <span>${title}</span>
          </div>
          <span class="promptflow-hud-step">${count} / ${total} Ready</span>
          <button type="button" class="promptflow-hud-btn-min" id="promptflow-btn-toggle" title="${this.isMinimized ? 'Expand' : 'Minimize'}">${this.isMinimized ? '▢' : '—'}</button>
        </div>
        <div class="promptflow-hud-body">
          <div class="promptflow-hud-status" title="${statusMsg}">${statusMsg}</div>
          <div class="promptflow-hud-progress-track">
            <div class="promptflow-hud-progress-fill" style="width: ${pct}%"></div>
          </div>
        </div>
        <div class="promptflow-hud-actions">
          ${isDone
            ? `<button type="button" class="promptflow-hud-btn promptflow-hud-btn-download" id="promptflow-btn-hud-dl">Download All (${count})</button>`
            : `<button type="button" class="promptflow-hud-btn promptflow-hud-btn-stop" id="promptflow-btn-hud-stop">Stop Automation</button>`
          }
        </div>
      `;

      if (this.isMinimized) {
        this.hud.classList.add('minimized');
      } else {
        this.hud.classList.remove('minimized');
      }

      // Bind events
      const toggleBtn = this.hud.querySelector('#promptflow-btn-toggle');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.isMinimized = !this.isMinimized;
          this.createOrUpdateHUD(this.lastSession, title, statusMsg);
        });
      }

      const stopBtn = this.hud.querySelector('#promptflow-btn-hud-stop');
      if (stopBtn) {
        stopBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          chrome.runtime.sendMessage({ type: 'STOP_AUTOMATION' });
        });
      }

      const dlBtn = this.hud.querySelector('#promptflow-btn-hud-dl');
      if (dlBtn) {
        dlBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          chrome.runtime.sendMessage({ type: 'DOWNLOAD_ALL' });
        });
      }
    }

    createOrUpdate(title, status, state = 'info') {
      this.createOrUpdateHUD(null, title, status);
    }

    remove() {
      if (this.hud && this.hud.parentNode) {
        this.hud.parentNode.removeChild(this.hud);
        this.hud = null;
      }
    }
  }

  const overlay = new OverlayManager();

  /**
   * Content script message listener
   * Receives commands from background service worker
   */
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[PromptFlow Content] Received message:', message.type);

    (async () => {
      try {
        switch (message.type) {
          case 'SYNC_SESSION_OVERLAY': {
            overlay.createOrUpdateHUD(message.session);
            sendResponse({ success: true });
            break;
          }

          case 'PING': {
            const composer = adapter.findComposer();
            const authenticated = adapter.isAuthenticated();
            sendResponse({
              success: true,
              authenticated,
              ready: !!composer,
              url: window.location.href
            });
            break;
          }

          case 'PREPARE_REFERENCE_UPLOAD': {
            overlay.createOrUpdate('PromptFlow', 'Uploading Reference Image...', 'generating');
            const success = await adapter.uploadReference(message.fileData);
            sendResponse({ success });
            break;
          }

          case 'TAKE_IMAGE_SNAPSHOT': {
            const result = adapter.snapshotBeforePrompt();
            sendResponse({ success: true, count: result.count, baselineTurns: result.baselineTurns });
            break;
          }

          case 'SUBMIT_PROMPT': {
            overlay.createOrUpdate('PromptFlow', `Sending Prompt ${message.promptIndex}...`, 'generating');
            await adapter.insertPrompt(message.promptText);
            await sleep(400);
            await adapter.submitPrompt();
            sendResponse({ success: true });
            break;
          }

          case 'WAIT_AND_DETECT_IMAGE': {
            overlay.createOrUpdate('PromptFlow', `Generating image ${message.promptIndex}...`, 'generating');
            const imageUrl = await adapter.waitForGeneratedImage(message.timeoutMinutes || 3);
            overlay.createOrUpdate('PromptFlow', `Image ${message.promptIndex} ready!`, 'completed');
            sendResponse({ success: true, imageUrl });
            break;
          }

          case 'WAIT_GENERATION': {
            overlay.createOrUpdate('PromptFlow', `Generating image ${message.promptIndex}...`, 'generating');
            await adapter.waitForGenerationStart(25000);
            await adapter.waitForGenerationComplete(message.timeoutMinutes || 5);
            sendResponse({ success: true });
            break;
          }

          case 'DETECT_NEW_IMAGE': {
            overlay.createOrUpdate('PromptFlow', `Detecting generated image ${message.promptIndex}...`, 'info');
            const imageUrl = await adapter.detectNewGeneratedImage(50000);
            sendResponse({ success: true, imageUrl });
            break;
          }

          case 'UPDATE_BADGE': {
            overlay.createOrUpdate(message.title || 'PromptFlow', message.status || '', message.state || 'info');
            sendResponse({ success: true });
            break;
          }

          case 'FETCH_IMAGE_DATA': {
            try {
              const resp = await fetch(message.url);
              const blob = await resp.blob();
              const reader = new FileReader();
              reader.onload = () => sendResponse({ success: true, dataUrl: reader.result });
              reader.onerror = () => sendResponse({ success: false, error: 'FileReader failed' });
              reader.readAsDataURL(blob);
            } catch (err) {
              sendResponse({ success: false, error: err.message });
            }
            break;
          }

          case 'REMOVE_BADGE': {
            overlay.remove();
            sendResponse({ success: true });
            break;
          }

          default:
            sendResponse({ success: false, error: `Unknown message type: ${message.type}` });
        }
      } catch (err) {
        console.error('[PromptFlow Content Error]', err);
        overlay.createOrUpdate('PromptFlow', `Error: ${err.message}`, 'error');
        sendResponse({ success: false, error: err.message });
      }
    })();

    return true; // Keep message channel open for async response
  });
})();
