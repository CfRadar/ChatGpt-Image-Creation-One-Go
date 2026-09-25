// utils/logger.js
// Centralized logger for PromptFlow extension

const MAX_LOGS = 300;
const LOG_STORAGE_KEY = 'promptflow_logs';

/**
 * Log entry object structure:
 * {
 *   id: string,
 *   timestamp: string (ISO),
 *   timeFormatted: string (HH:MM:SS),
 *   level: 'info' | 'debug' | 'warn' | 'error' | 'success',
 *   message: string,
 *   details?: any
 * }
 */

class Logger {
  constructor() {
    this.debugEnabled = true;
    this.memoryLogs = [];
    this.listeners = new Set();
  }

  setDebug(enabled) {
    this.debugEnabled = !!enabled;
  }

  addListener(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notifyListeners(entry) {
    this.listeners.forEach((fn) => {
      try {
        fn(entry);
      } catch (err) {
        console.error('Error in log listener:', err);
      }
    });
  }

  formatTime(date = new Date()) {
    return date.toTimeString().split(' ')[0];
  }

  async log(level, message, details = null) {
    if (level === 'debug' && !this.debugEnabled) {
      return;
    }

    const now = new Date();
    const entry = {
      id: `${now.getTime()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: now.toISOString(),
      timeFormatted: this.formatTime(now),
      level,
      message,
      details: details ? (typeof details === 'object' ? JSON.stringify(details) : String(details)) : null
    };

    // Colorized console output
    const prefix = `[PromptFlow ${entry.timeFormatted}]`;
    const styleMap = {
      info: 'color: #38bdf8; font-weight: bold;',
      debug: 'color: #94a3b8;',
      warn: 'color: #fbbf24; font-weight: bold;',
      error: 'color: #f87171; font-weight: bold;',
      success: 'color: #4ade80; font-weight: bold;'
    };

    if (level === 'error') {
      console.error(`%c${prefix} [ERROR] ${message}`, styleMap.error, details || '');
    } else if (level === 'warn') {
      console.warn(`%c${prefix} [WARN] ${message}`, styleMap.warn, details || '');
    } else if (level === 'success') {
      console.log(`%c${prefix} [SUCCESS] ${message}`, styleMap.success, details || '');
    } else if (level === 'debug') {
      console.debug(`%c${prefix} [DEBUG] ${message}`, styleMap.debug, details || '');
    } else {
      console.log(`%c${prefix} [INFO] ${message}`, styleMap.info, details || '');
    }

    this.memoryLogs.push(entry);
    if (this.memoryLogs.length > MAX_LOGS) {
      this.memoryLogs.shift();
    }

    this.notifyListeners(entry);

    // Persist to chrome.storage.local asynchronously
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        const stored = await chrome.storage.local.get([LOG_STORAGE_KEY]);
        const existing = stored[LOG_STORAGE_KEY] || [];
        existing.push(entry);
        if (existing.length > MAX_LOGS) {
          existing.splice(0, existing.length - MAX_LOGS);
        }
        await chrome.storage.local.set({ [LOG_STORAGE_KEY]: existing });
      } catch (e) {
        // Storage might be unavailable or full; fail silently
      }
    }

    return entry;
  }

  info(msg, details) {
    return this.log('info', msg, details);
  }

  debug(msg, details) {
    return this.log('debug', msg, details);
  }

  warn(msg, details) {
    return this.log('warn', msg, details);
  }

  error(msg, details) {
    return this.log('error', msg, details);
  }

  success(msg, details) {
    return this.log('success', msg, details);
  }

  async getStoredLogs() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const data = await chrome.storage.local.get([LOG_STORAGE_KEY]);
      return data[LOG_STORAGE_KEY] || [];
    }
    return this.memoryLogs;
  }

  async clearStoredLogs() {
    this.memoryLogs = [];
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.remove([LOG_STORAGE_KEY]);
    }
  }
}

export const logger = new Logger();
export default logger;
