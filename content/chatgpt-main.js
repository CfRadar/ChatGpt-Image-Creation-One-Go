// content/chatgpt-main.js
// Runs in ChatGPT's MAIN execution world with direct access to Lexical editor state and React DOM.
// Enables seamless, instant prompt insertion and single-click dispatch even when tab is backgrounded / off-screen.

(function () {
  if (window.__promptflow_main_installed) return;
  window.__promptflow_main_installed = true;

  console.log('[PromptFlow Main] Main World Lexical Bridge ready');

  window.addEventListener('__PROMPTFLOW_MAIN_SUBMIT__', async (event) => {
    const { promptText, nonce } = event.detail || {};
    if (!promptText) return;

    try {
      // 1. Locate composer in DOM
      const composer =
        document.querySelector('#prompt-textarea') ||
        document.querySelector('[data-lexical-editor="true"]') ||
        document.querySelector('div[contenteditable="true"]');

      if (!composer) {
        throw new Error('ChatGPT composer input could not be found');
      }

      // 2. Direct Lexical state update if __lexicalEditor is accessible
      const editor = composer.__lexicalEditor;
      let stateUpdated = false;

      if (editor && typeof editor.parseEditorState === 'function') {
        try {
          const stateData = {
            root: {
              children: [
                {
                  children: [
                    {
                      detail: 0,
                      format: 0,
                      mode: 'normal',
                      text: promptText,
                      type: 'text',
                      version: 1
                    }
                  ],
                  direction: 'ltr',
                  format: '',
                  indent: 0,
                  type: 'paragraph',
                  version: 1
                }
              ],
              direction: 'ltr',
              format: '',
              indent: 0,
              type: 'root',
              version: 1
            }
          };

          const newState = editor.parseEditorState(JSON.stringify(stateData));
          editor.setEditorState(newState);
          stateUpdated = true;
          console.log('[PromptFlow Main] Lexical state directly populated via parseEditorState');
        } catch (parseErr) {
          console.warn('[PromptFlow Main] parseEditorState fallback to editor.update:', parseErr);
        }
      }

      if (!stateUpdated) {
        // DOM fallback with Lexical structure
        const p = document.createElement('p');
        p.setAttribute('dir', 'auto');
        const span = document.createElement('span');
        span.setAttribute('data-lexical-text', 'true');
        span.textContent = promptText;
        p.appendChild(span);
        composer.innerHTML = '';
        composer.appendChild(p);
      }

      // Dispatch input events for React & Lexical reconciliation
      composer.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: promptText }));
      composer.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: promptText }));
      composer.dispatchEvent(new Event('input', { bubbles: true }));
      composer.dispatchEvent(new Event('change', { bubbles: true }));

      // 3. Wait for any attachment upload spinner to finish before attempting send
      const uploadTimeout = Date.now() + 15000;
      while (Date.now() < uploadTimeout) {
        const spinner = document.querySelector('[role="progressbar"], .loading-spinner, [aria-label*="loading" i], [aria-label*="uploading" i]');
        if (!spinner) break;
        await new Promise((r) => setTimeout(r, 300));
      }

      // 4. Wait for Send button to be enabled by React
      let sendBtn = null;
      const sendWaitTimeout = Date.now() + 5000;
      while (Date.now() < sendWaitTimeout) {
        sendBtn =
          document.querySelector('button[data-testid="send-button"]') ||
          document.querySelector('button[aria-label*="Send" i]') ||
          document.querySelector('button[data-testid="fruitjuice-send-button"]') ||
          composer.closest('form')?.querySelector('button[type="submit"]');

        if (sendBtn && !sendBtn.disabled && sendBtn.getAttribute('aria-disabled') !== 'true') {
          break;
        }

        composer.dispatchEvent(new Event('input', { bubbles: true }));
        composer.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise((r) => setTimeout(r, 250));
      }

      if (sendBtn) {
        sendBtn.removeAttribute('disabled');
        sendBtn.setAttribute('aria-disabled', 'false');
        sendBtn.disabled = false;
        sendBtn.click();
        console.log('[PromptFlow Main] Send button clicked cleanly (single dispatch)');
      } else {
        // Fallback: Enter key
        const enterEvt = new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true
        });
        composer.dispatchEvent(enterEvt);
      }

      // 5. Verification: Check if prompt was accepted or if composer still holds text
      await new Promise((r) => setTimeout(r, 600));
      const remainingText = (composer.innerText || composer.textContent || '').trim();
      if (remainingText.length > 30) {
        console.log('[PromptFlow Main] Composer text still present, re-triggering Enter fallback');
        const enterEvt = new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true
        });
        composer.dispatchEvent(enterEvt);
        if (sendBtn) sendBtn.click();
        await new Promise((r) => setTimeout(r, 400));
      }

      window.dispatchEvent(
        new CustomEvent('__PROMPTFLOW_MAIN_DONE__', {
          detail: { nonce, success: true }
        })
      );
    } catch (err) {
      console.error('[PromptFlow Main Error]', err);
      window.dispatchEvent(
        new CustomEvent('__PROMPTFLOW_MAIN_DONE__', {
          detail: { nonce, success: false, error: err.message }
        })
      );
    }
  });
})();
