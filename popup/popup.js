
// popup/popup.js
// Main UI Controller for PromptFlow Extension
// Supports: Male/Female models, T-Shirt Fit (including 'same as reference'), Framing Zoom,
// 10 Preset Pose rotation across 3 fashion shots, Multi-Image Queue, and Multiple ZIP Downloads.

import storage, {
  AUTOMATION_STATE,
  PROMPT_STATUS,
  createDefaultPrompts,
  DEFAULT_PROMPT_TITLES,
  DEFAULT_PROMPT_TEXTS,
  MODEL_GENDERS,
  TSHIRT_TYPES,
  ZOOM_TYPES,
  FRONT_POSES,
  BACK_POSES,
  SIDE_POSES,
  PRESET_POSES,
  POSE_SETS,
  calculatePoseIndices,
  buildPromptsForConfig,
  createQueueItem
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
      // Quick Customizer
      quickConfigTarget: document.getElementById('quickConfigTarget'),
      btnApplyConfigToAll: document.getElementById('btnApplyConfigToAll'),
      quickModelGender: document.getElementById('quickModelGender'),
      quickTshirtType: document.getElementById('quickTshirtType'),
      quickZoomType: document.getElementById('quickZoomType'),

      // Reference Image & Multi-Image Queue
      dropZone: document.getElementById('dropZone'),
      fileInput: document.getElementById('fileInput'),
      queueCounter: document.getElementById('queueCounter'),
      btnAddMoreFiles: document.getElementById('btnAddMoreFiles'),
      btnClearQueue: document.getElementById('btnClearQueue'),
      queueListContainer: document.getElementById('queueListContainer'),
      imagePreviewContainer: document.getElementById('imagePreviewContainer'),
      imageThumbnail: document.getElementById('imageThumbnail'),
      imageFileName: document.getElementById('imageFileName'),
      imageFileSize: document.getElementById('imageFileSize'),
      btnRemoveImage: document.getElementById('btnRemoveImage'),

      // Prompt Queue controls
      promptQueueContainer: document.getElementById('promptQueueContainer'),
      activePromptCounter: document.getElementById('activePromptCounter'),
      btnRestoreDefaults: document.getElementById('btnRestoreDefaults'),
      btnClearAllPrompts: document.getElementById('btnClearAllPrompts'),

      // Status & Progress
      statusIndicatorDot: document.getElementById('statusIndicatorDot'),
      statusText: document.getElementById('statusText'),
      progressSummary: document.getElementById('progressSummary'),
      progressBarFill: document.getElementById('progressBarFill'),
      statusList: document.getElementById('statusList'),

      // Action Bar
      btnStart: document.getElementById('btnStart'),
      btnStop: document.getElementById('btnStop'),
      btnReset: document.getElementById('btnReset'),
      btnPopOut: document.getElementById('btnPopOut'),

      // Batch & Queue Download elements
      inputBaseName: document.getElementById('inputBaseName'),
      btnDownloadZip: document.getElementById('btnDownloadZip'),
      btnDownloadAll: document.getElementById('btnDownloadAll'),
      btnDownloadAllQueueZips: document.getElementById('btnDownloadAllQueueZips'),
      batchDownloadCounter: document.getElementById('batchDownloadCounter'),
      batchNamingSample: document.getElementById('batchNamingSample'),
      batchDownloadStatus: document.getElementById('batchDownloadStatus'),

      // Settings overlay
      btnSettings: document.getElementById('btnSettings'),
      settingsView: document.getElementById('settingsView'),
      btnCloseSettings: document.getElementById('btnCloseSettings'),
      btnSaveSettings: document.getElementById('btnSaveSettings'),
      settingModelGender: document.getElementById('settingModelGender'),
      settingTshirtType: document.getElementById('settingTshirtType'),
      settingZoomType: document.getElementById('settingZoomType'),
      settingStartingPose: document.getElementById('settingStartingPose'),
      settingAutoZipQueueItems: document.getElementById('settingAutoZipQueueItems'),
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
    // Reference Image Drag & Drop / File Input (supports multiple files)
    this.el.dropZone.addEventListener('click', () => this.el.fileInput.click());
    this.el.fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        this.handleFilesSelect(Array.from(e.target.files));
      }
    });

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
        this.handleFilesSelect(Array.from(e.dataTransfer.files));
      }
    });

    if (this.el.btnAddMoreFiles) {
      this.el.btnAddMoreFiles.addEventListener('click', () => this.el.fileInput.click());
    }

    if (this.el.btnClearQueue) {
      this.el.btnClearQueue.addEventListener('click', () => this.clearQueue());
    }

    if (this.el.btnRemoveImage) {
      this.el.btnRemoveImage.addEventListener('click', () => this.removeReferenceImage());
    }

    // Quick Customizer listeners
    if (this.el.quickModelGender) {
      this.el.quickModelGender.addEventListener('change', () => this.handleQuickConfigChange());
    }
    if (this.el.quickTshirtType) {
      let quickTshirtTimer = null;
      this.el.quickTshirtType.addEventListener('input', () => {
        clearTimeout(quickTshirtTimer);
        quickTshirtTimer = setTimeout(() => this.handleQuickConfigChange(false), 350);
      });
      this.el.quickTshirtType.addEventListener('change', () => {
        clearTimeout(quickTshirtTimer);
        this.handleQuickConfigChange(true);
      });
    }
    if (this.el.quickZoomType) {
      this.el.quickZoomType.addEventListener('change', () => this.handleQuickConfigChange());
    }
    if (this.el.btnApplyConfigToAll) {
      this.el.btnApplyConfigToAll.addEventListener('click', () => this.applyConfigToAllQueueItems());
    }

    // Prompt queue actions
    if (this.el.btnRestoreDefaults) {
      this.el.btnRestoreDefaults.addEventListener('click', () => this.restoreDefaultPrompts());
    }
    if (this.el.btnClearAllPrompts) {
      this.el.btnClearAllPrompts.addEventListener('click', () => this.clearAllPrompts());
    }

    // Batch download actions (ZIP & individual)
    this.el.inputBaseName.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      this.updateBatchNamingSample(val);
      this.session.baseFilename = val;
      storage.saveSession(this.session);
    });

    if (this.el.btnDownloadZip) {
      this.el.btnDownloadZip.addEventListener('click', () => this.downloadAsZip());
    }
    if (this.el.btnDownloadAll) {
      this.el.btnDownloadAll.addEventListener('click', () => this.downloadAllImages());
    }
    if (this.el.btnDownloadAllQueueZips) {
      this.el.btnDownloadAllQueueZips.addEventListener('click', () => this.downloadAllQueueZips());
    }

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

    // Populate Quick Customizer & Settings UI with stored options
    const modelGender = this.settings.modelGender || 'female';
    const tshirtType = this.settings.tshirtType || 'same';
    const zoomType = this.settings.zoomType || 'medium';
    const startingPose = String(this.settings.startingPoseOffset || 0);

    if (this.el.quickModelGender) this.el.quickModelGender.value = modelGender;
    if (this.el.settingModelGender) this.el.settingModelGender.value = modelGender;

    if (this.el.quickTshirtType) this.el.quickTshirtType.value = tshirtType;
    if (this.el.settingTshirtType) this.el.settingTshirtType.value = tshirtType;

    if (this.el.quickZoomType) this.el.quickZoomType.value = zoomType;
    if (this.el.settingZoomType) this.el.settingZoomType.value = zoomType;

    if (this.el.settingStartingPose) this.el.settingStartingPose.value = startingPose;
    if (this.el.settingAutoZipQueueItems) this.el.settingAutoZipQueueItems.checked = this.settings.autoZipQueueItems !== false;

    // Standard automation settings
    this.el.settingTimeout.value = this.settings.generationTimeoutMinutes || 5;
    this.el.settingRetries.value = this.settings.downloadRetries || 3;
    this.el.settingDelay.value = this.settings.delayBetweenPromptsSeconds || 2;
    this.el.settingFolder.value = this.settings.downloadFolder || 'PromptFlow';
    this.el.settingFolderPattern.value = this.settings.folderPattern || 'flat';
    this.el.settingKeepHistory.checked = !!this.settings.keepSessionHistory;
    this.el.settingDebugMode.checked = !!this.settings.debugMode;

    // Populate Batch Base Name UI
    const baseName = (this.session && typeof this.session.baseFilename === 'string') ? this.session.baseFilename : '';
    this.el.inputBaseName.value = baseName;
    this.updateBatchNamingSample(baseName);

    // Sync active item config into customizer header if items exist
    this.updateQuickConfigUI();

    // Render session components
    this.renderQueueList();
    this.renderReferenceImage();
    this.renderPromptQueue();
    this.renderStatusPanel();
  }

  setupRuntimeListener() {
    chrome.runtime.onMessage.addListener((message) => {
      if (this.isResetting) return;
      if (message.type === 'STATE_CHANGED' && message.session) {
        this.session = message.session;
        this.renderQueueList();
        this.renderReferenceImage();
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
          this.renderQueueList();
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

  /* Multi-File Upload & Queue Management */
  async handleFilesSelect(files) {
    if (!files || files.length === 0) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    const validFiles = files.filter((f) => validTypes.includes(f.type.toLowerCase()));

    if (validFiles.length === 0) {
      alert('Please upload valid image files (PNG, JPG, JPEG, WEBP).');
      return;
    }

    if (!this.session.queue) {
      this.session.queue = [];
    }

    for (const file of validFiles) {
      if (file.size > 20 * 1024 * 1024) {
        alert(`File "${file.name}" exceeds maximum size of 20MB and was skipped.`);
        continue;
      }

      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
      });

      const fileData = {
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl
      };

      const queueIndex = this.session.queue.length;
      const queueItem = createQueueItem(fileData, queueIndex, this.settings);
      this.session.queue.push(queueItem);
    }

    // Set first queue item as active reference and prompt set if none active
    if (this.session.queue.length > 0) {
      const currentIdx = Math.min(this.session.currentQueueIndex || 0, this.session.queue.length - 1);
      const activeItem = this.session.queue[currentIdx];
      this.session.referenceImage = activeItem.file;
      this.session.currentQueueItemId = activeItem.id;
      this.session.prompts = activeItem.prompts;
    }

    await storage.saveSession(this.session);
    this.renderQueueList();
    this.renderReferenceImage();
    this.renderPromptQueue();
    this.renderStatusPanel();
    logger.info(`Added ${validFiles.length} design(s) to queue. Total: ${this.session.queue.length}`);
  }

  async removeReferenceImage() {
    this.session.referenceImage = null;
    if (this.session.queue && this.session.queue.length > 0) {
      // Remove current active item
      const activeIdx = this.session.currentQueueIndex || 0;
      this.session.queue.splice(activeIdx, 1);
      if (this.session.queue.length > 0) {
        const nextIdx = Math.max(0, Math.min(activeIdx, this.session.queue.length - 1));
        this.session.currentQueueIndex = nextIdx;
        const nextItem = this.session.queue[nextIdx];
        this.session.referenceImage = nextItem.file;
        this.session.currentQueueItemId = nextItem.id;
        this.session.prompts = nextItem.prompts;
      } else {
        this.session.currentQueueIndex = 0;
        this.session.currentQueueItemId = null;
      }
    }
    await storage.saveSession(this.session);
    this.renderQueueList();
    this.renderReferenceImage();
    this.renderPromptQueue();
    this.renderStatusPanel();
    if (this.el.fileInput) this.el.fileInput.value = '';
    logger.info('Removed reference image / queue item');
  }

  async clearQueue() {
    if (this.isRunning) {
      alert('Cannot clear queue while automation is running. Stop automation first.');
      return;
    }
    this.session.queue = [];
    this.session.currentQueueIndex = 0;
    this.session.currentQueueItemId = null;
    this.session.referenceImage = null;
    await storage.saveSession(this.session);
    this.renderQueueList();
    this.renderReferenceImage();
    this.renderPromptQueue();
    this.renderStatusPanel();
    if (this.el.fileInput) this.el.fileInput.value = '';
    logger.info('Reference queue cleared');
  }

  /* Render Interactive Multi-Image Queue */
  renderQueueList() {
    const queue = (this.session && this.session.queue) || [];
    const count = queue.length;

    if (this.el.queueCounter) {
      this.el.queueCounter.textContent = `${count} Design${count === 1 ? '' : 's'}`;
    }

    if (!this.el.queueListContainer) return;

    if (count === 0) {
      this.el.queueListContainer.classList.add('hidden');
      this.el.queueListContainer.innerHTML = '';
      return;
    }

    this.el.queueListContainer.classList.remove('hidden');
    this.el.queueListContainer.innerHTML = '';

    const currentIdx = this.session.currentQueueIndex || 0;

    queue.forEach((item, index) => {
      const isCurrent = index === currentIdx;
      const numStr = String(index + 1).padStart(2, '0');
      const card = document.createElement('div');
      card.className = `queue-item-card ${isCurrent ? 'queue-card-active' : ''}`;
      card.dataset.index = index;
      card.dataset.id = item.id;

      // Build pose chips for 3 Angles: Front (print), Back, Side
      const poseIndices = item.poseIndices || [0, 0, 0];
      const frontPose = FRONT_POSES[poseIndices[0] % FRONT_POSES.length] || FRONT_POSES[0];
      const backPose = BACK_POSES[poseIndices[1] % BACK_POSES.length] || BACK_POSES[0];
      const sidePose = SIDE_POSES[poseIndices[2] % SIDE_POSES.length] || SIDE_POSES[0];

      const poseChipsHtml = `
        <span class="pose-chip chip-front" title="${frontPose.name}: ${frontPose.direction}">Front: ${frontPose.shortName}</span>
        <span class="pose-chip chip-back" title="${backPose.name}: ${backPose.direction}">Back: ${backPose.shortName}</span>
        <span class="pose-chip chip-side" title="${sidePose.name}: ${sidePose.direction}">Side: ${sidePose.shortName}</span>
      `;

      const itemConfig = item.config || {
        modelGender: this.settings?.modelGender || 'female',
        tshirtType: this.settings?.tshirtType || 'same',
        zoomType: this.settings?.zoomType || 'medium'
      };

      const miniControlsHtml = `
        <div class="queue-card-config-row">
          <div class="queue-mini-control" title="Model for this image">
            <span class="queue-mini-label">Model:</span>
            <select class="queue-mini-select queue-mini-model" data-index="${index}" ${this.isRunning ? 'disabled' : ''}>
              <option value="female" ${itemConfig.modelGender === 'female' ? 'selected' : ''}>♀ Female</option>
              <option value="male" ${itemConfig.modelGender === 'male' ? 'selected' : ''}>♂ Male</option>
            </select>
          </div>
          <div class="queue-mini-control" title="Garment / Fit: type 'same' or custom apparel (hoodie, jacket, etc.)">
            <span class="queue-mini-label">Fit:</span>
            <input type="text" class="queue-mini-fit-input" data-index="${index}" value="${itemConfig.tshirtType || 'same'}" list="garmentSuggestions" placeholder="same, hoodie..." spellcheck="false" ${this.isRunning ? 'disabled' : ''}>
          </div>
          <div class="queue-mini-control" title="Framing / Zoom for this image">
            <span class="queue-mini-label">Zoom:</span>
            <select class="queue-mini-select queue-mini-zoom" data-index="${index}" ${this.isRunning ? 'disabled' : ''}>
              <option value="medium" ${itemConfig.zoomType === 'medium' ? 'selected' : ''}>Medium</option>
              <option value="full_body" ${itemConfig.zoomType === 'full_body' ? 'selected' : ''}>Full</option>
              <option value="torso_zoom" ${itemConfig.zoomType === 'torso_zoom' ? 'selected' : ''}>Torso</option>
              <option value="macro_zoom" ${itemConfig.zoomType === 'macro_zoom' ? 'selected' : ''}>Macro</option>
            </select>
          </div>
          <div class="queue-mini-control" title="Option to name images like name_x. Leave empty for image_${index + 1}_x">
            <span class="queue-mini-label">Name:</span>
            <input type="text" class="queue-mini-name-input" data-index="${index}" value="${item.customName || ''}" placeholder="image_${index + 1}_x" spellcheck="false" ${this.isRunning ? 'disabled' : ''}>
          </div>
          <div class="queue-mini-control" title="Angle Preset Combination (Front/Back/Side)">
            <span class="queue-mini-label">Angles:</span>
            <select class="queue-mini-select queue-mini-pose" data-index="${index}" ${this.isRunning ? 'disabled' : ''}>
              ${POSE_SETS.map((ps, psIdx) => `<option value="${psIdx}" ${(item.poseIndices?.[0] ?? 0) === psIdx ? 'selected' : ''}>Set ${psIdx + 1}</option>`).join('')}
            </select>
          </div>
        </div>
      `;

      const statusTag = item.status || 'waiting';
      const hasImages = item.generatedImages && item.generatedImages.length > 0;
      const readyCount = hasImages ? item.generatedImages.length : 0;

      card.innerHTML = `
        <div class="queue-card-left">
          <div class="queue-thumb-wrapper">
            <img class="queue-thumb" src="${item.file.dataUrl}" alt="${item.file.name}">
            <span class="queue-index-badge">${numStr}</span>
          </div>
          <div class="queue-meta">
            <div class="queue-filename" title="${item.file.name}">${item.file.name}</div>
            <div class="queue-details">
              <span>${Math.round(item.file.size / 1024)} KB</span>
              <span class="queue-status-tag ${statusTag}">${statusTag}</span>
            </div>
            <div class="queue-poses-row">
              ${poseChipsHtml}
            </div>
            ${miniControlsHtml}
          </div>
        </div>
        <div class="queue-card-right">
          ${
            hasImages
              ? `<button type="button" class="btn-queue-zip" data-id="${item.id}" title="Download ZIP for this design">
                   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 8v13H3V8"></path><path d="M1 3h22v5H1z"></path><path d="M10 12h4"></path></svg>
                   <span>ZIP (${readyCount})</span>
                 </button>`
              : ''
          }
          <button type="button" class="btn-queue-remove" data-index="${index}" title="Remove design from queue" ${this.isRunning ? 'disabled' : ''}>✕</button>
        </div>
      `;

      // Inline mini control listeners
      const miniModel = card.querySelector('.queue-mini-model');
      if (miniModel) {
        miniModel.addEventListener('click', (e) => e.stopPropagation());
        miniModel.addEventListener('change', async (e) => {
          e.stopPropagation();
          item.config = item.config || {};
          item.config.modelGender = e.target.value;
          this.session.currentQueueIndex = index;
          await this.recompileQueueItemPrompts(index, true);
        });
      }

      const miniFit = card.querySelector('.queue-mini-fit-input');
      if (miniFit) {
        miniFit.addEventListener('click', (e) => e.stopPropagation());
        let miniFitTimer = null;
        miniFit.addEventListener('input', (e) => {
          e.stopPropagation();
          clearTimeout(miniFitTimer);
          miniFitTimer = setTimeout(async () => {
            item.config = item.config || {};
            item.config.tshirtType = e.target.value.trim() || 'same';
            this.session.currentQueueIndex = index;
            await this.recompileQueueItemPrompts(index, false);
          }, 350);
        });
        miniFit.addEventListener('change', async (e) => {
          e.stopPropagation();
          clearTimeout(miniFitTimer);
          item.config = item.config || {};
          item.config.tshirtType = e.target.value.trim() || 'same';
          this.session.currentQueueIndex = index;
          await this.recompileQueueItemPrompts(index, true);
        });
      }

      const miniZoom = card.querySelector('.queue-mini-zoom');
      if (miniZoom) {
        miniZoom.addEventListener('click', (e) => e.stopPropagation());
        miniZoom.addEventListener('change', async (e) => {
          e.stopPropagation();
          item.config = item.config || {};
          item.config.zoomType = e.target.value;
          this.session.currentQueueIndex = index;
          await this.recompileQueueItemPrompts(index, true);
        });
      }

      const miniName = card.querySelector('.queue-mini-name-input');
      if (miniName) {
        miniName.addEventListener('click', (e) => e.stopPropagation());
        let miniNameTimer = null;
        miniName.addEventListener('input', (e) => {
          e.stopPropagation();
          clearTimeout(miniNameTimer);
          miniNameTimer = setTimeout(async () => {
            item.customName = e.target.value.trim();
            item.baseFilename = item.customName || `design_${index + 1}`;
            await storage.saveSession(this.session);
          }, 350);
        });
        miniName.addEventListener('change', async (e) => {
          e.stopPropagation();
          clearTimeout(miniNameTimer);
          item.customName = e.target.value.trim();
          item.baseFilename = item.customName || `design_${index + 1}`;
          await storage.saveSession(this.session);
        });
      }

      const miniPose = card.querySelector('.queue-mini-pose');
      if (miniPose) {
        miniPose.addEventListener('click', (e) => e.stopPropagation());
        miniPose.addEventListener('change', async (e) => {
          e.stopPropagation();
          const sIdx = parseInt(e.target.value, 10) || 0;
          item.poseIndices = [sIdx, sIdx, sIdx];
          this.session.currentQueueIndex = index;
          await this.recompileQueueItemPrompts(index, true);
        });
      }

      // Select active design when clicking card
      card.addEventListener('click', async (e) => {
        if (e.target.closest('.btn-queue-remove') || e.target.closest('.btn-queue-zip')) return;
        if (this.isRunning) return;

        this.session.currentQueueIndex = index;
        this.session.currentQueueItemId = item.id;
        this.session.referenceImage = item.file;
        this.session.prompts = item.prompts;
        await storage.saveSession(this.session);
        this.updateQuickConfigUI();
        this.renderQueueList();
        this.renderReferenceImage();
        this.renderPromptQueue();
        this.renderStatusPanel();
      });

      // Individual ZIP Download
      const btnZip = card.querySelector('.btn-queue-zip');
      if (btnZip) {
        btnZip.addEventListener('click', (e) => {
          e.stopPropagation();
          this.downloadQueueItemZip(item.id);
        });
      }

      // Remove individual queue item
      const btnRemove = card.querySelector('.btn-queue-remove');
      if (btnRemove) {
        btnRemove.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (this.isRunning) return;
          this.session.queue.splice(index, 1);
          if (this.session.queue.length > 0) {
            const nextIdx = Math.max(0, Math.min(currentIdx, this.session.queue.length - 1));
            this.session.currentQueueIndex = nextIdx;
            const nextItem = this.session.queue[nextIdx];
            this.session.referenceImage = nextItem.file;
            this.session.currentQueueItemId = nextItem.id;
            this.session.prompts = nextItem.prompts;
          } else {
            this.session.referenceImage = null;
            this.session.currentQueueIndex = 0;
            this.session.currentQueueItemId = null;
          }
          await storage.saveSession(this.session);
          this.renderQueueList();
          this.renderReferenceImage();
          this.renderPromptQueue();
          this.renderStatusPanel();
        });
      }

      this.el.queueListContainer.appendChild(card);
    });
  }

  renderReferenceImage() {
    // If we have items in the queue, show the dropzone with "add more" styling
    // and let the queue list represent the images cleanly.
    if (this.session && this.session.referenceImage) {
      if (this.el.imagePreviewContainer) {
        this.el.imagePreviewContainer.classList.add('hidden');
      }
    }
  }

  /* Update the top Customizer bar to reflect the active queue item (or global defaults) */
  updateQuickConfigUI() {
    if (!this.session) return;

    const queue = this.session.queue || [];
    const currentIdx = this.session.currentQueueIndex || 0;
    const activeItem = queue[currentIdx];

    if (activeItem) {
      const cfg = activeItem.config || {
        modelGender: this.settings?.modelGender || 'female',
        tshirtType: this.settings?.tshirtType || 'same',
        zoomType: this.settings?.zoomType || 'medium'
      };

      if (this.el.quickConfigTarget) {
        const rawName = activeItem.file?.name || `Design #${currentIdx + 1}`;
        const displayName = rawName.length > 16 ? rawName.slice(0, 13) + '...' : rawName;
        this.el.quickConfigTarget.textContent = `Active: #${currentIdx + 1} (${displayName})`;
      }

      if (this.el.quickModelGender) this.el.quickModelGender.value = cfg.modelGender || 'female';
      if (this.el.quickTshirtType) this.el.quickTshirtType.value = cfg.tshirtType || 'same';
      if (this.el.quickZoomType) this.el.quickZoomType.value = cfg.zoomType || 'medium';
    } else {
      if (this.el.quickConfigTarget) {
        this.el.quickConfigTarget.textContent = 'Active Design: Global';
      }
      if (this.el.quickModelGender && this.settings) this.el.quickModelGender.value = this.settings.modelGender || 'female';
      if (this.el.quickTshirtType && this.settings) this.el.quickTshirtType.value = this.settings.tshirtType || 'same';
      if (this.el.quickZoomType && this.settings) this.el.quickZoomType.value = this.settings.zoomType || 'medium';
    }
  }

  /* Handle edits made in the top Quick Customizer bar */
  async handleQuickConfigChange(shouldRerenderQueue = true) {
    if (this.isRunning) return;

    const modelGender = this.el.quickModelGender ? this.el.quickModelGender.value : 'female';
    const tshirtType = this.el.quickTshirtType ? (this.el.quickTshirtType.value.trim() || 'same') : 'same';
    const zoomType = this.el.quickZoomType ? this.el.quickZoomType.value : 'medium';

    // Store in settings as future default for new uploads
    this.settings.modelGender = modelGender;
    this.settings.tshirtType = tshirtType;
    this.settings.zoomType = zoomType;
    if (this.el.settingModelGender) this.el.settingModelGender.value = modelGender;
    if (this.el.settingTshirtType) this.el.settingTshirtType.value = tshirtType;
    if (this.el.settingZoomType) this.el.settingZoomType.value = zoomType;
    await storage.saveSettings(this.settings);

    // If queue items exist, update the ACTIVE individual design!
    const queue = this.session?.queue || [];
    if (queue.length > 0) {
      const currentIdx = this.session.currentQueueIndex || 0;
      const activeItem = queue[currentIdx];
      if (activeItem) {
        activeItem.config = { modelGender, tshirtType, zoomType };
        await this.recompileQueueItemPrompts(currentIdx, shouldRerenderQueue);
        logger.info(`Updated Design #${currentIdx + 1} config: ${modelGender} model, "${tshirtType}" fit, ${zoomType} framing`);
      }
    } else {
      // Single/global mode
      await this.syncPromptsWithConfig();
      logger.info(`Updated global config: ${modelGender} model, "${tshirtType}" fit, ${zoomType} framing`);
    }
  }

  /* Recompile prompts for an individual queue item based on its specific config */
  async recompileQueueItemPrompts(index, shouldRerenderQueue = true) {
    if (!this.session || !this.session.queue || !this.session.queue[index]) return;

    const item = this.session.queue[index];
    const baseOffset = this.settings.startingPoseOffset || 0;
    const poseIndices = item.poseIndices || calculatePoseIndices(index, baseOffset);
    const itemConfig = item.config || {
      modelGender: this.settings?.modelGender || 'female',
      tshirtType: this.settings?.tshirtType || 'same',
      zoomType: this.settings?.zoomType || 'medium'
    };

    const newPrompts = buildPromptsForConfig({
      modelGender: itemConfig.modelGender,
      tshirtType: itemConfig.tshirtType,
      zoomType: itemConfig.zoomType,
      poseIndices
    });

    // Preserve status/images if already completed
    item.prompts = newPrompts.map((np, pIdx) => {
      const existing = (item.prompts && item.prompts[pIdx]) || {};
      if (existing.status === PROMPT_STATUS.COMPLETED && existing.imageUrl) {
        return { ...existing, title: np.title };
      }
      return {
        ...np,
        enabled: existing.enabled !== undefined ? existing.enabled : true,
        status: existing.status || PROMPT_STATUS.WAITING,
        imageUrl: existing.imageUrl || null,
        filename: existing.filename || null
      };
    });

    // If this item is currently selected, sync session.prompts
    if (this.session.currentQueueIndex === index) {
      this.session.prompts = item.prompts;
      this.session.referenceImage = item.file;
      this.session.currentQueueItemId = item.id;
    }

    await storage.saveSession(this.session);
    this.updateQuickConfigUI();

    if (shouldRerenderQueue) {
      this.renderQueueList();
    }
    this.renderPromptQueue();
    this.renderStatusPanel();
  }

  /* Sync current active configuration across ALL queued images */
  async applyConfigToAllQueueItems() {
    if (this.isRunning) return;
    if (!this.session || !this.session.queue || this.session.queue.length === 0) return;

    const modelGender = this.el.quickModelGender ? this.el.quickModelGender.value : 'female';
    const tshirtType = this.el.quickTshirtType ? (this.el.quickTshirtType.value.trim() || 'same') : 'same';
    const zoomType = this.el.quickZoomType ? this.el.quickZoomType.value : 'medium';

    this.session.queue.forEach((qItem, idx) => {
      qItem.config = { modelGender, tshirtType, zoomType };
      const newPrompts = buildPromptsForConfig({
        modelGender,
        tshirtType,
        zoomType,
        poseIndices: qItem.poseIndices || calculatePoseIndices(idx, this.settings.startingPoseOffset || 0)
      });
      qItem.prompts = newPrompts.map((np, pIdx) => {
        const existing = (qItem.prompts && qItem.prompts[pIdx]) || {};
        if (existing.status === PROMPT_STATUS.COMPLETED && existing.imageUrl) {
          return { ...existing, title: np.title };
        }
        return {
          ...np,
          enabled: existing.enabled !== undefined ? existing.enabled : true,
          status: existing.status || PROMPT_STATUS.WAITING,
          imageUrl: existing.imageUrl || null,
          filename: existing.filename || null
        };
      });
    });

    const currentIdx = this.session.currentQueueIndex || 0;
    if (this.session.queue[currentIdx]) {
      this.session.prompts = this.session.queue[currentIdx].prompts;
    }

    this.settings.modelGender = modelGender;
    this.settings.tshirtType = tshirtType;
    this.settings.zoomType = zoomType;
    await storage.saveSettings(this.settings);
    await storage.saveSession(this.session);

    this.updateQuickConfigUI();
    this.renderQueueList();
    this.renderPromptQueue();
    this.renderStatusPanel();
    logger.success(`Applied configuration to all ${this.session.queue.length} images!`);
  }

  /* Dynamically recompile prompts when config options change */
  async syncPromptsWithConfig() {
    if (!this.session) return;

    const baseOffset = this.settings.startingPoseOffset || 0;

    // Update queue items
    if (this.session.queue && this.session.queue.length > 0) {
      this.session.queue.forEach((qItem, idx) => {
        const poseIndices = calculatePoseIndices(idx, baseOffset);
        qItem.poseIndices = poseIndices;
        qItem.config = {
          modelGender: this.settings.modelGender,
          tshirtType: this.settings.tshirtType,
          zoomType: this.settings.zoomType
        };
        const newPrompts = buildPromptsForConfig({
          modelGender: this.settings.modelGender,
          tshirtType: this.settings.tshirtType,
          zoomType: this.settings.zoomType,
          poseIndices
        });

        // Preserve status/images if already completed
        qItem.prompts = newPrompts.map((np, pIdx) => {
          const existing = (qItem.prompts && qItem.prompts[pIdx]) || {};
          if (existing.status === PROMPT_STATUS.COMPLETED && existing.imageUrl) {
            return { ...existing, title: np.title };
          }
          return {
            ...np,
            enabled: existing.enabled !== undefined ? existing.enabled : true,
            status: existing.status || PROMPT_STATUS.WAITING,
            imageUrl: existing.imageUrl || null,
            filename: existing.filename || null
          };
        });
      });

      const currentIdx = this.session.currentQueueIndex || 0;
      if (this.session.queue[currentIdx]) {
        this.session.prompts = this.session.queue[currentIdx].prompts;
      }
    } else {
      // Single/default prompts
      const poseIndices = calculatePoseIndices(0, baseOffset);
      const newPrompts = buildPromptsForConfig({
        modelGender: this.settings.modelGender,
        tshirtType: this.settings.tshirtType,
        zoomType: this.settings.zoomType,
        poseIndices
      });

      this.session.prompts = newPrompts.map((np, pIdx) => {
        const existing = (this.session.prompts && this.session.prompts[pIdx]) || {};
        if (existing.status === PROMPT_STATUS.COMPLETED && existing.imageUrl) {
          return { ...existing, title: np.title };
        }
        return {
          ...np,
          enabled: existing.enabled !== undefined ? existing.enabled : true,
          status: existing.status || PROMPT_STATUS.WAITING,
          imageUrl: existing.imageUrl || null,
          filename: existing.filename || null
        };
      });
    }

    await storage.saveSession(this.session);
    this.updateQuickConfigUI();
    this.renderQueueList();
    this.renderPromptQueue();
    this.renderStatusPanel();
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

      // If an image was generated, show ready status badge
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
        this.syncActivePromptToQueueItem(index);
        storage.saveSession(this.session);
        this.updateActivePromptCount();
      });

      const resetBtn = item.querySelector('.btn-reset-prompt');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          const baseOffset = this.settings.startingPoseOffset || 0;
          const currentQueueIdx = this.session.currentQueueIndex || 0;
          const poseIndices = calculatePoseIndices(currentQueueIdx, baseOffset);
          const freshPrompts = buildPromptsForConfig({
            modelGender: this.settings.modelGender,
            tshirtType: this.settings.tshirtType,
            zoomType: this.settings.zoomType,
            poseIndices
          });
          const fresh = freshPrompts[index] || { text: '', title: `Prompt ${index + 1}` };

          this.session.prompts[index].text = fresh.text;
          this.session.prompts[index].title = fresh.title;
          this.session.prompts[index].imageUrl = null;
          this.session.prompts[index].filename = null;
          this.session.prompts[index].error = null;
          this.session.prompts[index].status = PROMPT_STATUS.WAITING;

          const ta = item.querySelector('.prompt-textarea');
          ta.value = fresh.text;
          item.querySelector('.prompt-char-count').textContent = `${fresh.text.length} chars`;
          const oldPreview = item.querySelector('.prompt-generated-preview');
          if (oldPreview) oldPreview.remove();

          this.syncActivePromptToQueueItem(index);
          storage.saveSession(this.session);
          this.updateActivePromptCount();
          this.renderStatusPanel();
          logger.info(`Restored preset text for Prompt ${index + 1}`);
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

        this.syncActivePromptToQueueItem(index);
        storage.saveSession(this.session);
        this.updateActivePromptCount();
        this.renderStatusPanel();
      });

      const textarea = item.querySelector('.prompt-textarea');
      textarea.addEventListener('input', (e) => {
        const val = e.target.value;
        this.session.prompts[index].text = val;
        item.querySelector('.prompt-char-count').textContent = `${val.length} chars`;
        this.syncActivePromptToQueueItem(index);
        this.debounceSavePrompt();
        this.updateActivePromptCount();
      });

      this.el.promptQueueContainer.appendChild(item);
    });

    this.el.activePromptCounter.textContent = `${activeCount} / ${this.session.prompts.length} Active`;
  }

  syncActivePromptToQueueItem(promptIndex) {
    if (!this.session.queue || this.session.queue.length === 0) return;
    const currentIdx = this.session.currentQueueIndex || 0;
    if (this.session.queue[currentIdx] && this.session.queue[currentIdx].prompts) {
      this.session.queue[currentIdx].prompts[promptIndex] = {
        ...this.session.prompts[promptIndex]
      };
    }
  }

  updateActivePromptCount() {
    const active = (this.session.prompts || []).filter((p) => p.enabled && p.text.trim().length > 0).length;
    this.el.activePromptCounter.textContent = `${active} / ${(this.session.prompts || []).length} Active`;
  }

  debounceSavePrompt() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(async () => {
      await storage.saveSession(this.session);
    }, 300);
  }

  async restoreDefaultPrompts() {
    if (this.isRunning) {
      await this.stopAutomation();
    }
    await this.syncPromptsWithConfig();
    logger.info('Restored 6 customized prompts matching active model & styling presets');
  }

  async clearAllPrompts() {
    if (this.isRunning) {
      await this.stopAutomation();
    }

    this.session.prompts.forEach((p, idx) => {
      p.text = '';
      p.status = PROMPT_STATUS.WAITING;
      p.imageUrl = null;
      p.filename = null;
      p.error = null;
      p.startedAt = null;
      p.completedAt = null;
      p.retries = 0;
      this.syncActivePromptToQueueItem(idx);
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

    // Progress computation across active session prompts
    const enabledPrompts = (this.session.prompts || []).filter((p) => p.enabled && p.text.trim().length > 0);
    const completedPrompts = (this.session.prompts || []).filter((p) => p.status === PROMPT_STATUS.COMPLETED);
    const total = enabledPrompts.length;
    const completed = completedPrompts.length;

    this.el.progressSummary.textContent = `${completed} / ${total} completed`;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    this.el.progressBarFill.style.width = `${pct}%`;

    // Status mini-list
    this.el.statusList.innerHTML = '';

    // Queue status row
    const queueCount = (this.session.queue || []).length;
    const currentQIdx = (this.session.currentQueueIndex || 0) + 1;
    const qRow = document.createElement('div');
    qRow.className = 'status-row-item';
    qRow.innerHTML = `
      <span>Queue status</span>
      <span class="state-text" style="color: ${queueCount > 0 ? '#10b981' : '#64748b'}">
        ${queueCount > 0 ? `Design ${currentQIdx} of ${queueCount}` : 'No queue items'}
      </span>
    `;
    this.el.statusList.appendChild(qRow);

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

    // 1. Primary ZIP Button for active design
    this.el.btnDownloadZip.disabled = readyImages.length === 0;
    this.el.btnDownloadZip.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
        <path d="M21 8v13H3V8"></path>
        <path d="M1 3h22v5H1z"></path>
        <path d="M10 12h4"></path>
      </svg>
      <span>Download Active Design ZIP (${readyImages.length} Images - 1 Click)</span>
    `;

    // 2. Download All Queue ZIPs Button
    const completedQueueItems = (this.session.queue || []).filter(
      (q) => (q.generatedImages && q.generatedImages.length > 0) || q.status === 'completed'
    );
    if (this.el.btnDownloadAllQueueZips) {
      this.el.btnDownloadAllQueueZips.disabled = completedQueueItems.length === 0;
      this.el.btnDownloadAllQueueZips.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <path d="M21 8v13H3V8"></path>
          <path d="M1 3h22v5H1z"></path>
          <path d="M10 12h4"></path>
        </svg>
        <span>DOWNLOAD ALL QUEUE ZIPs (${completedQueueItems.length} Designs / Archives)</span>
      `;
    }

    // 3. Secondary Individual Files Button
    this.el.btnDownloadAll.disabled = readyImages.length === 0;
    this.el.btnDownloadAll.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
      <span>Download Individual PNGs (${readyImages.length})</span>
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
    const clean = (baseName || '').trim().replace(/[\/\\:*?"<>|]/g, '');
    if (clean) {
      this.el.batchNamingSample.textContent = `${clean}_1.png, ${clean}_2.png... (or ZIP)`;
    } else {
      this.el.batchNamingSample.textContent = `image_1_1.png, image_1_2.png... (or ZIP)`;
    }
  }

  async downloadAsZip() {
    const baseName = (this.el.inputBaseName.value || '').trim();
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

  async downloadQueueItemZip(queueId) {
    try {
      const res = await chrome.runtime.sendMessage({
        type: 'DOWNLOAD_QUEUE_ITEM_ZIP',
        queueId
      });
      if (res && res.success) {
        this.el.batchDownloadStatus.innerHTML = `✓ Downloaded ZIP archive: <code>${res.path}</code> (${res.count} images)`;
        logger.success(`Downloaded ZIP for queue item: ${res.path}`);
      } else {
        alert(res?.message || 'Failed to download ZIP for design');
      }
    } catch (e) {
      alert(`Queue ZIP error: ${e.message}`);
    }
  }

  async downloadAllQueueZips() {
    if (this.el.btnDownloadAllQueueZips) {
      this.el.btnDownloadAllQueueZips.disabled = true;
      this.el.btnDownloadAllQueueZips.innerHTML = `<span>Packaging All Design ZIPs...</span>`;
    }

    try {
      const res = await chrome.runtime.sendMessage({
        type: 'DOWNLOAD_ALL_QUEUE_ZIPS'
      });

      if (res && res.success) {
        this.el.batchDownloadStatus.innerHTML = `✓ Downloaded <b>${res.zipCount}</b> separate ZIP archives (${res.totalImages} images total) into Downloads!`;
        logger.success(`Downloaded ${res.zipCount} ZIP archives for queue items`);
      } else {
        alert(res?.message || 'No completed designs with images found in queue');
      }
    } catch (e) {
      alert(`Download all queue ZIPs error: ${e.message}`);
    } finally {
      this.renderStatusPanel();
    }
  }

  async downloadAllImages() {
    const baseName = (this.el.inputBaseName.value || '').trim();
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
      width: 480,
      height: 780,
      focused: true
    });
    window.close();
  }

  /* Actions */
  async startAutomation() {
    const queue = this.session.queue || [];
    if (!this.session.referenceImage && queue.length === 0) {
      alert('Please upload one or more reference images first.');
      return;
    }

    const enabled = (this.session.prompts || []).filter((p) => p.enabled && p.text.trim().length > 0);
    if (enabled.length === 0) {
      alert('Please enter at least one enabled prompt.');
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
    this.isResetting = true;
    this.isRunning = false;
    this.el.btnStart.disabled = false;
    this.el.btnStop.disabled = true;

    const resetTextEl = document.getElementById('btnResetText');
    if (resetTextEl) resetTextEl.textContent = 'Resetting...';

    try {
      await this.stopAutomation();

      try {
        await chrome.runtime.sendMessage({ type: 'RESET_SESSION' });
      } catch (msgErr) {
        console.warn('Background RESET_SESSION note:', msgErr);
      }

      this.session = await storage.resetSession();
      this.isRunning = false;

      if (this.el.fileInput) this.el.fileInput.value = '';

      this.renderQueueList();
      this.renderReferenceImage();
      this.renderPromptQueue();
      this.renderStatusPanel();
      this.updateControlButtons();

      if (this.el.batchDownloadStatus) {
        const clean = (this.session.baseFilename || 'name').trim();
        this.el.batchDownloadStatus.innerHTML = `Images will be packaged as <span id="batchNamingSample">${clean}_images.zip or ${clean}_1.png...</span>`;
      }

      if (resetTextEl) {
        resetTextEl.textContent = 'Reset ✓';
        setTimeout(() => {
          if (resetTextEl) resetTextEl.textContent = 'Reset';
        }, 1200);
      }

      if (this.el.statusText) {
        this.el.statusText.textContent = 'Session reset to clean slate';
      }

      logger.info('Session reset: all prompts cleared, reference queue emptied, state reset to IDLE');
    } catch (err) {
      console.error('Error during reset:', err);
      this.session = await storage.resetSession();
      this.isRunning = false;
      this.renderQueueList();
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
      modelGender: this.el.settingModelGender ? this.el.settingModelGender.value : 'female',
      tshirtType: this.el.settingTshirtType ? (this.el.settingTshirtType.value.trim() || 'same') : 'same',
      zoomType: this.el.settingZoomType ? this.el.settingZoomType.value : 'medium',
      startingPoseOffset: this.el.settingStartingPose ? parseInt(this.el.settingStartingPose.value, 10) : 0,
      autoZipQueueItems: this.el.settingAutoZipQueueItems ? this.el.settingAutoZipQueueItems.checked : true,
      generationTimeoutMinutes: parseInt(this.el.settingTimeout.value, 10) || 5,
      downloadRetries: parseInt(this.el.settingRetries.value, 10) || 3,
      delayBetweenPromptsSeconds: parseInt(this.el.settingDelay.value, 10) || 2,
      downloadFolder: this.el.settingFolder.value.trim() || 'PromptFlow',
      folderPattern: this.el.settingFolderPattern.value || 'flat',
      keepSessionHistory: this.el.settingKeepHistory.checked,
      debugMode: this.el.settingDebugMode.checked
    };

    // Keep quick customizer in sync
    if (this.el.quickModelGender) this.el.quickModelGender.value = this.settings.modelGender;
    if (this.el.quickTshirtType) this.el.quickTshirtType.value = this.settings.tshirtType;
    if (this.el.quickZoomType) this.el.quickZoomType.value = this.settings.zoomType;

    await storage.saveSettings(this.settings);
    logger.setDebug(this.settings.debugMode);
    logger.info('Settings saved successfully');

    if (!this.isRunning) {
      await this.syncPromptsWithConfig();
    }

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
