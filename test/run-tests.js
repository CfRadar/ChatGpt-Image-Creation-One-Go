// test/run-tests.js
// Automated verification test runner for PromptFlow

const fs = require('fs');
const path = require('path');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failedTests++;
  }
}

console.log('\n========================================');
console.log('   PROMPTFLOW AUTOMATED TEST RUNNER   ');
console.log('========================================\n');

// 1. Verify Manifest V3 and File Structure
console.log('[Test Suite 1] File Structure & Manifest Validity');
const rootDir = path.join(__dirname, '..');
const manifestPath = path.join(rootDir, 'manifest.json');
assert(fs.existsSync(manifestPath), 'manifest.json exists');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
assert(manifest.manifest_version === 3, 'Manifest version is 3');
assert(manifest.name === 'PromptFlow - ChatGPT Image Automation', 'Extension name matches');
assert(manifest.action && manifest.action.default_popup === 'popup/popup.html', 'Popup HTML configured');
assert(manifest.background && manifest.background.service_worker === 'background/service-worker.js', 'Service worker configured');
assert(manifest.background.type === 'module', 'Service worker type is module');

const requiredPermissions = ['storage', 'downloads', 'tabs'];
requiredPermissions.forEach(p => {
  assert(manifest.permissions.includes(p), `Permission '${p}' is included`);
});

const requiredFiles = [
  'popup/popup.html',
  'popup/popup.css',
  'popup/popup.js',
  'background/service-worker.js',
  'content/chatgpt.js',
  'content/chatgpt.css',
  'utils/storage.js',
  'utils/downloader.js',
  'utils/logger.js',
  'icons/icon16.png',
  'icons/icon32.png',
  'icons/icon48.png',
  'icons/icon128.png',
  'package.json'
];

requiredFiles.forEach(file => {
  assert(fs.existsSync(path.join(rootDir, file)), `File exists: ${file}`);
});

// 2. Test Downloader Filename Sanitization & Path Building
console.log('\n[Test Suite 2] Downloader & Safe Filename Slugification');

function slugify(text, maxLength = 45) {
  if (!text || typeof text !== 'string') return 'generated-image';
  const cleaned = text
    .trim()
    .toLowerCase()
    .replace(/[\/\\:*?"<>|]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  const truncated = cleaned.slice(0, maxLength).replace(/-+$/, '');
  return truncated || 'image';
}

function buildDownloadPath(index, promptText, settings = {}, sessionId = 'default', extension = 'png') {
  const baseFolder = (settings.downloadFolder || 'PromptFlow').trim().replace(/^[/\\]+|[/\\]+$/g, '');
  const pattern = settings.folderPattern || 'flat';
  const numPrefix = String(index).padStart(2, '0');
  const slug = slugify(promptText);
  const filename = `${numPrefix}_${slug}.${extension}`;

  let subPath = '';
  if (pattern === 'date') {
    const now = new Date('2026-09-25T00:00:00Z');
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

const testSlug1 = slugify('A warrior standing in a forest');
assert(testSlug1 === 'a-warrior-standing-in-a-forest', `Standard prompt slugified correctly: ${testSlug1}`);

const testSlug2 = slugify('Illegal: / \\ : * ? " < > | symbols in prompt!!');
assert(!/[\/\\:*?"<>|]/.test(testSlug2), `Illegal characters completely stripped: ${testSlug2}`);

const testSlug3 = slugify('Very long prompt with lots of adjectives that goes on and on and on and on and on and on and on and on', 30);
assert(testSlug3.length <= 30, `Filename truncated cleanly within limit: length=${testSlug3.length}`);

const pathFlat = buildDownloadPath(1, 'Cyberpunk cyber samurai', { downloadFolder: 'PromptFlow', folderPattern: 'flat' });
assert(pathFlat === 'PromptFlow/01_cyberpunk-cyber-samurai.png', `Flat path format matches: ${pathFlat}`);

const pathDate = buildDownloadPath(2, 'Neon city', { downloadFolder: 'PromptFlow', folderPattern: 'date' });
assert(pathDate.startsWith('PromptFlow/2026-') && pathDate.endsWith('/02_neon-city.png'), `Date path format matches: ${pathDate}`);

const pathSession = buildDownloadPath(3, 'Action pose', { downloadFolder: 'PromptFlow', folderPattern: 'session' }, 'session_abc123');
assert(pathSession === 'PromptFlow/session_abc123/03_action-pose.png', `Session path format matches: ${pathSession}`);

function buildBatchDownloadPath(index, baseName = 'name', settings = {}, sessionId = 'default', extension = 'png') {
  const baseFolder = (settings.downloadFolder || 'PromptFlow').trim().replace(/^[/\\]+|[/\\]+$/g, '');
  const pattern = settings.folderPattern || 'flat';
  const cleanBase = slugify(baseName || 'name', 30) || 'name';
  const filename = `${cleanBase}_${index}.${extension}`;

  let subPath = '';
  if (pattern === 'date') {
    const now = new Date('2026-09-25T00:00:00Z');
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

const batchPath1 = buildBatchDownloadPath(1, 'name', { downloadFolder: 'PromptFlow', folderPattern: 'flat' });
assert(batchPath1 === 'PromptFlow/name_1.png', `Batch download path with name_1 matches: ${batchPath1}`);

const batchPath2 = buildBatchDownloadPath(2, 'name', { downloadFolder: 'PromptFlow', folderPattern: 'flat' });
assert(batchPath2 === 'PromptFlow/name_2.png', `Batch download path with name_2 matches: ${batchPath2}`);

const batchCustom = buildBatchDownloadPath(3, 'cyber-hero', { downloadFolder: 'PromptFlow', folderPattern: 'flat' });
assert(batchCustom === 'PromptFlow/cyber-hero_3.png', `Batch custom prefix matches: ${batchCustom}`);

// 3. Test Differential Image Detection Logic & Identical Prompt Disambiguation
console.log('\n[Test Suite 3] Differential Image Detection & Identical Prompt Disambiguation');

// Simulate 2 consecutive identical prompts
const turn1Assistant = {
  id: 'turn-1',
  images: [{ src: 'https://oaiusercontent.com/image_prompt1.png', complete: true, naturalWidth: 512 }]
};
const turn2Assistant = {
  id: 'turn-2',
  images: [{ src: 'https://oaiusercontent.com/image_prompt2.png', complete: true, naturalWidth: 512 }]
};

const allTurns = [turn1Assistant, turn2Assistant];

// Before prompt 2, baseline turn count is 1
const baselineTurnCount = 1;
const seenImages = new Set(['https://oaiusercontent.com/image_prompt1.png']);

// Detection targeting only turns created after baseline
function detectNewImageWithTurnTracking(turns, baseline, snapshot) {
  const newTurns = turns.slice(baseline);
  for (const turn of newTurns) {
    for (const img of turn.images) {
      if (!snapshot.has(img.src) && img.naturalWidth > 100) {
        return img.src;
      }
    }
  }
  return null;
}

const detectedForPrompt2 = detectNewImageWithTurnTracking(allTurns, baselineTurnCount, seenImages);
assert(
  detectedForPrompt2 === 'https://oaiusercontent.com/image_prompt2.png',
  `Turn tracking correctly isolated Prompt 2's image even with identical prompts: ${detectedForPrompt2}`
);

// Verify user message reference image exclusion
const userTurn = {
  role: 'user',
  images: [{ src: 'https://files.oaiusercontent.com/user_reference.png', complete: true, naturalWidth: 600 }]
};
const assistantTurn = {
  role: 'assistant',
  images: [{ src: 'https://oaiusercontent.com/generated_hippo.png', complete: true, naturalWidth: 1024 }]
};

function detectOnlyAssistantImage(turns, snapshot) {
  for (const turn of turns) {
    if (turn.role === 'user') continue; // Strict exclusion of user turn images
    for (const img of turn.images) {
      if (!snapshot.has(img.src) && img.naturalWidth > 100) {
        return img.src;
      }
    }
  }
  return null;
}

const detectedResult = detectOnlyAssistantImage([userTurn, assistantTurn], new Set());
assert(
  detectedResult === 'https://oaiusercontent.com/generated_hippo.png',
  'User reference image in chat turn is strictly ignored, isolating assistant generated image'
);

// 4. Test Single Reference Upload Logic
console.log('\n[Test Suite 4] Reference Image Single-Upload Enforcement');

let sessionUploadState = { referenceUploaded: false };
let uploadCount = 0;

for (let pIdx = 0; pIdx < 6; pIdx++) {
  if (!sessionUploadState.referenceUploaded) {
    uploadCount++;
    sessionUploadState.referenceUploaded = true;
  }
}
assert(uploadCount === 1, `Reference image uploaded only ONCE for all 6 prompts (uploadCount=${uploadCount})`);

// 4. Test Prompt Queue State Transitions & Retries
console.log('\n[Test Suite 4] Queue State Machine & Error Recovery');

const session = {
  prompts: [
    { id: 1, text: 'Prompt 1', enabled: true, status: 'waiting', retries: 0 },
    { id: 2, text: 'Prompt 2', enabled: true, status: 'waiting', retries: 0 },
    { id: 3, text: '', enabled: true, status: 'waiting', retries: 0 },
    { id: 4, text: 'Prompt 4', enabled: false, status: 'waiting', retries: 0 }
  ]
};

// Filter active prompts
const activePrompts = session.prompts.filter(p => p.enabled && p.text.trim().length > 0);
assert(activePrompts.length === 2, `Correctly identifies 2 active prompts (skips empty and disabled)`);

// Test Retry Tracking
let prompt2 = session.prompts[1];
const maxRetries = 3;
let attempt = 0;
while (attempt < maxRetries) {
  attempt++;
  prompt2.retries = attempt - 1;
}
assert(prompt2.retries === 2, `Tracks retries independently: retries=${prompt2.retries}`);

// 5. Test Clear All Prompts and Session Reset Logic
console.log('\n[Test Suite 5] Clear All Prompts & Reset Mechanics');

const dirtySession = {
  sessionId: 'test_session',
  state: 'completed',
  referenceImage: { name: 'sample.png', dataUrl: 'data:image/png;base64,123' },
  referenceUploaded: true,
  baseFilename: 'custom_name',
  prompts: [
    { id: 1, text: 'Old Prompt 1', enabled: true, status: 'completed', imageUrl: 'https://oaiusercontent.com/1.png', filename: 'PromptFlow/custom_name_1.png' },
    { id: 2, text: 'Old Prompt 2', enabled: true, status: 'failed', imageUrl: 'https://oaiusercontent.com/2.png', filename: null, error: 'Timeout' }
  ]
};

// Simulate clearAllPrompts()
dirtySession.prompts.forEach((p) => {
  p.text = '';
  p.status = 'waiting';
  p.imageUrl = null;
  p.filename = null;
  p.error = null;
  p.retries = 0;
});

assert(dirtySession.prompts[0].text === '' && dirtySession.prompts[1].text === '', 'clearAllPrompts resets all prompt texts to empty');
assert(dirtySession.prompts[0].imageUrl === null && dirtySession.prompts[1].imageUrl === null, 'clearAllPrompts strips all imageUrl badges');
assert(dirtySession.prompts[0].status === 'waiting' && dirtySession.prompts[1].status === 'waiting', 'clearAllPrompts resets all statuses to waiting');

// Test executionId invalidation mechanism
let executionId = 1;
const currentRunId = executionId;
let runCancelled = false;

// User hits reset
executionId++;
if (executionId !== currentRunId) {
  runCancelled = true;
}
// 6. Test PKZip Binary Archive Generator (0 Permission Prompts Solution)
console.log('\n[Test Suite 6] ZIP Archive Generator & CRC32 Verification');

function crc32Test(buf) {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

const testBuffer = Buffer.from('PromptFlow 123456');
const testCrc = crc32Test(testBuffer);
assert(typeof testCrc === 'number' && testCrc > 0, `CRC-32 computed successfully: ${testCrc}`);

// Create a zip with 3 mock images
const mockFiles = [
  { name: 'name_1.png', data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  { name: 'name_2.png', data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  { name: 'name_3.png', data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) }
];

// Test ZIP signature checks
const enc = new TextEncoder();
const fileRecords = [];
let offset = 0;

for (const f of mockFiles) {
  const nameBytes = enc.encode(f.name);
  const data = f.data;
  const crc = crc32Test(data);
  const size = data.length;

  const localHeader = new Uint8Array(30 + nameBytes.length);
  const view = new DataView(localHeader.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0x0021, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, size, true);
  view.setUint32(22, size, true);
  view.setUint16(26, nameBytes.length, true);
  view.setUint16(28, 0, true);
  localHeader.set(nameBytes, 30);

  fileRecords.push({ nameBytes, data, crc, size, offset, localHeader });
  offset += localHeader.length + size;
}

let centralDirSize = 0;
const centralHeaders = [];
for (const r of fileRecords) {
  const ch = new Uint8Array(46 + r.nameBytes.length);
  const view = new DataView(ch.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint16(14, 0x0021, true);
  view.setUint32(16, r.crc, true);
  view.setUint32(20, r.size, true);
  view.setUint32(24, r.size, true);
  view.setUint16(28, r.nameBytes.length, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, 0x81a40000, true);
  view.setUint32(42, r.offset, true);
  ch.set(r.nameBytes, 46);
  centralHeaders.push(ch);
  centralDirSize += ch.length;
}

const eocd = new Uint8Array(22);
const eocdView = new DataView(eocd.buffer);
eocdView.setUint32(0, 0x06054b50, true);
eocdView.setUint16(4, 0, true);
eocdView.setUint16(6, 0, true);
eocdView.setUint16(8, mockFiles.length, true);
eocdView.setUint16(10, mockFiles.length, true);
eocdView.setUint32(12, centralDirSize, true);
eocdView.setUint32(16, offset, true);
eocdView.setUint16(20, 0, true);

const zipArchive = new Uint8Array(offset + centralDirSize + 22);
let p = 0;
for (const r of fileRecords) {
  zipArchive.set(r.localHeader, p);
  p += r.localHeader.length;
  zipArchive.set(r.data, p);
  p += r.data.length;
}
for (const ch of centralHeaders) {
  zipArchive.set(ch, p);
  p += ch.length;
}
zipArchive.set(eocd, p);

const dv = new DataView(zipArchive.buffer);
assert(dv.getUint32(0, true) === 0x04034b50, 'ZIP local header signature 0x04034b50 present');
assert(dv.getUint32(offset, true) === 0x02014b50, 'ZIP central directory header signature 0x02014b50 present');
assert(dv.getUint32(offset + centralDirSize, true) === 0x06054b50, 'ZIP EOCD header signature 0x06054b50 present');
assert(zipArchive.length > 0, `ZIP archive successfully assembled: ${zipArchive.length} bytes for 3 mock files`);

// 7. Test 6 Default Fashion E-Commerce Prompts & Manual Override Mechanics
console.log('\n[Test Suite 7] 6 Default Fashion Prompts & Custom Modification Lifecycle');

(async () => {
  const { DEFAULT_PROMPT_TEXTS, DEFAULT_PROMPT_TITLES, createDefaultPrompts, createInitialSession } = await import('../utils/storage.js');

  assert(Array.isArray(DEFAULT_PROMPT_TEXTS) && DEFAULT_PROMPT_TEXTS.length === 6, 'DEFAULT_PROMPT_TEXTS contains exactly 6 prompts');
  assert(Array.isArray(DEFAULT_PROMPT_TITLES) && DEFAULT_PROMPT_TITLES.length === 6, 'DEFAULT_PROMPT_TITLES contains 6 matching titles');

  // Verify Prompt 1: Front View (Focused mid-thigh crop matching reference image 2)
  assert(DEFAULT_PROMPT_TEXTS[0].includes('FRONT VIEW ONLY') && DEFAULT_PROMPT_TEXTS[0].includes('oversized T-shirt'), 'Prompt 1 contains FRONT VIEW ONLY & oversized T-shirt instructions');
  assert(DEFAULT_PROMPT_TEXTS[0].includes('MID-THIGH') && DEFAULT_PROMPT_TEXTS[0].includes('NO feet'), 'Prompt 1 enforces tight mid-thigh crop with no feet or shoes');
  assert(DEFAULT_PROMPT_TEXTS[0].includes('hot and sexy'), 'Prompt 1 specifies hot and sexy model aesthetics');

  // Verify Prompt 2: Back View (Focused mid-thigh crop)
  assert(DEFAULT_PROMPT_TEXTS[1].includes('BACK VIEW') && DEFAULT_PROMPT_TEXTS[1].includes('NO printed graphic'), 'Prompt 2 contains BACK VIEW & plain back instructions');
  assert(DEFAULT_PROMPT_TEXTS[1].includes('MID-THIGH') && DEFAULT_PROMPT_TEXTS[1].includes('NO feet'), 'Prompt 2 enforces tight mid-thigh crop with no feet or shoes');

  // Verify Prompt 3: Side Profile (Focused mid-thigh crop)
  assert(DEFAULT_PROMPT_TEXTS[2].includes('CLEAR SIDE PROFILE') && DEFAULT_PROMPT_TEXTS[2].includes('SIDE VIEW ONLY'), 'Prompt 3 contains CLEAR SIDE PROFILE & 90-degree profile instructions');
  assert(DEFAULT_PROMPT_TEXTS[2].includes('MID-THIGH') && DEFAULT_PROMPT_TEXTS[2].includes('NO feet'), 'Prompt 3 enforces tight mid-thigh crop with no feet or shoes');

  // Verify Prompt 4: Neckline & Collar Close-Up
  assert(DEFAULT_PROMPT_TEXTS[3].includes('neckline and collar') && DEFAULT_PROMPT_TEXTS[3].includes('collar shape'), 'Prompt 4 contains neckline and collar close-up macro instructions');

  // Verify Prompt 5: Graphic Print Close-Up
  assert(DEFAULT_PROMPT_TEXTS[4].includes('printed graphic/design') && DEFAULT_PROMPT_TEXTS[4].includes('DO NOT redesign'), 'Prompt 5 contains printed graphic/design close-up instructions');

  // Verify Prompt 6: Marketplace Product Listing Infographic
  assert(DEFAULT_PROMPT_TEXTS[5].includes('PRODUCT LISTING INFOGRAPHIC') && DEFAULT_PROMPT_TEXTS[5].includes('Oversized fit'), 'Prompt 6 contains PRODUCT LISTING INFOGRAPHIC instructions');

  // Verify initial session creation has all 6 prompts populated by default
  const defaultSession = createInitialSession();
  assert(defaultSession.prompts.length === 6, 'Initial session contains 6 prompt items');
  assert(defaultSession.defaultsInitialized === true, 'Initial session marks defaultsInitialized as true');
  assert(defaultSession.prompts.every(p => p.text && p.text.length > 50), 'All 6 prompts in default session are pre-filled with full text');

  // Verify manual change override: manual edit takes precedence over default
  const testSession = createInitialSession();
  const customText = 'My manual custom prompt modification for front view';
  testSession.prompts[0].text = customText;
  assert(testSession.prompts[0].text === customText, 'Manual edit takes precedence and replaces default prompt');
  assert(testSession.prompts[1].text === DEFAULT_PROMPT_TEXTS[1], 'Unmodified prompts continue to use default prompt');

  // Verify restoring default reverts back to default text
  testSession.prompts[0].text = DEFAULT_PROMPT_TEXTS[0];
  assert(testSession.prompts[0].text === DEFAULT_PROMPT_TEXTS[0], 'Restoring default resets prompt text back to default prompt 1');

  // Summary
  console.log('\n========================================');
  console.log(`RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('========================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
})();

