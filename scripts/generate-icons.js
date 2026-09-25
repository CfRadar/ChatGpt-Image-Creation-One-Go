// scripts/generate-icons.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    table[n] = c;
  }
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(4 + 4 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crcVal = crc32(typeAndData);
  chunk.writeUInt32BE(crcVal, 8 + len);
  return chunk;
}

function createPng(size) {
  const width = size;
  const height = size;
  
  // Create scanlines: each line starts with 0 (Filter: None) + width * 4 bytes (RGBA)
  const rawData = Buffer.alloc((1 + width * 4) * height);
  let pos = 0;

  const center = size / 2;
  const radius = size * 0.44;

  for (let y = 0; y < height; y++) {
    rawData[pos++] = 0; // Filter byte: None
    for (let x = 0; x < width; x++) {
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let r = 0, g = 0, b = 0, a = 0;

      // Draw rounded background squircle
      const cornerRadius = size * 0.22;
      const qx = Math.max(0, Math.abs(dx) - (center - cornerRadius));
      const qy = Math.max(0, Math.abs(dy) - (center - cornerRadius));
      const cornerDist = Math.sqrt(qx * qx + qy * qy);

      if (cornerDist <= cornerRadius) {
        // Deep purple to violet gradient with cyan accent
        const t = (x + y) / (width * 2);
        r = Math.floor(18 + 70 * t);
        g = Math.floor(22 + 50 * t);
        b = Math.floor(48 + 160 * t);
        a = 255;

        // Subtle border
        if (cornerDist > cornerRadius - 1.5) {
          r = Math.min(255, r + 40);
          g = Math.min(255, g + 60);
          b = Math.min(255, b + 90);
        }

        // Draw lightning/flow symbol or spark in the center
        // Let's create a stylized "P" and dynamic arrow / sparkle
        const nx = dx / size;
        const ny = dy / size;

        // Center glow
        const glowDist = Math.sqrt(nx * nx + ny * ny);
        if (glowDist < 0.35) {
          const glow = Math.max(0, 1 - glowDist / 0.35);
          r = Math.min(255, Math.floor(r + 90 * glow));
          g = Math.min(255, Math.floor(g + 180 * glow));
          b = Math.min(255, Math.floor(b + 255 * glow));
        }

        // Diamond / 4-point star in center
        const star = Math.abs(nx) * 1.5 + Math.abs(ny) * 1.5;
        if (star < 0.22) {
          r = 240;
          g = 245;
          b = 255;
          a = 255;
        }
      }

      rawData[pos++] = r;
      rawData[pos++] = g;
      rawData[pos++] = b;
      rawData[pos++] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  const ihdrChunk = makeChunk('IHDR', ihdrData);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const iconsDir = path.join(__dirname, '..', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

[16, 32, 48, 128].forEach(size => {
  const pngBuf = createPng(size);
  const filePath = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(filePath, pngBuf);
  console.log(`Generated ${filePath} (${pngBuf.length} bytes)`);
});

// SVG icon
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="50%" stop-color="#1e1b4b" />
      <stop offset="100%" stop-color="#31104b" />
    </linearGradient>
    <linearGradient id="glow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="50%" stop-color="#818cf8" />
      <stop offset="100%" stop-color="#c084fc" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#818cf8" flood-opacity="0.35"/>
    </filter>
  </defs>
  <rect width="128" height="128" rx="28" fill="url(#bg)" stroke="#38bdf8" stroke-width="2" stroke-opacity="0.3"/>
  <g filter="url(#shadow)">
    <!-- Central Flow & Sparkle Symbol -->
    <path d="M 64 24 C 64 44, 44 64, 24 64 C 44 64, 64 84, 64 104 C 64 84, 84 64, 104 64 C 84 64, 64 44, 64 24 Z" fill="url(#glow)"/>
    <circle cx="64" cy="64" r="8" fill="#ffffff" />
    <!-- Secondary mini sparkles -->
    <circle cx="92" cy="36" r="3.5" fill="#38bdf8" />
    <circle cx="36" cy="92" r="3.5" fill="#c084fc" />
  </g>
</svg>`;
fs.writeFileSync(path.join(iconsDir, 'icon.svg'), svg);
console.log('Generated icon.svg');
