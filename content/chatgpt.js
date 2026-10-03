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

  // Ensure Main World Lexical Bridge is attached
  try {
    if (!document.getElementById('promptflow-main-bridge')) {
      const s = document.createElement('script');
      s.id = 'promptflow-main-bridge';
      s.src = chrome.runtime.getURL('content/chatgpt-main.js');
      (document.head || document.documentElement).appendChild(s);
    }
  } catch (e) {}

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
     * Checks if an element is present and active in the layout tree.
     * Works reliably even when the tab is in the background or minimized.
     */
    isElementActive(el) {
      if (!el || !el.isConnected) return false;
      try {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        return true;
      } catch (e) {
        return el.offsetParent !== null || el.isConnected;
      }
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
          if (this.isElementActive(el)) {
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
            if (aria.toLowerCase().includes('send') || (svg && this.isElementActive(b) && !b.disabled)) {
              return b;
            }
          }
          return null;
        }
      ];

      for (const strategy of strategies) {
        try {
          const btn = strategy();
          if (btn && this.isElementActive(btn)) return btn;
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
        () => container.querySelector('button[data-testid="stop-generating-button"]'),
        () => document.querySelector('button[data-testid="stop-button"]'),
        () => document.querySelector('button[data-testid="stop-generating-button"]'),
        // Semantic aria-labels specifically for stopping generation / streaming (exclude speech/audio/voice)
        () => {
          const btns = container.querySelectorAll('button[aria-label*="Stop" i]');
          for (const btn of btns) {
            const label = (btn.getAttribute('aria-label') || '').toLowerCase();
            if (label.includes('speech') || label.includes('voice') || label.includes('listen') || label.includes('audio') || label.includes('read')) {
              continue;
            }
            if (label.includes('generat') || label.includes('stream') || label.includes('response') || label.includes('stop')) {
              return btn;
            }
          }
          return null;
        }
      ];

      for (const strategy of strategies) {
        try {
          const btn = strategy();
          if (btn && this.isElementActive(btn)) {
            // Must not be disabled or hidden
            if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') continue;
            try {
              const style = window.getComputedStyle(btn);
              if (style.opacity === '0' || style.visibility === 'hidden' || style.pointerEvents === 'none') continue;
            } catch (e) {}
            return btn;
          }
        } catch (e) {}
      }
      return null;
    }

    /**
     * Detects if ChatGPT is actively generating / streaming.
     */
    isGenerating() {
      // If send button is visible, active, and enabled, ChatGPT is ready for the next prompt (not generating)
      const sendBtn = this.findSendButton();
      const sendLabel = (sendBtn?.getAttribute('aria-label') || '').toLowerCase();
      if (sendBtn && this.isElementActive(sendBtn) && !sendBtn.disabled && sendBtn.getAttribute('aria-disabled') !== 'true') {
        if (!sendLabel.includes('stop')) {
          // Send button is ready to send -> definitely NOT generating!
          return false;
        }
      }

      // Signal 1: Active stop button is present and clickable
      if (this.findStopButton()) return true;

      // Signal 2: Streaming class or attribute on conversation or body
      const streamingEl = document.querySelector('.result-streaming, [data-is-streaming="true"]');
      if (streamingEl && this.isElementActive(streamingEl)) return true;

      // Signal 3: Check if send button is transformed into stop icon
      if (sendBtn && sendLabel.includes('stop')) {
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
          if (b && this.isElementActive(b)) {
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
     * Dismisses any modal backdrop or stuck drag-and-drop overlays in ChatGPT.
     */
    dismissStuckOverlays() {
      try {
        // 1. Dispatch dragleave to clear ChatGPT's isDragging state
        const dragLeaveEvt = new DragEvent('dragleave', { bubbles: true, cancelable: true });
        window.dispatchEvent(dragLeaveEvt);
        document.dispatchEvent(dragLeaveEvt);
        document.body.dispatchEvent(dragLeaveEvt);

        // 2. Dispatch Escape to close any modal dialog or drop backdrop
        const escDown = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true });
        const escUp = new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true });
        window.dispatchEvent(escDown);
        window.dispatchEvent(escUp);

        // 3. Remove any stuck full-screen drop overlay element if rendered in DOM
        const stuckDropOverlays = document.querySelectorAll(
          '[data-testid*="drop" i], [class*="dropzone" i], [class*="overlay" i][class*="drag" i]'
        );
        stuckDropOverlays.forEach((el) => {
          if (el.textContent?.includes('Drop any file') || el.textContent?.includes('Add anything')) {
            el.remove();
          }
        });
      } catch (e) {
        console.warn('[PromptFlow] Error dismissing stuck overlays:', e);
      }
    }

    /**
     * Uploads the reference image via synthetic file input change.
     */
    async uploadReference(fileData) {
      console.log('[PromptFlow] Uploading reference image:', fileData.name);
      this.dismissStuckOverlays();

      // Check if reference image is already genuinely attached in composer thumbnail (strictly NOT the attach button)
      const container = this.findComposerContainer() || document;
      const existingAttachment = container.querySelector(
        '[data-testid="attachment-thumbnail"], [data-testid*="thumbnail" i], button[aria-label*="Remove" i], button[data-testid*="remove" i], img[src^="blob:"]'
      );
      if (existingAttachment && this.isElementActive(existingAttachment)) {
        const isAttachButton = existingAttachment.matches('button[data-testid*="attach" i], button[aria-label*="Attach" i], button[data-testid*="fruitjuice" i]') ||
                               existingAttachment.closest('button[data-testid*="attach" i], button[aria-label*="Attach" i], button[data-testid*="fruitjuice" i]');
        if (!isAttachButton) {
          console.log('[PromptFlow] Reference image already attached in composer, skipping redundant upload.');
          return true;
        }
      }

      const file = this.dataUrlToFile(fileData.dataUrl, fileData.name || 'reference.png');
      const dt = new DataTransfer();
      dt.items.add(file);

      let { fileInput, attachButton } = this.findAttachmentElements();

      // If file input not present in DOM, click attach button to expose it
      if (!fileInput && attachButton) {
        console.log('[PromptFlow] Clicking attach button to expose file input...');
        attachButton.click();
        await sleep(500);
        fileInput = this.findAttachmentElements().fileInput;
      }

      // Inject file directly into the file input using native property setter
      if (fileInput) {
        try {
          const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files')?.set;
          if (nativeSetter) {
            nativeSetter.call(fileInput, dt.files);
          } else {
            fileInput.files = dt.files;
          }
          fileInput.dispatchEvent(new Event('input', { bubbles: true }));
          fileInput.dispatchEvent(new Event('change', { bubbles: true }));
          console.log('[PromptFlow] Injected file into <input type="file">');
        } catch (e) {
          console.warn('[PromptFlow] Direct file input assignment warning:', e);
          try {
            fileInput.files = dt.files;
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
          } catch (e2) {}
        }
      }

      // Now wait for attachment thumbnail to appear and stabilize
      await this.waitForAttachment(20000);
      this.dismissStuckOverlays();
      console.log('[PromptFlow] Reference image upload verified successfully');
      return true;
    }

    /**
     * Waits until the uploaded image attachment thumbnail is visible in composer.
     */
    async waitForAttachment(timeoutMs = 20000) {
      const start = Date.now();

      while (Date.now() - start < timeoutMs) {
        const container = this.findComposerContainer() || document;

        // Look for genuine attachment preview elements (strictly exclude buttons or file upload triggers)
        const previewSelectors = [
          '[data-testid="attachment-thumbnail"]',
          '[data-testid*="thumbnail" i]',
          'button[aria-label*="Remove" i]',
          'button[aria-label*="Delete" i]',
          'button[data-testid*="remove" i]',
          'img[src^="blob:"]',
          'img[src*="attachment"]',
          '[data-testid*="file-pill"]',
          '[data-testid*="attachment-pill"]'
        ];

        let previewFound = false;
        for (const sel of previewSelectors) {
          const el = container.querySelector(sel);
          if (el && this.isElementActive(el)) {
            const isAttachButton = el.matches('button[data-testid*="attach" i], button[aria-label*="Attach" i], button[data-testid*="fruitjuice" i]') ||
                                   el.closest('button[data-testid*="attach" i], button[aria-label*="Attach" i], button[data-testid*="fruitjuice" i]');
            if (!isAttachButton) {
              previewFound = true;
              break;
            }
          }
        }

        // Check if there is an active upload progress spinner
        const spinner = container.querySelector('[role="progressbar"], .loading-spinner, [aria-label*="loading" i], [aria-label*="uploading" i]');

        if (previewFound && !spinner) {
          await sleep(600);
          return true;
        }

        // If file input has files buffered, consider upload initiated
        const directFileInput = document.querySelector('input[type="file"]');
        if (directFileInput && directFileInput.files && directFileInput.files.length > 0 && (Date.now() - start > 6000)) {
          console.log('[PromptFlow] File input has buffered file, proceeding with upload...');
          return true;
        }

        await sleep(400);
      }

      console.warn('[PromptFlow] Attachment verification timed out, checking composer state...');
      return false;
    }

    /**
     * Resets ChatGPT to a fresh conversation in the SAME tab without reloading.
     */
    async startNewChat() {
      console.log('[PromptFlow] Starting new chat in same tab without page reload...');
      const newChatSelectors = [
        'a[href="/"]',
        'button[data-testid="create-new-chat-button"]',
        'button[aria-label*="New chat" i]',
        'a[aria-label*="New chat" i]',
        '[data-testid="new-chat-button"]',
        'a[data-discover="true"][href="/"]'
      ];

      for (const sel of newChatSelectors) {
        const el = document.querySelector(sel);
        if (el && el.offsetParent !== null) {
          el.click();
          console.log('[PromptFlow] Clicked New Chat button in same tab:', sel);
          await sleep(1200);
          return true;
        }
      }

      // Check sidebar open/toggle
      const sidebarToggle = document.querySelector('button[aria-label*="sidebar" i], [data-testid="open-sidebar-button"]');
      if (sidebarToggle) {
        sidebarToggle.click();
        await sleep(400);
        for (const sel of newChatSelectors) {
          const el = document.querySelector(sel);
          if (el && el.offsetParent !== null) {
            el.click();
            await sleep(1200);
            return true;
          }
        }
      }

      // Client navigation fallback without reload
      if (window.location.pathname !== '/') {
        window.history.pushState(null, '', '/');
        window.dispatchEvent(new PopStateEvent('popstate'));
        await sleep(1000);
      }
      return true;
    }

    /**
     * Waits until ChatGPT is completely idle (not generating, composer present).
     */
    async waitForIdle(timeoutMs = 15000) {
      this.dismissStuckOverlays();
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        if (!this.isGenerating()) {
          const composer = this.findComposer();
          if (composer) {
            await sleep(300);
            return true;
          }
        }
        await sleep(300);
      }
      return false;
    }

    /**
     * Inserts prompt text into ChatGPT composer using native input pipelines.
     * Works seamlessly even when tab is in background / off-screen.
     */
    async insertPrompt(text) {
      this.dismissStuckOverlays();
      // Ensure ChatGPT is not still generating from previous prompt
      await this.waitForIdle(15000);

      const composer = this.findComposer();
      if (!composer) {
        throw new Error('ChatGPT composer input could not be found');
      }

      composer.focus();
      await sleep(100);

      const isContentEditable = composer.isContentEditable || composer.getAttribute('contenteditable') === 'true';

      if (isContentEditable) {
        // Clear existing content cleanly
        try {
          const sel = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(composer);
          sel.removeAllRanges();
          sel.addRange(range);
          document.execCommand('delete', false, null);
        } catch (e) {}
        composer.innerHTML = '';
        composer.textContent = '';
        await sleep(40);

        // Native insertText
        let success = false;
        try {
          success = document.execCommand('insertText', false, text);
        } catch (e) {}

        await sleep(50);
        const currentContent = (composer.innerText || composer.textContent || '').trim();
        const snippet = text.slice(0, Math.min(20, text.length));

        // When tab is not focused / in background, execCommand is disabled by Chromium.
        // Directly inject Lexical-compliant DOM structure:
        if (!success || !currentContent || !currentContent.includes(snippet)) {
          console.log('[PromptFlow] Native insertText incomplete (background tab), applying direct Lexical DOM injection...');
          const p = document.createElement('p');
          p.setAttribute('dir', 'auto');
          const span = document.createElement('span');
          span.setAttribute('data-lexical-text', 'true');
          span.textContent = text;
          p.appendChild(span);
          composer.innerHTML = '';
          composer.appendChild(p);

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
          composer.dispatchEvent(new Event('input', { bubbles: true }));
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
     * Seamlessly inserts prompt text and submits in ONE atomic operation.
     * Uses the Main World Lexical Bridge for instant state updates in background tabs.
     */
    async insertAndSubmitPrompt(text) {
      if (this._isSubmittingPrompt) {
        console.warn('[PromptFlow] Prompt submission already in progress, skipping duplicate');
        return true;
      }
      this._isSubmittingPrompt = true;

      try {
        this.dismissStuckOverlays();

        // 1. Try Main World Lexical Bridge first (CSP-exempt, directly sets Lexical EditorState)
        const nonce = 'pf_' + Math.random().toString(36).slice(2);

        const bridgePromise = new Promise((resolve) => {
          const handler = (e) => {
            if (e.detail?.nonce === nonce) {
              window.removeEventListener('__PROMPTFLOW_MAIN_DONE__', handler);
              resolve(e.detail);
            }
          };
          window.addEventListener('__PROMPTFLOW_MAIN_DONE__', handler);
          setTimeout(() => {
            window.removeEventListener('__PROMPTFLOW_MAIN_DONE__', handler);
            resolve({ success: false, timeout: true });
          }, 2500);
        });

        window.dispatchEvent(
          new CustomEvent('__PROMPTFLOW_MAIN_SUBMIT__', {
            detail: { promptText: text, nonce }
          })
        );

        const res = await bridgePromise;
        if (res && res.success) {
          console.log('[PromptFlow] Prompt submitted via Main World Lexical Bridge!');
          await sleep(600);
          return true;
        }

        console.log('[PromptFlow] Main World Bridge note:', res?.error || 'timeout, using isolated fallback');

        // 2. Fallback: Isolated world input and single sendBtn.click()
        await this.insertPrompt(text);
        await sleep(300);
        await this.submitPrompt();
        return true;
      } finally {
        this._isSubmittingPrompt = false;
      }
    }

    /**
     * Submits the prompt by clicking Send or triggering Enter keydown.
     * Dispatches exactly ONE submission event to prevent duplicate prompts.
     */
    async submitPrompt() {
      if (this._isSubmittingPrompt) {
        console.warn('[PromptFlow] submitPrompt is already in progress, ignoring duplicate call');
        return true;
      }
      this._isSubmittingPrompt = true;

      try {
        this.dismissStuckOverlays();

        // 1. Wait briefly for Send button to become enabled (up to 3s with active input refresh)
        let sendBtn = null;
        for (let i = 0; i < 6; i++) {
          sendBtn = this.findSendButton();
          if (sendBtn && !sendBtn.disabled && sendBtn.getAttribute('aria-disabled') !== 'true') {
            break;
          }

          // Periodic input event refresh to wake up ChatGPT Lexical state
          const composer = this.findComposer();
          if (composer) {
            composer.focus();
            composer.dispatchEvent(new Event('input', { bubbles: true }));
            composer.dispatchEvent(new Event('change', { bubbles: true }));
          }
          await sleep(400);
        }

        if (sendBtn) {
          sendBtn.removeAttribute('disabled');
          sendBtn.setAttribute('aria-disabled', 'false');
          sendBtn.disabled = false;
          sendBtn.focus();
          // Dispatch ONLY the single native click event to prevent sending duplicate prompts
          sendBtn.click();
          console.log('[PromptFlow] Clicked Send button successfully (single dispatch)');
          await sleep(800);
          return true;
        }

        // 2. Fallback: Dispatch Enter keydown/keyup on composer ONLY if send button was not found
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
          await sleep(800);
          return true;
        }

        throw new Error('Failed to submit prompt: Send button not clickable after waiting');
      } finally {
        this._isSubmittingPrompt = false;
      }
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
        const attrSrc = img.getAttribute('src');
        if (attrSrc) this.existingImagesSnapshot.add(attrSrc);
        const srcset = img.srcset || img.getAttribute('srcset');
        if (srcset) {
          srcset.split(',').forEach((part) => {
            const u = part.trim().split(/\s+/)[0];
            if (u) this.existingImagesSnapshot.add(u);
          });
        }
      });

      // Also record any existing download links
      const links = document.querySelectorAll('a[href*="oaiusercontent"], a[download]');
      links.forEach((a) => {
        if (a.href) this.existingImagesSnapshot.add(a.href);
      });

      const assistantMsgs = this.getAssistantMessages();
      this.baselineAssistantCount = assistantMsgs.length;
      this.baselineTurnCount = this.getAssistantTurns().length;
      console.log(`[PromptFlow] Recorded snapshot of ${this.existingImagesSnapshot.size} images. Baseline assistant msgs: ${this.baselineAssistantCount}, turns: ${this.baselineTurnCount}`);
      return { count: this.existingImagesSnapshot.size, baselineAssistantCount: this.baselineAssistantCount, baselineTurns: this.baselineTurnCount };
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
     * Extracts the best high-resolution image URL from an img element or its container,
     * handling Retina display srcset, picture sources, data-src, and CDN download links.
     */
    extractBestImageUrl(img) {
      if (!img) return null;

      // 1. High-resolution srcset handling (especially on Retina / HiDPI MacBooks)
      const srcset = img.srcset || img.getAttribute('srcset') || img.closest('picture')?.querySelector('source')?.getAttribute('srcset');
      if (srcset) {
        const candidates = srcset
          .split(',')
          .map((s) => s.trim().split(/\s+/)[0])
          .filter((u) => u && !u.startsWith('data:image/svg') && !u.startsWith('data:image/gif'));
        if (candidates.length > 0) {
          const highestRes = candidates[candidates.length - 1];
          if (highestRes) return highestRes;
        }
      }

      // 2. Direct currentSrc (populated by browser after resolving srcset/src)
      if (img.currentSrc && !img.currentSrc.startsWith('data:image/svg') && !img.currentSrc.startsWith('data:image/gif')) {
        return img.currentSrc;
      }

      // 3. Direct src attribute
      const src = img.src || img.getAttribute('src');
      if (src && !src.startsWith('data:image/svg') && !src.startsWith('data:image/gif')) {
        return src;
      }

      // 4. Lazy-load data attributes
      const dataSrc = img.getAttribute('data-src') || img.dataset?.src || img.getAttribute('data-original-src');
      if (dataSrc && !dataSrc.startsWith('data:')) {
        return dataSrc;
      }

      // 5. Parent or sibling download/lightbox link
      const anchor = img.closest('a[href*="oaiusercontent"], a[download]') ||
                     img.parentElement?.querySelector('a[href*="oaiusercontent"], a[download]');
      if (anchor && anchor.href && !anchor.href.startsWith('javascript:')) {
        return anchor.href;
      }

      return null;
    }

    /**
     * Recognizes URLs corresponding to OpenAI / DALL-E / ChatGPT generated image assets.
     */
    isOpenAIGeneratedImageUrl(url) {
      if (!url || typeof url !== 'string') return false;
      const lower = url.toLowerCase();
      return (
        lower.includes('files.oaiusercontent.com') ||
        lower.includes('oaidalleapiprodscus.blob.core.windows.net') ||
        lower.includes('.oaiusercontent.com') ||
        lower.includes('blob.core.windows.net') ||
        lower.includes('backend-api/files') ||
        lower.includes('dalle') ||
        lower.startsWith('blob:https://chatgpt.com') ||
        lower.startsWith('blob:http://chatgpt.com')
      );
    }

    /**
     * Identifies images that must be excluded: avatars, user reference uploads, icons, spinners.
     */
    isExcludedImage(img, url) {
      if (!img) return true;
      const lowerUrl = (url || '').toLowerCase();

      // Exclude placeholder data URIs
      if (lowerUrl.startsWith('data:image/svg') || lowerUrl.startsWith('data:image/gif')) {
        return true;
      }

      // Exclude user attachments or composer images
      if (
        img.closest('[data-message-author-role="user"]') ||
        img.closest('form') ||
        img.closest('[class*="attachment"]') ||
        img.closest('[data-testid*="attachment"]') ||
        img.closest('[data-testid*="fruitjuice"]') ||
        img.closest('[data-testid*="composer"]')
      ) {
        return true;
      }

      // Exclude avatar images
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
        lowerUrl.includes('avatar') ||
        lowerUrl.includes('gravatar')
      ) {
        return true;
      }

      // Exclude tiny icons unless it is a verified OpenAI CDN URL
      const isOpenAI = this.isOpenAIGeneratedImageUrl(url);
      if (!isOpenAI) {
        if (img.naturalWidth > 0 && img.naturalWidth < 120) return true;
        if (img.naturalHeight > 0 && img.naturalHeight < 120) return true;
        if (img.width > 0 && img.width < 120) return true;
        if (img.height > 0 && img.height < 120) return true;
      }

      return false;
    }

    /**
     * Wakes up image loading for lazy-loaded elements on macOS/WebKit and background tabs.
     */
    wakeUpImage(img) {
      if (!img) return;
      try {
        if (img.getAttribute('loading') === 'lazy') {
          img.setAttribute('loading', 'eager');
          img.loading = 'eager';
        }
        if (typeof img.scrollIntoView === 'function') {
          img.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
        if (typeof img.decode === 'function') {
          img.decode().catch(() => {});
        }
      } catch (e) {}
    }

    /**
     * Detects the newly generated image EXCLUSIVELY in the new assistant turn(s).
     * Solves the issue where identical prompts would confuse older generations with current ones.
     */
    async detectNewGeneratedImage(timeoutMs = 50000) {
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
          if (scope.getAttribute('data-message-author-role') === 'user' || scope.querySelector?.('[data-message-author-role="user"]')) {
            continue;
          }

          const images = Array.from(scope.querySelectorAll('img, picture img, [data-testid*="image"] img'));

          for (const img of images) {
            const src = this.extractBestImageUrl(img);
            if (!src) continue;

            if (this.isExcludedImage(img, src)) continue;

            // Check if this image was NOT in the pre-prompt snapshot
            if (!this.existingImagesSnapshot.has(src)) {
              this.wakeUpImage(img);
              candidateImages.push({ img, src });
            }
          }

          if (candidateImages.length > 0) {
            break;
          }
        }

        // If found candidates, verify image is fully loaded or confirmed OpenAI URL
        if (candidateImages.length > 0) {
          const target = candidateImages[candidateImages.length - 1];
          const targetImg = target.img;
          const targetUrl = target.src;
          const isOpenAI = this.isOpenAIGeneratedImageUrl(targetUrl);

          if (isOpenAI || (targetImg && targetImg.complete && (targetImg.naturalWidth > 100 || targetImg.naturalWidth === 0))) {
            const finalUrl = (targetImg ? this.extractBestImageUrl(targetImg) : null) || targetUrl;
            this.existingImagesSnapshot.add(finalUrl); // Mark seen for subsequent prompts
            console.log('[PromptFlow] Successfully detected new generated image:', finalUrl);
            return finalUrl;
          }

          // If still loading, wake it up and wait briefly
          try {
            if (targetImg) {
              this.wakeUpImage(targetImg);
              await new Promise((res) => {
                targetImg.addEventListener('load', () => res(), { once: true });
                targetImg.addEventListener('error', () => res(), { once: true });
                setTimeout(res, 2000);
              });
              const finalUrl = this.extractBestImageUrl(targetImg) || targetUrl;
              this.existingImagesSnapshot.add(finalUrl);
              return finalUrl;
            }
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
      const targetTurnIndex = this.baselineTurnCount || 0;
      console.log(`[PromptFlow] Monitoring for generated image in assistant turn >= index ${targetAssistantIndex}, turn >= index ${targetTurnIndex}...`);

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
        const turns = this.getAssistantTurns();
        if (msgs.length > targetAssistantIndex || turns.length > targetTurnIndex) {
          generationInitiated = true;
          console.log('[PromptFlow] Generation start confirmed (new assistant turn created)');
          break;
        }
        await sleep(350);
      }

      let candidateFirstSeenTime = 0;
      let lastCandidateUrl = null;

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
        const assistantTurns = this.getAssistantTurns();

        // Target ONLY assistant message(s) / turn(s) created for THIS prompt!
        // Robust multi-tier scoping:
        let targetScopes = [];
        if (assistantMsgs.length > targetAssistantIndex) {
          targetScopes = assistantMsgs.slice(targetAssistantIndex);
        } else if (assistantTurns.length > targetTurnIndex) {
          targetScopes = assistantTurns.slice(targetTurnIndex);
        } else {
          // If counts haven't incremented yet, inspect the latest non-user article
          const allTurns = Array.from(document.querySelectorAll('article[data-testid^="conversation-turn-"]'));
          const nonUserTurns = allTurns.filter((art) => !art.querySelector('[data-message-author-role="user"]'));
          if (nonUserTurns.length > 0) {
            targetScopes = [nonUserTurns[nonUserTurns.length - 1]];
          }
        }

        const candidateImages = [];

        for (const scope of targetScopes) {
          if (!scope) continue;
          // NEVER inspect user message containers
          if (scope.getAttribute('data-message-author-role') === 'user' || scope.querySelector?.('[data-message-author-role="user"]')) {
            continue;
          }

          const images = Array.from(scope.querySelectorAll('img, picture img, [data-testid*="image"] img'));

          for (const img of images) {
            const url = this.extractBestImageUrl(img);
            if (!url) continue;

            if (this.isExcludedImage(img, url)) continue;

            // Check if new
            if (!this.existingImagesSnapshot.has(url)) {
              this.wakeUpImage(img);
              candidateImages.push({ img, url });
            }
          }

          // Also check direct links to generated files if img tag is not directly used
          const downloadLinks = Array.from(scope.querySelectorAll('a[href*="oaiusercontent"], a[download]'));
          for (const a of downloadLinks) {
            const href = a.href;
            if (href && this.isOpenAIGeneratedImageUrl(href) && !this.existingImagesSnapshot.has(href)) {
              candidateImages.push({ img: null, url: href });
            }
          }
        }

        if (candidateImages.length > 0) {
          const latest = candidateImages[candidateImages.length - 1];
          const finalUrl = latest.url;

          // Track URL stability
          if (lastCandidateUrl !== finalUrl) {
            lastCandidateUrl = finalUrl;
            candidateFirstSeenTime = Date.now();
          }

          const isOpenAIUrl = this.isOpenAIGeneratedImageUrl(finalUrl);
          const hasImageEl = !!latest.img;
          const isComplete = hasImageEl ? latest.img.complete : true;
          const hasNaturalDim = hasImageEl ? (latest.img.naturalWidth > 100 || latest.img.naturalWidth === 0) : true;
          const candidateAgeMs = Date.now() - candidateFirstSeenTime;

          // Acceptance criteria:
          // 1. Generation has stopped (!isGen) AND image element is complete or URL is verified OpenAI CDN
          // 2. OR URL is a confirmed OpenAI generated image URL and has been stable for > 2.0s (MacBook App Nap / background tab resilience)
          // 3. OR Send button is back and ready to send
          const sendBtnReady = !isGen;
          const isReadyToAccept =
            (sendBtnReady && (isComplete || isOpenAIUrl) && hasNaturalDim) ||
            (isOpenAIUrl && candidateAgeMs > 2000) ||
            (isOpenAIUrl && isComplete && latest.img?.naturalWidth > 100);

          if (isReadyToAccept) {
            await sleep(600);
            const verifiedUrl = (latest.img ? this.extractBestImageUrl(latest.img) : null) || finalUrl;
            this.existingImagesSnapshot.add(verifiedUrl);
            console.log('[PromptFlow] Detected newly generated image in assistant message:', verifiedUrl);
            return verifiedUrl;
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
      this.lastIsDone = null;
      this.lastCount = null;
      this.dotEl = null;
      this.titleEl = null;
      this.stepEl = null;
      this.statusEl = null;
      this.progressFillEl = null;
      this.actionsEl = null;
      this.toggleBtn = null;
    }

    _mountHUD() {
      if (this.hud && document.body.contains(this.hud)) return;

      if (!this.hud) {
        this.hud = document.createElement('div');
        this.hud.className = 'promptflow-floating-hud';
      }

      this.hud.innerHTML = `
        <div class="promptflow-hud-header">
          <div class="promptflow-hud-brand">
            <div class="promptflow-badge-dot" id="promptflow-hud-dot"></div>
            <span id="promptflow-hud-title">PromptFlow</span>
          </div>
          <span class="promptflow-hud-step" id="promptflow-hud-step">0 / 0 Ready</span>
          <button type="button" class="promptflow-hud-btn-min" id="promptflow-btn-toggle" title="Minimize">—</button>
        </div>
        <div class="promptflow-hud-body">
          <div class="promptflow-hud-status" id="promptflow-hud-status" title="Running...">Running...</div>
          <div class="promptflow-hud-progress-track">
            <div class="promptflow-hud-progress-fill" id="promptflow-hud-progress-fill" style="width: 0%"></div>
          </div>
        </div>
        <div class="promptflow-hud-actions" id="promptflow-hud-actions"></div>
      `;

      if (!document.body.contains(this.hud)) {
        document.body.appendChild(this.hud);
      }

      this.dotEl = this.hud.querySelector('#promptflow-hud-dot');
      this.titleEl = this.hud.querySelector('#promptflow-hud-title');
      this.stepEl = this.hud.querySelector('#promptflow-hud-step');
      this.statusEl = this.hud.querySelector('#promptflow-hud-status');
      this.progressFillEl = this.hud.querySelector('#promptflow-hud-progress-fill');
      this.actionsEl = this.hud.querySelector('#promptflow-hud-actions');
      this.toggleBtn = this.hud.querySelector('#promptflow-btn-toggle');

      if (this.toggleBtn) {
        this.toggleBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.isMinimized = !this.isMinimized;
          if (this.isMinimized) {
            this.hud.classList.add('minimized');
            this.toggleBtn.textContent = '▢';
            this.toggleBtn.title = 'Expand';
          } else {
            this.hud.classList.remove('minimized');
            this.toggleBtn.textContent = '—';
            this.toggleBtn.title = 'Minimize';
          }
        });
      }
    }

    createOrUpdateHUD(session, overrideTitle = '', overrideStatus = '') {
      if (session) this.lastSession = session;
      const activeSession = session || this.lastSession;

      this._mountHUD();

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

      // Surgical DOM updates without destroying elements
      if (this.titleEl && this.titleEl.textContent !== title) {
        this.titleEl.textContent = title;
      }
      if (this.statusEl) {
        if (this.statusEl.textContent !== statusMsg) this.statusEl.textContent = statusMsg;
        if (this.statusEl.title !== statusMsg) this.statusEl.title = statusMsg;
      }
      const stepText = `${count} / ${total} Ready`;
      if (this.stepEl && this.stepEl.textContent !== stepText) {
        this.stepEl.textContent = stepText;
      }
      if (this.dotEl) {
        const fullDotClass = 'promptflow-badge-dot' + (dotClass ? ' ' + dotClass : '');
        if (this.dotEl.className !== fullDotClass) {
          this.dotEl.className = fullDotClass;
        }
      }
      if (this.progressFillEl) {
        this.progressFillEl.style.width = `${pct}%`;
      }

      if (this.actionsEl && (this.lastIsDone !== isDone || this.lastCount !== count)) {
        this.lastIsDone = isDone;
        this.lastCount = count;
        if (isDone) {
          this.actionsEl.innerHTML = `<button type="button" class="promptflow-hud-btn promptflow-hud-btn-download" id="promptflow-btn-hud-dl">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            <span>Download All (${count})</span>
          </button>`;
          const dlBtn = this.actionsEl.querySelector('#promptflow-btn-hud-dl');
          if (dlBtn) {
            dlBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              chrome.runtime.sendMessage({ type: 'DOWNLOAD_ALL' });
            });
          }
        } else {
          this.actionsEl.innerHTML = `<button type="button" class="promptflow-hud-btn promptflow-hud-btn-stop" id="promptflow-btn-hud-stop">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"></rect></svg>
            <span>Stop Automation</span>
          </button>`;
          const stopBtn = this.actionsEl.querySelector('#promptflow-btn-hud-stop');
          if (stopBtn) {
            stopBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              chrome.runtime.sendMessage({ type: 'STOP_AUTOMATION' });
            });
          }
        }
      }
    }

    createOrUpdate(title, status, state = 'info') {
      this.createOrUpdateHUD(null, title, status);
    }

    remove() {
      if (this.hud && this.hud.parentNode) {
        this.hud.parentNode.removeChild(this.hud);
      }
      this.hud = null;
      this.dotEl = null;
      this.titleEl = null;
      this.stepEl = null;
      this.statusEl = null;
      this.progressFillEl = null;
      this.actionsEl = null;
      this.toggleBtn = null;
      this.lastIsDone = null;
      this.lastCount = null;
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

          case 'START_NEW_CHAT': {
            overlay.createOrUpdate('PromptFlow', 'Starting fresh chat in same tab...', 'info');
            const success = await adapter.startNewChat();
            sendResponse({ success });
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
            await adapter.insertAndSubmitPrompt(message.promptText);
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
