// popup/popup.js
// Main UI Controller for PromptFlow Extension

import storage, {
  AUTOMATION_STATE,
  PROMPT_STATUS,
  createDefaultPrompts,
  DEFAULT_PROMPT_TITLES,
  DEFAULT_PROMPT_TEXTS
} from '../utils/storage.js';
import logger from '../utils/logger.js';

class PopupController {
  constructor() {
    this.session = null;
    this.settings = null;
    this.isRunning = false;
    this.isResetting = false;

    // Cache elements
    this.el = {
      dropZone: document.getElementById('dropZone'),
      fileInput: document.getElementById('fileInput'),
      imagePreviewContainer: document.getElementById('imagePreviewContainer'),
      imageThumbnail: document.getElementById('imageThumbnail'),
      imageFileName: document.getElementById('imageFileName'),
      imageFileSize: document.getElementById('imageFileSize'),
      btnRemoveImage: document.getElementById('btnRemoveImage'),

      promptQueueContainer: document.getElementById('promptQueueContainer'),
      activePromptCounter: document.getElementById('activePromptCounter'),
      btnRestoreDefaults: document.getElementById('btnRestoreDefaults'),
      btnClearAllPrompts: document.getElementById('btnClearAllPrompts'),

      statusIndicatorDot: document.getElementById('statusIndicatorDot'),
      statusText: document.getElementById('statusText'),
      progressSummary: document.getElementById('progressSummary'),
      progressBarFill: document.getElementById('progressBarFill'),
      statusList: document.getElementById('statusList'),

      btnStart: document.getElementById('btnStart'),
      btnStop: document.getElementById('btnStop'),
      btnReset: document.getElementById('btnReset'),
      btnPopOut: document.getElementById('btnPopOut'),

      // Batch Download elements (ZIP & name_X)
      inputBaseName: document.getElementById('inputBaseName'),
      btnDownloadZip: document.getElementById('btnDownloadZip'),
      btnDownloadAll: document.getElementById('btnDownloadAll'),
      batchDownloadCounter: document.getElementById('batchDownloadCounter'),
      batchNamingSample: document.getElementById('batchNamingSample'),
      batchDownloadStatus: document.getElementById('batchDownloadStatus'),

      // Settings overlay
      btnSettings: document.getElementById('btnSettings'),
      settingsView: document.getElementById('settingsView'),
      btnCloseSettings: document.getElementById('btnCloseSettings'),
      btnSaveSettings: document.getElementById('btnSaveSettings'),
      settingTimeout: document.getElementById('settingTimeout'),
      settingRetries: document.getElementById('settingRetries'),
      settingDelay: document.getElementById('settingDelay'),
      settingFolder: document.getElementById('settingFolder'),
      settingFolderPattern: document.getElementById('settingFolderPattern'),
      settingKeepHistory: document.getElementById('settingKeepHistory'),
      settingDebugMode: document.getElementById('settingDebugMode'),

      // History overlay
      btnHistory: document.getElementById('btnHistory'),
      historyView: document.getElementById('historyView'),
      btnCloseHistory: document.getElementById('btnCloseHistory'),
      historyListContainer: document.getElementById('historyListContainer'),
      btnClearHistory: document.getElementById('btnClearHistory'),

      // Logs overlay
      btnLogs: document.getElementById('btnLogs'),
      logsView: document.getElementById('logsView'),
      btnCloseLogs: document.getElementById('btnCloseLogs'),
      logsContainer: document.getElementById('logsContainer'),
      logFilter: document.getElementById('logFilter'),
      btnCopyLogs: document.getElementById('btnCopyLogs'),
      btnClearLogs: document.getElementById('btnClearLogs')
    };

    this.init();
  }

  async init() {
    this.bindEvents();
    await this.loadInitialData();
    this.setupRuntimeListener();
    this.checkBackgroundStatus();
  }

  bindEvents() {
    // Reference Image Drag & Drop / File Input
    this.el.dropZone.addEventListener('click', () => this.el.fileInput.click());
    this.el.fileInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files[0]));

    ['dragenter', 'dragover'].forEach((eventName) => {
      this.el.dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.el.dropZone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      this.el.dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.el.dropZone.classList.remove('dragover');
      });
    });

    this.el.dropZone.addEventListener('drop', (e) => {
      if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        this.handleFileSelect(e.dataTransfer.files[0]);
      }
    });

    this.el.btnRemoveImage.addEventListener('click', () => this.removeReferenceImage());

    // Prompt queue actions
    if (this.el.btnRestoreDefaults) {
      this.el.btnRestoreDefaults.addEventListener('click', () => this.restoreDefaultPrompts());
    }
    this.el.btnClearAllPrompts.addEventListener('click', () => this.clearAllPrompts());

    // Batch download actions (ZIP & individual)
    this.el.inputBaseName.addEventListener('input', (e) => {
      this.updateBatchNamingSample(e.target.value);
      this.session.baseFilename = e.target.value.trim() || 'name';
      storage.saveSession(this.session);
    });
    this.el.btnDownloadZip.addEventListener('click', () => this.downloadAsZip());
    this.el.btnDownloadAll.addEventListener('click', () => this.downloadAllImages());

    // Action bar buttons
    this.el.btnStart.addEventListener('click', () => this.startAutomation());
    this.el.btnStop.addEventListener('click', () => this.stopAutomation());
    this.el.btnReset.addEventListener('click', () => this.resetSession());
    if (this.el.btnPopOut) {
      this.el.btnPopOut.addEventListener('click', () => this.popOutWindow());
    }

    // Slide-over overlays
    this.el.btnSettings.addEventListener('click', () => this.openOverlay(this.el.settingsView));
    this.el.btnCloseSettings.addEventListener('click', () => this.closeOverlay(this.el.settingsView));
    this.el.btnSaveSettings.addEventListener('click', () => this.saveSettings());

    this.el.btnHistory.addEventListener('click', () => {
      this.renderHistory();
      this.openOverlay(this.el.historyView);
    });
    this.el.btnCloseHistory.addEventListener('click', () => this.closeOverlay(this.el.historyView));
    this.el.btnClearHistory.addEventListener('click', () => this.clearHistory());

    this.el.btnLogs.addEventListener('click', () => {
      this.renderLogs();
      this.openOverlay(this.el.logsView);
    });
    this.el.btnCloseLogs.addEventListener('click', () => this.closeOverlay(this.el.logsView));
    this.el.logFilter.addEventListener('change', () => this.renderLogs());
    this.el.btnCopyLogs.addEventListener('click', () => this.copyLogs());
    this.el.btnClearLogs.addEventListener('click', () => this.clearLogs());
  }

  async loadInitialData() {
    this.session = await storage.getSession();
    this.settings = await storage.getSettings();

    // Populate Settings UI
    this.el.settingTimeout.value = this.settings.generationTimeoutMinutes || 5;
    this.el.settingRetries.value = this.settings.downloadRetries || 3;
    this.el.settingDelay.value = this.settings.delayBetweenPromptsSeconds || 2;
    this.el.settingFolder.value = this.settings.downloadFolder || 'PromptFlow';
    this.el.settingFolderPattern.value = this.settings.folderPattern || 'flat';
    this.el.settingKeepHistory.checked = !!this.settings.keepSessionHistory;
    this.el.settingDebugMode.checked = !!this.settings.debugMode;

    // Populate Batch Base Name UI
    const baseName = (this.session && this.session.baseFilename) || 'name';
    this.el.inputBaseName.value = baseName;
    this.updateBatchNamingSample(baseName);

    // Render session components
    this.renderReferenceImage();
    this.renderPromptQueue();
    this.renderStatusPanel();
  }

  setupRuntimeListener() {
    chrome.runtime.onMessage.addListener((message) => {
      if (this.isResetting) return;
      if (message.type === 'STATE_CHANGED' && message.session) {
        this.session = message.session;
        this.renderPromptQueue();
        this.renderStatusPanel();
        this.updateControlButtons();
      }
    });
  }

  async checkBackgroundStatus() {
    try {
      const res = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
      if (res) {
        this.isRunning = !!res.isRunning;
        if (res.session) {
          this.session = res.session;
          this.renderReferenceImage();
          this.renderPromptQueue();
          this.renderStatusPanel();
        }
        this.updateControlButtons();
      }
    } catch (e) {
      console.warn('Could not query background status:', e);
    }
  }

  /* File Handling */
  handleFileSelect(file) {
    if (!file) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      alert('Please upload a valid image file (PNG, JPG, JPEG, WEBP).');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      alert('Image file is too large (maximum 20MB).');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target.result;
      this.session.referenceImage = {
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl
      };
      await storage.saveSession(this.session);
      this.renderReferenceImage();
      logger.info(`Uploaded reference image: ${file.name} (${Math.round(file.size / 1024)} KB)`);
    };
    reader.readAsDataURL(file);
  }

  async removeReferenceImage() {
    this.session.referenceImage = null;
    await storage.saveSession(this.session);
    this.renderReferenceImage();
    this.el.fileInput.value = '';
    logger.info('Removed reference image');
  }

  renderReferenceImage() {
    if (this.session && this.session.referenceImage) {
      this.el.dropZone.style.display = 'none';
      this.el.imagePreviewContainer.classList.remove('hidden');
      this.el.imageThumbnail.src = this.session.referenceImage.dataUrl;
      this.el.imageFileName.textContent = this.session.referenceImage.name;
      this.el.imageFileSize.textContent = `${Math.round(this.session.referenceImage.size / 1024)} KB`;
    } else {
      this.el.dropZone.style.display = 'block';
      this.el.imagePreviewContainer.classList.add('hidden');
      this.el.imageThumbnail.src = '';
    }
  }

  /* Prompt Queue Rendering */
  renderPromptQueue() {
    if (!this.session || !this.session.prompts) return;

    this.el.promptQueueContainer.innerHTML = '';
    let activeCount = 0;

    this.session.prompts.forEach((p, index) => {
      if (p.enabled && p.text.trim().length > 0) activeCount++;

      const item = document.createElement('div');
      item.className = `prompt-item ${!p.enabled ? 'disabled' : ''}`;
      item.id = `prompt-item-${index}`;

      const numStr = String(index + 1).padStart(2, '0');
      const statusClass = p.status || 'waiting';
      const promptTitle = p.title || DEFAULT_PROMPT_TITLES[index] || `Prompt ${index + 1}`;

      item.innerHTML = `
        <div class="prompt-item-header">
          <div class="prompt-left-meta">
            <input type="checkbox" class="prompt-checkbox" data-index="${index}" ${p.enabled ? 'checked' : ''} ${this.isRunning ? 'disabled' : ''}>
            <span class="prompt-index">${numStr}</span>
            <span class="prompt-title-badge" title="${promptTitle}">${promptTitle}</span>
            <span class="prompt-status-tag ${statusClass}">${statusClass}</span>
          </div>
          <div class="prompt-right-actions">
            <span class="prompt-char-count">${p.text ? p.text.length : 0} chars</span>
            <button class="btn-icon-mini btn-reset-prompt" data-index="${index}" title="Restore default text for Prompt ${index + 1}" ${this.isRunning ? 'disabled' : ''}>
              ↺
            </button>
            <button class="btn-icon-mini btn-clear-prompt" data-index="${index}" title="Clear prompt text" ${this.isRunning ? 'disabled' : ''}>
              ✕
            </button>
          </div>
        </div>
        <textarea class="prompt-textarea" data-index="${index}" placeholder="Enter prompt ${index + 1}..." rows="3" ${this.isRunning ? 'disabled' : ''}>${p.text || ''}</textarea>
      `;

      // If an image was generated, show ready status badge (clean inline SVG, never broken)
      if (p.imageUrl) {
        const previewEl = document.createElement('div');
        previewEl.className = 'prompt-generated-preview';
        previewEl.innerHTML = `
          <div class="prompt-ready-badge">
            <svg class="prompt-ready-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <span class="prompt-ready-label">Image ready (${numStr})</span>
          </div>
        `;
        item.appendChild(previewEl);
      }

      // Event listeners for individual prompt controls
      const checkbox = item.querySelector('.prompt-checkbox');
      checkbox.addEventListener('change', (e) => {
        this.session.prompts[index].enabled = e.target.checked;
        item.classList.toggle('disabled', !e.target.checked);
        storage.saveSession(this.session);
        this.updateActivePromptCount();
      });

      const resetBtn = item.querySelector('.btn-reset-prompt');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          const defaultText = DEFAULT_PROMPT_TEXTS[index] || '';
          this.session.prompts[index].text = defaultText;
          this.session.prompts[index].title = DEFAULT_PROMPT_TITLES[index] || `Prompt ${index + 1}`;
          this.session.prompts[index].imageUrl = null;
          this.session.prompts[index].filename = null;
          this.session.prompts[index].error = null;
          this.session.prompts[index].status = PROMPT_STATUS.WAITING;
          const ta = item.querySelector('.prompt-textarea');
          ta.value = defaultText;
          item.querySelector('.prompt-char-count').textContent = `${defaultText.length} chars`;
          const oldPreview = item.querySelector('.prompt-generated-preview');
          if (oldPreview) oldPreview.remove();
          storage.saveSession(this.session);
          this.updateActivePromptCount();
          this.renderStatusPanel();
          logger.info(`Restored default text for Prompt ${index + 1}`);
        });
      }

      const clearBtn = item.querySelector('.btn-clear-prompt');
      clearBtn.addEventListener('click', () => {
        this.session.prompts[index].text = '';
        this.session.prompts[index].imageUrl = null;
        this.session.prompts[index].filename = null;
        this.session.prompts[index].error = null;
        this.session.prompts[index].status = PROMPT_STATUS.WAITING;
        const ta = item.querySelector('.prompt-textarea');
        ta.value = '';
        item.querySelector('.prompt-char-count').textContent = '0 chars';
        const oldPreview = item.querySelector('.prompt-generated-preview');
        if (oldPreview) oldPreview.remove();
        storage.saveSession(this.session);
        this.updateActivePromptCount();
        this.renderStatusPanel();
      });

      const textarea = item.querySelector('.prompt-textarea');
      textarea.addEventListener('input', (e) => {
        const val = e.target.value;
        this.session.prompts[index].text = val;
        item.querySelector('.prompt-char-count').textContent = `${val.length} chars`;
        this.debounceSavePrompt(index, val);
        this.updateActivePromptCount();
      });

      this.el.promptQueueContainer.appendChild(item);
    });

    this.el.activePromptCounter.textContent = `${activeCount} / ${this.session.prompts.length} Active`;
  }

  updateActivePromptCount() {
    const active = this.session.prompts.filter((p) => p.enabled && p.text.trim().length > 0).length;
    this.el.activePromptCounter.textContent = `${active} / ${this.session.prompts.length} Active`;
  }

  debounceSavePrompt(index, text) {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(async () => {
      await storage.saveSession(this.session);
    }, 300);
  }

  async restoreDefaultPrompts() {
    console.log('[PromptFlow Popup] Restore default prompts clicked');
    if (this.isRunning) {
      await this.stopAutomation();
    }

    const defaultPrompts = createDefaultPrompts(6);
    this.session.prompts = defaultPrompts.map((dp, i) => {
      const existing = (this.session.prompts && this.session.prompts[i]) || {};
      return {
        ...dp,
        enabled: existing.enabled !== undefined ? existing.enabled : true,
        status: PROMPT_STATUS.WAITING,
        imageUrl: null,
        filename: null,
        error: null,
        retries: 0
      };
    });
    this.session.defaultsInitialized = true;

    await storage.saveSession(this.session);
    this.renderPromptQueue();
    this.renderStatusPanel();
    this.updateControlButtons();
    logger.info('Restored all 6 default prompts');
  }

  async clearAllPrompts() {
    console.log('[PromptFlow Popup] Clear all prompts clicked');
    // If running, stop automation first
    if (this.isRunning) {
      await this.stopAutomation();
    }

    this.session.prompts.forEach((p) => {
      p.text = '';
      p.status = PROMPT_STATUS.WAITING;
      p.imageUrl = null;
      p.filename = null;
      p.error = null;
      p.startedAt = null;
      p.completedAt = null;
      p.retries = 0;
    });

    await storage.saveSession(this.session);
    this.renderPromptQueue();
    this.renderStatusPanel();
    this.updateControlButtons();
    logger.info('Cleared all prompts');
  }

  /* Status & Progress Panel */
  renderStatusPanel() {
    if (!this.session) return;

    const state = this.session.state || AUTOMATION_STATE.IDLE;
    const msg = this.session.statusMessage || 'Ready';

    // Dot class
    this.el.statusIndicatorDot.className = 'status-dot';
    if (state === AUTOMATION_STATE.IDLE) {
      this.el.statusIndicatorDot.classList.add('idle');
    } else if (state === AUTOMATION_STATE.COMPLETED) {
      this.el.statusIndicatorDot.classList.add('completed');
    } else if (state === AUTOMATION_STATE.ERROR) {
      this.el.statusIndicatorDot.classList.add('error');
    } else if (state === AUTOMATION_STATE.PAUSED || state === AUTOMATION_STATE.STOPPED) {
      this.el.statusIndicatorDot.classList.add('paused');
    } else {
      this.el.statusIndicatorDot.classList.add('active');
    }

    this.el.statusText.textContent = msg;

    // Progress computation
    const enabledPrompts = (this.session.prompts || []).filter((p) => p.enabled && p.text.trim().length > 0);
    const completedPrompts = (this.session.prompts || []).filter((p) => p.status === PROMPT_STATUS.COMPLETED);
    const total = enabledPrompts.length;
    const completed = completedPrompts.length;

    this.el.progressSummary.textContent = `${completed} / ${total} completed`;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    this.el.progressBarFill.style.width = `${pct}%`;

    // Status mini-list
    this.el.statusList.innerHTML = '';
    
    // Reference image status row
    const refRow = document.createElement('div');
    refRow.className = 'status-row-item';
    const refHas = !!this.session.referenceImage;
    refRow.innerHTML = `
      <span>Reference image</span>
      <span class="state-text" style="color: ${refHas ? '#10b981' : '#64748b'}">${refHas ? '✓ Uploaded' : '○ Missing'}</span>
    `;
    this.el.statusList.appendChild(refRow);

    // Prompts status rows
    (this.session.prompts || []).forEach((p, idx) => {
      if (!p.enabled && !p.text.trim()) return;

      const row = document.createElement('div');
      row.className = 'status-row-item';

      let icon = '○';
      let color = '#64748b';
      let text = p.status;

      if (p.status === PROMPT_STATUS.COMPLETED) {
        icon = '✓';
        color = '#10b981';
        text = 'Downloaded';
      } else if (p.status === PROMPT_STATUS.GENERATING) {
        icon = '⟳';
        color = '#f59e0b';
        text = 'Generating...';
      } else if (p.status === PROMPT_STATUS.DOWNLOADING) {
        icon = '↓';
        color = '#38bdf8';
        text = 'Downloading...';
      } else if (p.status === PROMPT_STATUS.FAILED) {
        icon = '✕';
        color = '#ef4444';
        text = 'Failed';
      }

      row.innerHTML = `
        <span>Prompt ${idx + 1}</span>
        <span class="state-text" style="color: ${color}">${icon} ${text}</span>
      `;
      this.el.statusList.appendChild(row);
    });

    // Update batch download controls
    const readyImages = (this.session.prompts || []).filter(
      (p) => p.status === PROMPT_STATUS.COMPLETED && p.imageUrl
    );
    this.el.batchDownloadCounter.textContent = `${readyImages.length} Ready`;

    // 1. Primary ZIP Button (Single file, 0 permission prompts)
    this.el.btnDownloadZip.disabled = readyImages.length === 0;
    this.el.btnDownloadZip.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
        <path d="M21 8v13H3V8"></path>
        <path d="M1 3h22v5H1z"></path>
        <path d="M10 12h4"></path>
      </svg>
      <span>DOWNLOAD AS ZIP (${readyImages.length} Files - No Prompts)</span>
    `;

    // 2. Secondary Individual Files Button
    this.el.btnDownloadAll.disabled = readyImages.length === 0;
    this.el.btnDownloadAll.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
      <span>Download Individual Files (${readyImages.length})</span>
    `;
  }

  updateControlButtons() {
    const isWorking =
      this.session &&
      this.session.state !== AUTOMATION_STATE.IDLE &&
      this.session.state !== AUTOMATION_STATE.COMPLETED &&
      this.session.state !== AUTOMATION_STATE.STOPPED &&
      this.session.state !== AUTOMATION_STATE.ERROR;

    this.isRunning = isWorking;
    this.el.btnStart.disabled = isWorking;
    this.el.btnStop.disabled = !isWorking;
  }

  updateBatchNamingSample(baseName) {
    const clean = (baseName || '').trim().replace(/[\/\\:*?"<>|]/g, '') || 'name';
    this.el.batchNamingSample.textContent = `${clean}_images.zip or ${clean}_1.png, ${clean}_2.png...`;
  }

  async downloadAsZip() {
    const baseName = (this.el.inputBaseName.value || 'name').trim();
    this.el.btnDownloadZip.disabled = true;
    this.el.btnDownloadAll.disabled = true;
    this.el.btnDownloadZip.innerHTML = `<span>Packaging ZIP Archive...</span>`;

    try {
      const res = await chrome.runtime.sendMessage({
        type: 'DOWNLOAD_ALL',
        baseName,
        asZip: true
      });

      if (res && res.success) {
        this.el.batchDownloadStatus.innerHTML = `✓ Downloaded <b>${res.count}</b> images into <code>${res.path}</code> (1 file, zero prompts!)`;
        logger.success(`Downloaded all ${res.count} images as ZIP: ${res.path}`);
      } else {
        alert(res?.message || 'Failed to download ZIP archive');
      }
    } catch (e) {
      alert(`ZIP Download error: ${e.message}`);
    } finally {
      this.renderStatusPanel();
    }
  }

  async downloadAllImages() {
    const baseName = (this.el.inputBaseName.value || 'name').trim();
    this.el.btnDownloadZip.disabled = true;
    this.el.btnDownloadAll.disabled = true;
    this.el.btnDownloadAll.innerHTML = `<span>Downloading files...</span>`;

    try {
      const res = await chrome.runtime.sendMessage({
        type: 'DOWNLOAD_ALL',
        baseName,
        asZip: false
      });

      if (res && res.success) {
        this.el.batchDownloadStatus.innerHTML = `✓ Downloaded <b>${res.count}</b> separate images as <code>${baseName}_X.png</code>`;
        logger.success(`Downloaded all ${res.count} individual images as ${baseName}_X`);
      } else {
        alert(res?.message || 'Failed to download images');
      }
    } catch (e) {
      alert(`Download error: ${e.message}`);
    } finally {
      this.renderStatusPanel();
    }
  }

  popOutWindow() {
    chrome.windows.create({
      url: chrome.runtime.getURL('popup/popup.html?detached=true'),
      type: 'popup',
      width: 460,
      height: 760,
      focused: true
    });
    window.close();
  }

  /* Actions */
  async startAutomation() {
    if (!this.session.referenceImage) {
      alert('Please upload a reference image first.');
      return;
    }

    const enabled = this.session.prompts.filter((p) => p.enabled && p.text.trim().length > 0);
    if (enabled.length === 0) {
      alert('Please enter at least one enabled prompt.');
      return;
    }

    // If running in regular transient popup, pop out into a persistent floating window
    // so the UI never gets hidden when focus switches to ChatGPT!
    const isDetached = window.location.search.includes('detached');
    if (!isDetached) {
      try {
        await chrome.windows.create({
          url: chrome.runtime.getURL('popup/popup.html?detached=true'),
          type: 'popup',
          width: 460,
          height: 760,
          focused: false
        });
      } catch (e) {
        console.warn('Detached window creation note:', e);
      }
      await chrome.runtime.sendMessage({ type: 'START_AUTOMATION' });
      window.close();
      return;
    }

    this.el.btnStart.disabled = true;
    this.el.btnStop.disabled = false;
    this.isRunning = true;

    try {
      const res = await chrome.runtime.sendMessage({ type: 'START_AUTOMATION' });
      if (!res.success) {
        alert(res.message || 'Failed to start automation');
        this.updateControlButtons();
      }
    } catch (e) {
      alert(`Error starting automation: ${e.message}`);
      this.updateControlButtons();
    }
  }

  async stopAutomation() {
    try {
      await chrome.runtime.sendMessage({ type: 'STOP_AUTOMATION' });
      this.el.btnStop.disabled = true;
    } catch (e) {
      console.error('Stop error:', e);
    }
  }

  async resetSession() {
    console.log('[PromptFlow Popup] Reset session requested');
    this.isResetting = true;
    this.isRunning = false;
    this.el.btnStart.disabled = false;
    this.el.btnStop.disabled = true;

    const resetTextEl = document.getElementById('btnResetText');
    if (resetTextEl) resetTextEl.textContent = 'Resetting...';

    try {
      // 1. If running, stop automation first
      await this.stopAutomation();

      // 2. Notify background to reset state machine
      try {
        await chrome.runtime.sendMessage({ type: 'RESET_SESSION' });
      } catch (msgErr) {
        console.warn('[PromptFlow Popup] Background RESET_SESSION message note:', msgErr);
      }

      // 3. Reset storage to clean blank initial state
      this.session = await storage.resetSession();
      this.isRunning = false;

      // 4. Clear physical file input
      if (this.el.fileInput) this.el.fileInput.value = '';

      // 5. Re-render all components
      this.renderReferenceImage();
      this.renderPromptQueue();
      this.renderStatusPanel();
      this.updateControlButtons();

      // 6. Reset batch download feedback
      if (this.el.batchDownloadStatus) {
        const clean = (this.session.baseFilename || 'name').trim();
        this.el.batchDownloadStatus.innerHTML = `Images will be downloaded as <span id="batchNamingSample">${clean}_1.png, ${clean}_2.png...</span>`;
      }

      // 7. Visual confirmation feedback
      if (resetTextEl) {
        resetTextEl.textContent = 'Reset ✓';
        setTimeout(() => {
          if (resetTextEl) resetTextEl.textContent = 'Reset';
        }, 1200);
      }

      if (this.el.statusText) {
        this.el.statusText.textContent = 'Session reset to clean slate';
      }

      logger.info('Session reset: all prompts cleared, reference image removed, state reset to IDLE');
    } catch (err) {
      console.error('[PromptFlow Popup] Error during reset:', err);
      this.session = await storage.resetSession();
      this.isRunning = false;
      this.renderReferenceImage();
      this.renderPromptQueue();
      this.renderStatusPanel();
      this.updateControlButtons();
      if (resetTextEl) resetTextEl.textContent = 'Reset';
    } finally {
      setTimeout(() => {
        this.isResetting = false;
      }, 1500);
    }
  }

  /* Overlay Panels */
  openOverlay(overlayEl) {
    overlayEl.classList.add('open');
  }

  closeOverlay(overlayEl) {
    overlayEl.classList.remove('open');
  }

  async saveSettings() {
    this.settings = {
      generationTimeoutMinutes: parseInt(this.el.settingTimeout.value, 10) || 5,
      downloadRetries: parseInt(this.el.settingRetries.value, 10) || 3,
      delayBetweenPromptsSeconds: parseInt(this.el.settingDelay.value, 10) || 2,
      downloadFolder: this.el.settingFolder.value.trim() || 'PromptFlow',
      folderPattern: this.el.settingFolderPattern.value || 'flat',
      keepSessionHistory: this.el.settingKeepHistory.checked,
      debugMode: this.el.settingDebugMode.checked
    };

    await storage.saveSettings(this.settings);
    logger.setDebug(this.settings.debugMode);
    logger.info('Settings saved successfully');
    this.closeOverlay(this.el.settingsView);
  }

  async renderHistory() {
    const history = await storage.getHistory();
    this.el.historyListContainer.innerHTML = '';

    if (history.length === 0) {
      this.el.historyListContainer.innerHTML = `
        <div style="text-align: center; color: #64748b; padding: 24px 0;">
          No recorded sessions yet.
        </div>
      `;
      return;
    }

    history.forEach((h) => {
      const item = document.createElement('div');
      item.className = 'history-item';
      const dateStr = new Date(h.date).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      item.innerHTML = `
        <div class="history-meta">
          <span class="history-time">${dateStr}</span>
          <span class="history-details">${h.completedPrompts} / ${h.totalPrompts} completed (${h.durationSeconds || 0}s)</span>
        </div>
        <span class="history-badge ${h.status}">${h.status}</span>
      `;
      this.el.historyListContainer.appendChild(item);
    });
  }

  async clearHistory() {
    if (!confirm('Clear all session history?')) return;
    await storage.clearHistory();
    this.renderHistory();
  }

  async renderLogs() {
    const logs = await logger.getStoredLogs();
    const filter = this.el.logFilter.value;
    this.el.logsContainer.innerHTML = '';

    const filtered = filter === 'all' ? logs : logs.filter((l) => l.level === filter);

    if (filtered.length === 0) {
      this.el.logsContainer.innerHTML = '<div style="color: #64748b;">No logs recorded.</div>';
      return;
    }

    filtered.forEach((log) => {
      const line = document.createElement('div');
      line.className = `log-line ${log.level}`;
      line.innerHTML = `
        <span class="log-time">[${log.timeFormatted}]</span>
        <span class="log-msg">${log.message}</span>
      `;
      this.el.logsContainer.appendChild(line);
    });

    this.el.logsContainer.scrollTop = this.el.logsContainer.scrollHeight;
  }

  async copyLogs() {
    const logs = await logger.getStoredLogs();
    const text = logs.map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`).join('\n');
    await navigator.clipboard.writeText(text);
    alert('Logs copied to clipboard!');
  }

  async clearLogs() {
    await logger.clearStoredLogs();
    this.renderLogs();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
