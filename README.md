# PromptFlow - ChatGPT Image Automation Extension

Production-ready **Chrome / Chromium Manifest V3 browser extension** that automates repetitive multi-prompt ChatGPT image generation workflows using a user-provided reference image, with automatic downloads and verified state tracking.

---

## ⚡ Features

- **Automated Workflow Orchestration**:
  - Automatically identifies or launches an active ChatGPT tab (`chatgpt.com`).
  - **Single Upload per Chat**: Uploads the reference image once at the beginning of the chat session; subsequent prompts in the queue reuse the ongoing conversation context.
  - Automatically waits for attachment stabilization before submitting prompt 1.
  - **Identical Prompt Disambiguation**: Tracks assistant baseline turn count (`initialTurnCount`) and DOM changes to ensure identical or sequential prompts never mistake a previous turn's generation for the current one.
  - Dispatches each prompt sequentially through native DOM input pipelines (`document.execCommand('insertText')` + `InputEvent`).
  - Detects generation lifecycle events (streaming flags, stop button states, mutation debouncing) without fragile arbitrary fixed sleeps.
  - Differentially isolates newly generated images from avatars, UI icons, and older turns.
  - **Batch Download All (`name_X`)**: Once all images are generated, click **DOWNLOAD ALL** to save every generated image at once named `name_1.png`, `name_2.png`, ..., `name_X.png` (with configurable base name prefix).
  - Waits for configured cooldown delays between prompts and automatically initiates the next prompt.
- **Robust Multi-Strategy ChatGPT DOM Adapter**:
  - Resilient to ChatGPT UI changes: tests across multiple semantic selectors, aria-labels, placeholder texts, and fallback elements for composer, attachments, and send/stop controls.
- **Persistent State & Resilient Background Architecture**:
  - Managed by a Manifest V3 Service Worker.
  - If the popup window is closed, the automation continues uninterrupted in the background.
  - State is saved in `chrome.storage.local` at each transition step.
  - Live state syncs immediately whenever the popup is reopened.
- **Per-Prompt Retry System**:
  - Independent retry tracking (up to 3 retries per prompt) so one temporary failure does not crash the entire 6-prompt queue.
  - Graceful stop and resume capabilities.
- **Developer-Grade Dark UI**:
  - Drag-and-drop reference image uploader with preview thumbnail.
  - 6 prompt slots with live character counters, enable/disable toggles, and individual clear buttons.
  - Visual progress bar and detailed per-prompt status badges (Waiting, Uploading, Generating, Detecting, Downloading, Completed, Failed, Skipped).
  - Built-in Settings panel (timeout, retries, inter-prompt delay, download folder patterns).
  - Session History panel (timestamps, durations, completed prompt metrics).
  - Real-time Debug Log Console (log level filters, copy to clipboard).
- **Security & Privacy First**:
  - Never collects or transmits ChatGPT credentials, cookies, tokens, or prompt data to any external server.
  - Runs 100% locally in your browser.

---

## 📁 Project Structure

```text
PromptFlow/
├── manifest.json            # Chrome MV3 manifest configuration
├── package.json             # Project metadata & icon generator scripts
├── background/
│   └── service-worker.js    # State machine orchestrator & background engine
├── content/
│   ├── chatgpt.js           # Multi-strategy ChatGPT DOM adapter & messaging
│   └── chatgpt.css          # Subtle floating status badge on ChatGPT tab
├── popup/
│   ├── popup.html           # Dark professional developer popup UI
│   ├── popup.css            # Dark theme styles & slide-over overlays
│   └── popup.js             # Live state controller & user interactions
├── utils/
│   ├── storage.js           # chrome.storage.local wrapper (session, settings, history)
│   ├── downloader.js        # Safe filename slugifier & verified Chrome downloader
│   └── logger.js            # Centralized logger with memory buffer & storage
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   ├── icon128.png
│   └── icon.svg
├── test/
│   ├── run-tests.js         # Automated test runner (Manifest, Slug, Detection, Retries)
│   ├── simulator.html       # Interactive ChatGPT DOM simulator & test harness
│   └── simulator.js         # Mock generator & state controller for testing
└── README.md
```

---

## 🚀 Installation

1. Clone or copy this repository to your local machine:
   ```text
   d:\GPTImage
   ```
2. Open Google Chrome (or any Chromium browser: Brave, Edge, Opera).
3. Navigate to:
   ```text
   chrome://extensions
   ```
4. In the top right corner, enable **Developer mode** toggle.
5. Click **Load unpacked** in the top left.
6. In the file picker dialog, select the project directory:
   ```text
   d:\GPTImage
   ```
7. The **PromptFlow - ChatGPT Image Automation** extension is now installed and visible in your browser toolbar!

---

## 📖 How to Use

1. **Open ChatGPT**:
   - Go to [https://chatgpt.com](https://chatgpt.com) and log into your account normally.
   - Leave the tab open (PromptFlow will also automatically focus or open this tab when you click START).
2. **Open PromptFlow**:
   - Click the PromptFlow icon in the Chrome toolbar.
3. **Upload Reference Image**:
   - Drag and drop your image (PNG, JPG, JPEG, WEBP) into the upload box or click to select a file.
   - Verify the thumbnail preview appears.
4. **Configure Prompts**:
   - Enter your prompts in slots 01 to 06.
   - You can enter fewer than 6 prompts (e.g. 2 or 3); empty or disabled prompts are automatically skipped.
5. **Click START AUTOMATION**:
   - PromptFlow activates the ChatGPT tab and uploads the reference image **once**.
   - Submits Prompt 1, detects the newly generated image, and updates progress.
   - For Prompts 2 to 6, submits each prompt directly into the ongoing conversation without re-uploading the image.
   - Assistant turn-tracking ensures identical prompts are never confused with previous generations.
6. **Download All at Once (`name_X`)**:
   - As images are generated, thumbnail previews and ready counters appear in the **BATCH DOWNLOAD** panel.
   - Set your preferred base name prefix (default is `name`).
   - Click **DOWNLOAD ALL** to download all generated images at once formatted as:
     ```text
     Downloads/PromptFlow/name_1.png
     Downloads/PromptFlow/name_2.png
     Downloads/PromptFlow/name_3.png
     ...
     ```

---

## ⚙️ Configuration & Settings

Click the **Settings (gear)** icon in the header to configure:

| Setting | Default | Description |
| :--- | :--- | :--- |
| **Generation Timeout** | 5 mins | Maximum time to wait for ChatGPT to finish generating an image. |
| **Download Retries** | 3 | Number of times to retry an interrupted or failing download. |
| **Delay Between Prompts** | 2 sec | Cooldown period before submitting the subsequent prompt. |
| **Download Folder** | `PromptFlow` | Subdirectory inside your browser Downloads directory. |
| **Folder Organization** | `flat` | `flat` (`PromptFlow/01_...png`), `date` (`PromptFlow/YYYY-MM-DD/01_...png`), or `session` (`PromptFlow/session_xxx/01_...png`). |
| **Keep Session History** | `ON` | Records completed session metrics in local storage. |
| **Debug Mode** | `ON` | Outputs detailed step-by-step logs into the Debug Console. |

---

## 🧪 Testing & Debugging

### Automated Test Suite
Run the automated test runner in terminal:
```bash
node test/run-tests.js
```
This tests:
- Manifest V3 structure and permission requirements
- All file existence
- Slugification and illegal character stripping (`/\:*?"<>|`)
- Date and session path formatting
- Differential image detection logic against DOM avatars and icons
- Queue state transitions and independent prompt retry logic

### Interactive ChatGPT UI Simulator
Open `test/simulator.html` in Chrome:
- Emulates ChatGPT's DOM structure (`#prompt-textarea`, `<input type="file">`, send/stop button transitions, attachment previews, and assistant image turns).
- Allows verifying DOM detection and state transitions in a safe offline sandbox without consuming ChatGPT rate limits.

---

## ⚠️ Known Limitations & ChatGPT DOM Changes

1. **User Authentication**:
   - The extension relies on the user already being authenticated in ChatGPT. It does not bypass logins, CAPTCHAs, or Cloudflare verification.
2. **ChatGPT UI Updates**:
   - OpenAI frequently tests different DOM layouts (e.g., swapping between `<textarea>` and `contenteditable` Lexical divs).
   - PromptFlow mitigates this by abstracting all DOM selectors into `ChatGPTAdapter` in `content/chatgpt.js` with 8+ fallback strategies. If OpenAI significantly renames semantic attributes, update the strategies in `ChatGPTAdapter`.
3. **Tab Focus**:
   - While modern Chromium engines handle background tabs, leaving the ChatGPT tab active or visible prevents browser aggressive background throttling of canvas rendering and network streams.

---

## 🛡️ License

MIT License. Local, private, and developer-friendly.
