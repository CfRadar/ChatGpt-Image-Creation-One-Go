# PromptFlow - ChatGPT Image Automation Extension

Production-ready **Chrome / Chromium Manifest V3 browser extension** that automates repetitive multi-prompt ChatGPT image generation workflows using a user-provided reference image, with automatic downloads and verified state tracking.

---

## ⚡ Features

- **Individual Image Customization & Per-Design Overrides**:
  - Configure **Model** (Female/Male), **Garment / Fit Typebox**, **Framing / Zoom**, and **Angle Preset Set** independently for each individual image in the queue.
  - **Interactive Inline Queue Cards**: Each design in the queue displays dedicated mini controls right on its card for immediate per-image adjustments.
  - **Active Design Sync**: Clicking any design card sets it as the active target in the top Customizer bar; adjustments made there update that specific design's prompt queue.
  - **Sync to All Images**: Single-click button to propagate the current configuration across all designs in the queue at once.
- **Dynamic Garment / Fit Typebox (Type "same" for Hoodie, Jacket, or Anything)**:
  - Replaced rigid dropdowns with an intelligent text typebox with autocomplete suggestions.
  - **`same`**: Automatically instructs ChatGPT to replicate the exact garment silhouette, cut, hood/collar, drape, and construction visibly shown in the reference image—whether it is a **hoodie, pullover, sweatshirt, jacket, t-shirt, polo, or tank top**—without altering or forcing it into a T-shirt.
  - **Custom Apparel & Fits**: Type custom entries like `hoodie`, `oversized hoodie`, `varsity jacket`, `crop hoodie`, `sweatshirt`, `oversized`, `normal`, `boxy`, or `polo`. The prompt compiler dynamically adapts terminology and macro close-ups (e.g. hood and drawstrings for hoodies, polo collar and placket for polos).
- **30 Catalog Poses: 3 Angles × 10 Preset Sets**:
  - **Angle 1 (Front)**: Model facing camera prominently displaying the printed graphic/design on the front of the garment (10 distinct front poses).
  - **Angle 2 (Back)**: Model facing away displaying the clean back of the garment with NO graphic print (10 distinct back poses).
  - **Angle 3 (Side)**: Model in clean 90° profile or 45° dynamic turn displaying the side drape, sleeve length, and garment cut (10 distinct side poses).
  - **Smooth Queue Rotation**: Design 1 receives Preset Set 1 (Front 1, Back 1, Side 1), Design 2 receives Preset Set 2 (Front 2, Back 2, Side 2), ..., cycling through all 10 complementary angle combinations across queue items.
- **One Continuous Chat Execution (No New Chats Between Designs)**:
  - Automates all uploaded reference designs sequentially right inside **one single continuous conversation thread**.
  - Reference images for subsequent designs are uploaded directly into the ongoing chat, maintaining fluid continuity without opening or starting new chats.
- **Off-Screen & Background Tab Resilience**:
  - Operates reliably even when the ChatGPT tab is **not on screen, minimized, or in the background**.
  - Protects against background timer throttling and uses layout-independent element queries (`isElementActive`) that do not rely on `offsetParent`.
  - Sets `autoDiscardable: false` on the ChatGPT tab to prevent Chromium from freezing or discarding it during background execution.
  - Generates comprehensive DOM input events and native mouse dispatching for prompt insertion and submission.
- **Robust Prompt Execution (No Middle Prompt Skipping)**:
  - Eliminates prompt skipping with composer idle-polling (up to 25s for Send button readiness) and safe cooldown delays between prompts.
  - Multi-attempt resilience (up to 3 retries) ensures every prompt is submitted reliably.
- **Flexible Image Naming (`name_x` vs `image_x_x`)**:
  - **Custom Name Provided**: Name each uploaded design individually on its card or globally via the Prefix box. Files are saved as `${name}_1.png`, `${name}_2.png`, etc.
  - **No Name Provided**: If left empty, files automatically use `image_x_x.png` format (`image_${designNumber}_${promptNumber}.png`, e.g. `image_1_1.png`, `image_1_2.png`, `image_2_1.png`).
- **One-Time Single Consolidated ZIP Download**:
  - Eliminates repetitive intermediate downloads! All generated images across all designs are downloaded **exactly one time at the end in a single consolidated ZIP archive** (`all_generated_images.zip` or `${prefix}_all_images.zip`) with zero manual clicks required.
- **Multi-Image Reference Queue**:
  - Drag and drop one or multiple reference designs simultaneously.
  - Each design queue item retains its own assigned rotating poses, individual configuration, and 6 compiled prompts.
- **Automated Workflow Orchestration**:
  - Automatically identifies or launches an active ChatGPT tab (`chatgpt.com`).
  - **Single Upload per Chat**: Uploads the reference image once at the beginning of each design session; subsequent prompts in the queue reuse the ongoing conversation context.
  - **Identical Prompt Disambiguation**: Tracks assistant baseline turn count (`initialTurnCount`) and DOM changes to ensure identical or sequential prompts never mistake a previous turn's generation for the current one.
  - Dispatches each prompt sequentially through native DOM input pipelines (`document.execCommand('insertText')` + `InputEvent`).
  - Detects generation lifecycle events (streaming flags, stop button states, mutation debouncing) without fragile arbitrary fixed sleeps.
  - Differentially isolates newly generated images from avatars, UI icons, and older turns.
- **Developer-Grade Dark UI**:
  - Quick Customizer Bar at the top of the popup for instant model, fit, and zoom adjustments.
  - Interactive Queue list cards with design thumbnails, assigned pose chips, status tags, and individual ZIP download buttons.
  - Progress summary, settings overlay, session history, and live debug log console.

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
