// utils/downloader.js
// Chrome Downloads API wrapper with verification, retry logic, and safe filename creation

import logger from './logger.js';

export class Downloader {
  /**
   * Generates a filesystem-safe slug from prompt text.
   * Strips forbidden characters: / \ : * ? " < > |
   */
  static slugify(text, maxLength = 45) {
    if (!text || typeof text !== 'string') return 'generated-image';

    const cleaned = text
      .trim()
      .toLowerCase()
      .replace(/[\/\\:*?"<>|]/g, '') // remove illegal characters
      .replace(/[^\w\s-]/g, '')     // remove punctuation/symbols
      .replace(/\s+/g, '-')         // convert spaces to hyphens
      .replace(/-+/g, '-')          // collapse repeated hyphens
      .replace(/^-+|-+$/g, '');     // trim hyphens

    const truncated = cleaned.slice(0, maxLength).replace(/-+$/, '');
    return truncated || 'image';
  }

  /**
   * Generates the destination relative path including configured folder and pattern.
   * @param {number} index - 1-based prompt index
   * @param {string} promptText - The prompt string
   * @param {object} settings - Settings object
   * @param {string} sessionId - Current session ID
   * @param {string} extension - Image file extension (e.g. 'png', 'webp', 'jpg')
   */
  /**
   * Generates the destination relative path including configured folder and pattern.
   * @param {number} index - 1-based prompt index
   * @param {string} promptText - The prompt string
   * @param {object} settings - Settings object
   * @param {string} sessionId - Current session ID
   * @param {string} extension - Image file extension (e.g. 'png', 'webp', 'jpg')
   */
  static buildDownloadPath(index, promptText, settings = {}, sessionId = 'default', extension = 'png') {
    const baseFolder = (settings.downloadFolder || 'PromptFlow').trim().replace(/^[/\\]+|[/\\]+$/g, '');
    const pattern = settings.folderPattern || 'flat';
    const numPrefix = String(index).padStart(2, '0');
    const slug = this.slugify(promptText);
    const filename = `${numPrefix}_${slug}.${extension}`;

    let subPath = '';
    if (pattern === 'date') {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      subPath = `${yyyy}-${mm}-${dd}/`;
    } else if (pattern === 'session') {
      const cleanSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
      subPath = `${cleanSessionId}/`;
    }

    return `${baseFolder}/${subPath}${filename}`;
  }

  /**
   * Generates destination path for batch download with format: name_X.png
   * @param {number} index - 1-based number (X)
   * @param {string} baseName - Base name prefix (e.g. 'name')
   * @param {object} settings - Settings object
   * @param {string} sessionId - Current session ID
   * @param {string} extension - Image file extension
   */
  static buildBatchDownloadPath(index, baseName = 'name', settings = {}, sessionId = 'default', extension = 'png') {
    const baseFolder = (settings.downloadFolder || 'PromptFlow').trim().replace(/^[/\\]+|[/\\]+$/g, '');
    const pattern = settings.folderPattern || 'flat';
    const cleanBase = this.slugify(baseName || 'name', 30) || 'name';
    const filename = `${cleanBase}_${index}.${extension}`;

    let subPath = '';
    if (pattern === 'date') {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      subPath = `${yyyy}-${mm}-${dd}/`;
    } else if (pattern === 'session') {
      const cleanSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
      subPath = `${cleanSessionId}/`;
    }

    return `${baseFolder}/${subPath}${filename}`;
  }

  /**
   * Downloads an image URL with full status monitoring, timeout, and verification.
   * @param {string} imageUrl - The remote, blob, or data URL
   * @param {string} targetPath - Relative download destination
   * @param {number} timeoutMs - Max time to wait for download to finish
   */
  static async downloadWithVerification(imageUrl, targetPath, timeoutMs = 45000) {
    if (typeof chrome === 'undefined' || !chrome.downloads) {
      throw new Error('Chrome Downloads API is unavailable');
    }

    logger.debug(`Initiating download for path: ${targetPath}`);

    return new Promise((resolve, reject) => {
      let downloadId = null;
      let timeoutTimer = null;

      const cleanup = () => {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        chrome.downloads.onChanged.removeListener(changeListener);
      };

      const changeListener = (delta) => {
        if (delta.id !== downloadId) return;

        if (delta.state) {
          if (delta.state.current === 'complete') {
            cleanup();
            logger.success(`Download confirmed complete: ${targetPath} (ID: ${downloadId})`);
            resolve({
              downloadId,
              targetPath,
              state: 'complete'
            });
          } else if (delta.state.current === 'interrupted') {
            cleanup();
            const reason = delta.error ? delta.error.current : 'Unknown interruption';
            logger.error(`Download failed/interrupted: ${targetPath} (${reason})`);
            reject(new Error(`Download interrupted: ${reason}`));
          }
        }
      };

      chrome.downloads.onChanged.addListener(changeListener);

      timeoutTimer = setTimeout(() => {
        cleanup();
        logger.warn(`Download timed out after ${timeoutMs}ms for ${targetPath}`);
        reject(new Error(`Download verification timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      chrome.downloads.download(
        {
          url: imageUrl,
          filename: targetPath,
          saveAs: false,
          conflictAction: 'uniquify'
        },
        (id) => {
          if (chrome.runtime.lastError) {
            cleanup();
            const err = chrome.runtime.lastError.message;
            logger.error(`chrome.downloads.download error: ${err}`);
            reject(new Error(err));
            return;
          }

          if (!id) {
            cleanup();
            reject(new Error('Download failed to start (no download ID received)'));
            return;
          }

          downloadId = id;
          logger.info(`Download started: ID ${downloadId} -> ${targetPath}`);

          // Double check if already finished immediately
          chrome.downloads.search({ id }, (results) => {
            if (results && results[0] && results[0].state === 'complete') {
              cleanup();
              resolve({
                downloadId,
                targetPath,
                state: 'complete'
              });
            }
          });
        }
      );
    });
  }

  /**
   * Executes download with automatic retries up to maxRetries
   */
  static async downloadWithRetries(imageUrl, targetPath, maxRetries = 3) {
    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`Download attempt ${attempt} / ${maxRetries} for: ${targetPath}`);
        const result = await this.downloadWithVerification(imageUrl, targetPath);
        return result;
      } catch (err) {
        lastError = err;
        logger.warn(`Attempt ${attempt} failed: ${err.message}`);
        if (attempt < maxRetries) {
          const backoff = 1500 * attempt;
          await new Promise((r) => setTimeout(r, backoff));
        }
      }
    }
    throw new Error(`Failed to download after ${maxRetries} attempts. Last error: ${lastError?.message}`);
  }

  /**
   * Computes CRC32 checksum for a Uint8Array
   */
  static crc32(buf) {
    if (!this._crcTable) {
      const table = new Uint32Array(256);
      for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) {
          c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[i] = c;
      }
      this._crcTable = table;
    }

    let crc = 0 ^ (-1);
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ this._crcTable[(crc ^ buf[i]) & 0xFF];
    }
    return (crc ^ (-1)) >>> 0;
  }

  /**
   * Packages multiple files into a standard PKZip (STORE method) binary buffer.
   * Completely self-contained, no external npm packages needed.
   * @param {Array<{name: string, data: Uint8Array|string}>} files - Files to package
   * @returns {Uint8Array} Valid ZIP file bytes
   */
  static createZip(files = []) {
    const enc = new TextEncoder();
    const fileRecords = [];
    let offset = 0;

    for (const f of files) {
      const nameBytes = enc.encode(f.name);
      let data = f.data;
      if (typeof data === 'string') {
        data = enc.encode(data);
      } else if (!(data instanceof Uint8Array)) {
        data = new Uint8Array(data);
      }

      const crc = this.crc32(data);
      const size = data.length;

      // Local file header (30 bytes + name)
      const localHeader = new Uint8Array(30 + nameBytes.length);
      const view = new DataView(localHeader.buffer);
      view.setUint32(0, 0x04034b50, true); // Local file header signature
      view.setUint16(4, 20, true);         // Version needed: 2.0
      view.setUint16(6, 0, true);          // General purpose bit flag
      view.setUint16(8, 0, true);          // Compression method: 0 (STORE)
      view.setUint16(10, 0, true);         // Mod time (00:00:00)
      view.setUint16(12, 0x0021, true);    // Mod date (1980-01-01)
      view.setUint32(14, crc, true);       // CRC-32
      view.setUint32(18, size, true);      // Compressed size
      view.setUint32(22, size, true);      // Uncompressed size
      view.setUint16(26, nameBytes.length, true); // Filename length
      view.setUint16(28, 0, true);         // Extra field length
      localHeader.set(nameBytes, 30);

      fileRecords.push({
        nameBytes,
        data,
        crc,
        size,
        offset,
        localHeader
      });

      offset += localHeader.length + size;
    }

    // Central directory headers
    let centralDirSize = 0;
    const centralHeaders = [];
    for (const r of fileRecords) {
      const ch = new Uint8Array(46 + r.nameBytes.length);
      const view = new DataView(ch.buffer);
      view.setUint32(0, 0x02014b50, true); // Central directory file header signature
      view.setUint16(4, 20, true);         // Version made by: 2.0
      view.setUint16(6, 20, true);         // Version needed to extract: 2.0
      view.setUint16(8, 0, true);          // General purpose bit flag
      view.setUint16(10, 0, true);         // Compression method: STORE
      view.setUint16(12, 0, true);         // Mod time
      view.setUint16(14, 0x0021, true);    // Mod date
      view.setUint32(16, r.crc, true);     // CRC-32
      view.setUint32(20, r.size, true);    // Compressed size
      view.setUint32(24, r.size, true);    // Uncompressed size
      view.setUint16(28, r.nameBytes.length, true); // Filename length
      view.setUint16(30, 0, true);         // Extra field length
      view.setUint16(32, 0, true);         // File comment length
      view.setUint16(34, 0, true);         // Disk number start
      view.setUint16(36, 0, true);         // Internal file attributes
      view.setUint32(38, 0x81a40000, true);// External file attributes (regular file -rw-r--r--)
      view.setUint32(42, r.offset, true);  // Relative offset of local header
      ch.set(r.nameBytes, 46);
      centralHeaders.push(ch);
      centralDirSize += ch.length;
    }

    // End of Central Directory Record (EOCD - 22 bytes)
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);
    eocdView.setUint32(0, 0x06054b50, true);         // EOCD signature
    eocdView.setUint16(4, 0, true);                  // Number of this disk
    eocdView.setUint16(6, 0, true);                  // Disk where central directory starts
    eocdView.setUint16(8, files.length, true);       // Number of central directory records on this disk
    eocdView.setUint16(10, files.length, true);      // Total number of central directory records
    eocdView.setUint32(12, centralDirSize, true);    // Size of central directory
    eocdView.setUint32(16, offset, true);            // Offset of start of central directory
    eocdView.setUint16(20, 0, true);                 // Comment length

    // Assemble entire ZIP archive
    const totalLength = offset + centralDirSize + 22;
    const out = new Uint8Array(totalLength);
    let pos = 0;
    for (const r of fileRecords) {
      out.set(r.localHeader, pos);
      pos += r.localHeader.length;
      out.set(r.data, pos);
      pos += r.data.length;
    }
    for (const ch of centralHeaders) {
      out.set(ch, pos);
      pos += ch.length;
    }
    out.set(eocd, pos);
    return out;
  }

  /**
   * Converts a Uint8Array into a Data URL safely without stack overflows
   */
  static uint8ArrayToDataUrl(bytes, mimeType = 'application/zip') {
    let binary = '';
    const len = bytes.byteLength;
    const chunkSize = 0x8000; // 32KB chunking
    for (let i = 0; i < len; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
      binary += String.fromCharCode.apply(null, chunk);
    }
    const base64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
    return `data:${mimeType};base64,${base64}`;
  }

  /**
   * Fetches image bytes from remote URL, blob URL, or data URL
   */
  static async fetchImageBytes(imageUrl, tabId = null) {
    if (!imageUrl) throw new Error('Missing image URL to fetch');

    // 1. Data URL
    if (imageUrl.startsWith('data:')) {
      const commaIdx = imageUrl.indexOf(',');
      const base64 = imageUrl.slice(commaIdx + 1);
      const binary = typeof atob === 'function' ? atob(base64) : Buffer.from(base64, 'base64').toString('binary');
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    }

    // 2. Remote URL or accessible blob URL
    try {
      const resp = await fetch(imageUrl);
      if (resp.ok) {
        const arrayBuffer = await resp.arrayBuffer();
        return new Uint8Array(arrayBuffer);
      }
    } catch (directErr) {
      logger.warn(`Direct fetch failed for ${imageUrl.slice(0, 60)}: ${directErr.message}`);
    }

    // 3. Fallback: ask active tab content script if tabId provided
    if (tabId && typeof chrome !== 'undefined' && chrome.tabs) {
      try {
        const res = await chrome.tabs.sendMessage(tabId, {
          type: 'FETCH_IMAGE_DATA',
          url: imageUrl
        });
        if (res && res.success && res.dataUrl) {
          return this.fetchImageBytes(res.dataUrl);
        }
      } catch (tabErr) {
        logger.error(`Content script fallback fetch error: ${tabErr.message}`);
      }
    }

    throw new Error('Unable to retrieve image bytes for URL');
  }

  /**
   * Downloads multiple files packaged into a single ZIP archive.
   * Eliminates multiple browser download prompts completely!
   */
  static async downloadZip(files, targetZipPath, timeoutMs = 60000) {
    logger.info(`Packaging ${files.length} files into ZIP: ${targetZipPath}`);
    const zipBytes = this.createZip(files);
    logger.info(`ZIP archive created successfully (${Math.round(zipBytes.length / 1024)} KB)`);
    const dataUrl = this.uint8ArrayToDataUrl(zipBytes, 'application/zip');
    return this.downloadWithVerification(dataUrl, targetZipPath, timeoutMs);
  }
}

export default Downloader;
