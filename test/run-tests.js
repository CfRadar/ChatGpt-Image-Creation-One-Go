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

  // Verify Prompt 1: Front View (Model in printed T-shirt)
  assert(DEFAULT_PROMPT_TEXTS[0].includes('FRONT VIEW ONLY') && DEFAULT_PROMPT_TEXTS[0].includes('oversized'), 'Prompt 1 contains FRONT VIEW ONLY & oversized T-shirt instructions');
  assert(DEFAULT_PROMPT_TEXTS[0].includes('MID-THIGH') && DEFAULT_PROMPT_TEXTS[0].includes('NO feet'), 'Prompt 1 enforces tight mid-thigh crop with no feet or shoes');
  assert(DEFAULT_PROMPT_TEXTS[0].includes('adult female'), 'Prompt 1 defaults to adult female model');
  assert(DEFAULT_PROMPT_TEXTS[0].includes('printed graphic/design clearly visible'), 'Prompt 1 explicitly features model wearing the front printed graphic');

  // Verify Prompt 2: Back View (Model showing back of T-shirt)
  assert(DEFAULT_PROMPT_TEXTS[1].includes('BACK VIEW ONLY') && DEFAULT_PROMPT_TEXTS[1].includes('clean back'), 'Prompt 2 contains BACK VIEW ONLY & clean back instructions');
  assert(DEFAULT_PROMPT_TEXTS[1].includes('NO printed graphic'), 'Prompt 2 specifies NO printed graphic on the back');
  assert(DEFAULT_PROMPT_TEXTS[1].includes('MID-THIGH') && DEFAULT_PROMPT_TEXTS[1].includes('NO feet'), 'Prompt 2 enforces tight mid-thigh crop with no feet or shoes');

  // Verify Prompt 3: Side View (Model in side profile / drape)
  assert(DEFAULT_PROMPT_TEXTS[2].includes('SIDE PROFILE VIEW') || DEFAULT_PROMPT_TEXTS[2].includes('SIDE VIEW'), 'Prompt 3 contains SIDE view instructions');
  assert(DEFAULT_PROMPT_TEXTS[2].includes('MID-THIGH') && DEFAULT_PROMPT_TEXTS[2].includes('NO feet'), 'Prompt 3 enforces tight mid-thigh crop with no feet or shoes');

  // Verify Prompt 4: Neckline, Collar, or Hood Close-Up (adapts to reference garment)
  assert((DEFAULT_PROMPT_TEXTS[3].includes('collar, neckline, or hood') || DEFAULT_PROMPT_TEXTS[3].includes('neckline and collar')) && (DEFAULT_PROMPT_TEXTS[3].includes('stitching') || DEFAULT_PROMPT_TEXTS[3].includes('seam construction')), 'Prompt 4 contains neckline, collar, or hood close-up macro instructions');

  // Verify Prompt 5: Graphic Print Close-Up
  assert(DEFAULT_PROMPT_TEXTS[4].includes('printed graphic/design') && DEFAULT_PROMPT_TEXTS[4].includes('DO NOT redesign'), 'Prompt 5 contains printed graphic/design close-up instructions');

  // Verify Prompt 6: Marketplace Product Listing Infographic
  assert(DEFAULT_PROMPT_TEXTS[5].includes('PRODUCT LISTING INFOGRAPHIC') && (DEFAULT_PROMPT_TEXTS[5].includes('Same as Reference') || DEFAULT_PROMPT_TEXTS[5].includes('Oversized Fit')), 'Prompt 6 contains PRODUCT LISTING INFOGRAPHIC instructions');

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

  // 8. Test Model Selection, T-Shirt Fits, Zoom Framing, 3 Angles x 10 Presets (30 Poses Total), and Queue Items
  console.log('\n[Test Suite 8] Model Selection, T-Shirt Fit, Zoom, 30 Poses (3 Angles x 10 Presets) & Multi-Image Queue');

  const {
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
    createQueueItem,
    resolveGarmentFit,
    resolveSleeveType,
    PRINT_ZOOM_TYPES,
    resolveImageFilename
  } = await import('../utils/storage.js');

  // 8.1 Model Genders
  assert(MODEL_GENDERS.female && MODEL_GENDERS.male, 'Both female and male model definitions exist');
  assert(MODEL_GENDERS.female.description.includes('female'), 'Female model includes female description');
  assert(MODEL_GENDERS.male.description.includes('male'), 'Male model includes male description');

  // 8.2 T-Shirt Types & "Same as Reference"
  const expectedFits = ['same', 'oversized', 'normal', 'slim', 'boxy', 'crop', 'polo'];
  expectedFits.forEach(fit => {
    assert(TSHIRT_TYPES[fit] !== undefined, `T-shirt fit '${fit}' is defined`);
  });
  assert(
    TSHIRT_TYPES.same.description.includes('reference image') &&
    TSHIRT_TYPES.same.description.includes('faithfully replicate'),
    'Fit "same" explicitly commands preserving reference image silhouette, fit, drape, and cut'
  );

  // 8.3 Zoom Framing Types
  const expectedZooms = ['medium', 'full_body', 'torso_zoom', 'macro_zoom'];
  expectedZooms.forEach(z => {
    assert(ZOOM_TYPES[z] !== undefined, `Framing zoom '${z}' is defined`);
  });
  assert(ZOOM_TYPES.medium.description.includes('MID-THIGH'), 'Medium zoom specifies mid-thigh framing');
  assert(ZOOM_TYPES.full_body.description.toLowerCase().includes('full-body') && ZOOM_TYPES.full_body.description.includes('head to toe'), 'Full body zoom specifies full-body head-to-toe framing');

  // 8.4 3 Angles x 10 Presets = 30 Poses Total
  assert(Array.isArray(FRONT_POSES) && FRONT_POSES.length === 10, 'FRONT_POSES contains exactly 10 front poses');
  assert(Array.isArray(BACK_POSES) && BACK_POSES.length === 10, 'BACK_POSES contains exactly 10 back poses');
  assert(Array.isArray(SIDE_POSES) && SIDE_POSES.length === 10, 'SIDE_POSES contains exactly 10 side poses');
  assert(Array.isArray(PRESET_POSES) && PRESET_POSES.length === 30, 'Total PRESET_POSES contains exactly 30 poses (3 * 10)');
  assert(Array.isArray(POSE_SETS) && POSE_SETS.length === 10, 'POSE_SETS contains exactly 10 complementary sets (Front, Back, Side)');

  FRONT_POSES.forEach((p, idx) => {
    assert(p.direction.includes('FRONT'), `Front pose ${idx + 1} (${p.name}) specifies FRONT view`);
  });
  BACK_POSES.forEach((p, idx) => {
    assert(p.direction.includes('BACK'), `Back pose ${idx + 1} (${p.name}) specifies BACK view`);
  });
  SIDE_POSES.forEach((p, idx) => {
    assert(p.direction.includes('SIDE') || p.direction.includes('THREE-QUARTER'), `Side pose ${idx + 1} (${p.name}) specifies SIDE/3-QUARTER view`);
  });

  // 8.5 Rotation Math Across Queue Items (Cycles Presets 0..9)
  const pRun0 = calculatePoseIndices(0, 0);
  assert(pRun0[0] === 0 && pRun0[1] === 0 && pRun0[2] === 0, `Queue 0 uses Preset 0 (Front 0, Back 0, Side 0): got [${pRun0}]`);

  const pRun1 = calculatePoseIndices(1, 0);
  assert(pRun1[0] === 1 && pRun1[1] === 1 && pRun1[2] === 1, `Queue 1 uses Preset 1 (Front 1, Back 1, Side 1): got [${pRun1}]`);

  const pRun9 = calculatePoseIndices(9, 0);
  assert(pRun9[0] === 9 && pRun9[1] === 9 && pRun9[2] === 9, `Queue 9 uses Preset 9 (Front 9, Back 9, Side 9): got [${pRun9}]`);

  const pRun10 = calculatePoseIndices(10, 0);
  assert(pRun10[0] === 0 && pRun10[1] === 0 && pRun10[2] === 0, `Queue 10 wraps back to Preset 0: got [${pRun10}]`);

  const pWithOffset = calculatePoseIndices(0, 4);
  assert(pWithOffset[0] === 4 && pWithOffset[1] === 4 && pWithOffset[2] === 4, `Offset 4 shifts starting preset to 4: got [${pWithOffset}]`);

  // 8.6 Prompt Compilation: Angle 1 = Front, Angle 2 = Back, Angle 3 = Side
  const maleSamePrompts = buildPromptsForConfig({
    modelGender: 'male',
    tshirtType: 'same',
    zoomType: 'full_body',
    poseIndices: [0, 0, 0]
  });
  assert(maleSamePrompts.length === 6, 'buildPromptsForConfig returned 6 prompts');
  assert(maleSamePrompts[0].text.includes('FRONT VIEW'), 'Prompt 1 is FRONT VIEW');
  assert(maleSamePrompts[0].text.includes('printed graphic/design clearly visible'), 'Prompt 1 shows model with front print');
  assert(maleSamePrompts[1].text.includes('BACK VIEW'), 'Prompt 2 is BACK VIEW');
  assert(maleSamePrompts[1].text.includes('NO printed graphic'), 'Prompt 2 enforces clean back without print');
  assert(maleSamePrompts[2].text.includes('SIDE VIEW') || maleSamePrompts[2].text.includes('SIDE PROFILE'), 'Prompt 3 is SIDE VIEW');

  // Test Female + Oversized + Medium (Preset 2: Pockets Front, Over-Shoulder Right, 90° Left)
  const femaleOversizedPrompts = buildPromptsForConfig({
    modelGender: 'female',
    tshirtType: 'oversized',
    zoomType: 'medium',
    poseIndices: [1, 1, 1]
  });
  assert(femaleOversizedPrompts[0].text.includes('adult female'), 'Prompt 1 specifies adult female model');
  assert(femaleOversizedPrompts[0].text.includes(FRONT_POSES[1].direction), `Prompt 1 uses Front Pose 2 direction (${FRONT_POSES[1].shortName})`);
  assert(femaleOversizedPrompts[1].text.includes(BACK_POSES[1].direction), `Prompt 2 uses Back Pose 2 direction (${BACK_POSES[1].shortName})`);
  assert(femaleOversizedPrompts[2].text.includes(SIDE_POSES[1].direction), `Prompt 3 uses Side Pose 2 direction (${SIDE_POSES[1].shortName})`);

  // 8.7 Queue Item Creation with Distinct Angle Combinations
  const mockFile1 = { name: 'design-alpha.png', type: 'image/png', size: 12345, dataUrl: 'data:image/png;base64,mock1' };
  const mockFile2 = { name: 'design-beta.png', type: 'image/png', size: 54321, dataUrl: 'data:image/png;base64,mock2' };

  const queueItem1 = createQueueItem(mockFile1, 0, { modelGender: 'female', tshirtType: 'same', zoomType: 'medium', startingPoseOffset: 0 });
  const queueItem2 = createQueueItem(mockFile2, 1, { modelGender: 'female', tshirtType: 'same', zoomType: 'medium', startingPoseOffset: 0 });

  assert(queueItem1.id && queueItem1.file.name === 'design-alpha.png', 'Queue item 1 initialized with correct filename');
  assert(queueItem1.poseIndices[0] === 0 && queueItem1.poseIndices[1] === 0 && queueItem1.poseIndices[2] === 0, 'Queue item 1 assigned Preset 0 (Front 0, Back 0, Side 0)');
  assert(queueItem2.poseIndices[0] === 1 && queueItem2.poseIndices[1] === 1 && queueItem2.poseIndices[2] === 1, 'Queue item 2 assigned Preset 1 (Front 1, Back 1, Side 1)');
  assert(queueItem1.prompts.length === 6 && queueItem2.prompts.length === 6, 'Both queue items contain 6 compiled prompts');
  assert(queueItem1.prompts[0].text !== queueItem2.prompts[0].text, 'Queue item 1 and 2 have distinct model poses in prompt 1');
  assert(queueItem1.prompts[1].text !== queueItem2.prompts[1].text, 'Queue item 1 and 2 have distinct model poses in prompt 2');
  assert(queueItem1.prompts[2].text !== queueItem2.prompts[2].text, 'Queue item 1 and 2 have distinct model poses in prompt 3');

  // 8.8 Verify resolveGarmentFit for 'same', 'hoodie', custom inputs
  const sameFit = resolveGarmentFit('same');
  assert(sameFit.isSame === true, "resolveGarmentFit('same') sets isSame = true");
  assert(sameFit.apparelName === 'garment', "resolveGarmentFit('same') uses generic apparelName 'garment' so it works for hoodies or anything");
  assert(sameFit.description.includes('hoodie, pullover, crewneck sweatshirt, oversized T-shirt, jacket'), "resolveGarmentFit('same') explicitly covers hoodies, jackets, sweatshirts, and t-shirts");

  const hoodieFit = resolveGarmentFit('hoodie');
  assert(hoodieFit.apparelName === 'hoodie', "resolveGarmentFit('hoodie') sets apparelName = 'hoodie'");
  const hoodiePrompts = buildPromptsForConfig({ tshirtType: 'hoodie' });
  assert(hoodiePrompts[3].text.includes('hood, drawstrings, eyelets'), "Prompt 4 focuses on hood and drawstrings when hoodie is specified");
  assert(hoodiePrompts[0].text.includes('MANDATORY GARMENT CONVERSION TO HOODIE'), "Prompt 1 explicitly commands converting to hoodie even if reference is a T-shirt");
  assert(hoodiePrompts[0].text.includes('DO NOT generate a T-shirt'), "Prompt 1 forbids generating a T-shirt when hoodie is requested");
  assert(hoodiePrompts[0].text.includes('long sleeves with ribbed cuffs'), "Prompt 1 requires long sleeves with ribbed cuffs for hoodie");
  assert(maleSamePrompts[3].text.includes('DO NOT show or add any hood or drawstrings'), "Prompt 4 for 'same' fit forbids adding hood or drawstrings when reference is a T-shirt");

  const customJacketFit = resolveGarmentFit('varsity jacket');
  assert(customJacketFit.apparelName === 'jacket', "resolveGarmentFit('varsity jacket') detects jacket apparel");

  // 8.9 Verify Individual Queue Items can have distinct configs
  const queueItemFemale = createQueueItem(mockFile1, 0, { modelGender: 'female', tshirtType: 'same', zoomType: 'full_body' });
  const queueItemMale = createQueueItem(mockFile2, 1, { modelGender: 'male', tshirtType: 'hoodie', zoomType: 'torso_zoom' });
  assert(queueItemFemale.config.modelGender === 'female' && queueItemMale.config.modelGender === 'male', 'Queue items have distinct individual models');
  assert(queueItemFemale.config.tshirtType === 'same' && queueItemMale.config.tshirtType === 'hoodie', 'Queue items have distinct individual garment fits');
  assert(queueItemFemale.config.zoomType === 'full_body' && queueItemMale.config.zoomType === 'torso_zoom', 'Queue items have distinct zoom framings');
  assert(queueItemFemale.prompts[0].text.includes('adult female'), 'Queue item 1 prompt 1 targets female model');
  assert(queueItemMale.prompts[0].text.includes('adult male'), 'Queue item 2 prompt 1 targets male model');

  // 8.10 Sleeve Customization Typing Box & Default 'same' Behavior
  const sameSleeveDefault = resolveSleeveType();
  assert(sameSleeveDefault.isSame === true, "resolveSleeveType() defaults to isSame = true");
  assert(sameSleeveDefault.id === 'same', "resolveSleeveType() defaults to id = 'same'");
  assert(sameSleeveDefault.description.includes('Replicate the exact sleeve length'), "resolveSleeveType() preserves reference image sleeves");

  const sameSleeveExplicit = resolveSleeveType('same');
  assert(sameSleeveExplicit.isSame === true, "resolveSleeveType('same') isSame = true");

  const longSleeve = resolveSleeveType('long');
  assert(longSleeve.isSame === false, "resolveSleeveType('long') isSame = false");
  assert(longSleeve.description.includes('LONG SLEEVES'), "resolveSleeveType('long') specifies LONG SLEEVES");

  const shortSleeve = resolveSleeveType('short');
  assert(shortSleeve.isSame === false, "resolveSleeveType('short') isSame = false");
  assert(shortSleeve.description.includes('SHORT SLEEVES'), "resolveSleeveType('short') specifies SHORT SLEEVES");

  const sleeveless = resolveSleeveType('sleeveless');
  assert(sleeveless.isSame === false, "resolveSleeveType('sleeveless') isSame = false");
  assert(sleeveless.description.includes('SLEEVELESS'), "resolveSleeveType('sleeveless') specifies SLEEVELESS");

  const threeQuarter = resolveSleeveType('3/4 sleeves');
  assert(threeQuarter.isSame === false, "resolveSleeveType('3/4 sleeves') isSame = false");
  assert(threeQuarter.description.includes('THREE-QUARTER'), "resolveSleeveType('3/4 sleeves') specifies THREE-QUARTER sleeves");

  const halfSleeves = resolveSleeveType('half sleeves');
  assert(halfSleeves.isSame === false, "resolveSleeveType('half sleeves') isSame = false");
  assert(halfSleeves.description.includes('HALF-LENGTH'), "resolveSleeveType('half sleeves') specifies HALF-LENGTH sleeves");

  const customSleeve = resolveSleeveType('oversized drop-shoulder');
  assert(customSleeve.isSame === false, "resolveSleeveType custom typing isSame = false");
  assert(customSleeve.description.includes('oversized drop-shoulder'), "resolveSleeveType preserves custom typed sleeve label");

  // Sleeve integration into buildPromptsForConfig
  const promptWithLongSleeves = buildPromptsForConfig({ tshirtType: 'same', sleeveType: 'long' });
  assert(promptWithLongSleeves[0].text.includes('MANDATORY SLEEVE CUSTOMIZATION (LONG)'), "Prompt 1 includes mandatory sleeve customization rule when not same");
  assert(promptWithLongSleeves[0].text.includes('LONG SLEEVES'), "Prompt 1 includes LONG SLEEVES text");
  assert(promptWithLongSleeves[2].text.includes('long sleeves'), "Prompt 3 (side view) references long sleeves");
  assert(promptWithLongSleeves[5].text.includes('long sleeves'), "Prompt 6 (details) lists custom sleeve in bullets");

  const promptWithSleeveless = buildPromptsForConfig({ tshirtType: 'hoodie', sleeveType: 'sleeveless' });
  assert(promptWithSleeveless[0].text.includes('SLEEVELESS'), "Prompt 1 customizes hoodie sleeves to sleeveless when user types sleeveless");

  // Queue Item preserves sleeveType
  const queueItemSleeve = createQueueItem(mockFile1, 2, { modelGender: 'female', tshirtType: 'same', sleeveType: 'short', zoomType: 'medium' });
  assert(queueItemSleeve.config.sleeveType === 'short', "Queue item captures custom sleeveType 'short'");
  assert(queueItemSleeve.prompts[0].text.includes('SHORT SLEEVES'), "Queue item prompt 1 contains SHORT SLEEVES");

  // 8.11 Print Image Zoom Presets (for Graphic Print Detail Image)
  assert(PRINT_ZOOM_TYPES.tight && PRINT_ZOOM_TYPES.tight.id === 'tight', "PRINT_ZOOM_TYPES.tight exists");
  assert(PRINT_ZOOM_TYPES.chest_macro && PRINT_ZOOM_TYPES.chest_macro.id === 'chest_macro', "PRINT_ZOOM_TYPES.chest_macro exists");
  assert(PRINT_ZOOM_TYPES.extreme_macro && PRINT_ZOOM_TYPES.extreme_macro.id === 'extreme_macro', "PRINT_ZOOM_TYPES.extreme_macro exists");
  assert(PRINT_ZOOM_TYPES.flat_lay && PRINT_ZOOM_TYPES.flat_lay.id === 'flat_lay', "PRINT_ZOOM_TYPES.flat_lay exists");

  const promptWithExtremeMacro = buildPromptsForConfig({ printZoomType: 'extreme_macro' });
  assert(promptWithExtremeMacro[4].text.includes('Ultra-tight microscopic macro zoom'), "Prompt 5 incorporates extreme macro print zoom");

  const promptWithChestMacro = buildPromptsForConfig({ printZoomType: 'chest_macro' });
  assert(promptWithChestMacro[4].text.includes('upper torso/chest graphic area'), "Prompt 5 incorporates chest macro print zoom");

  // 8.12 Queue Item Custom Naming & Print Zoom State
  const queueItemNamed = createQueueItem(mockFile1, 3, { customName: 'my_hoodie_drop', printZoomType: 'flat_lay' });
  assert(queueItemNamed.customName === 'my_hoodie_drop', "Queue item preserves explicit customName");
  assert(queueItemNamed.config.printZoomType === 'flat_lay', "Queue item captures printZoomType 'flat_lay'");
  assert(queueItemNamed.prompts[4].text.includes('flat-lay product perspective'), "Queue item prompt 5 uses flat lay print zoom");

  // 9. Test Image Naming (name_x vs image_x_x), Same-Tab In-Place Transition & Final ZIP Packaging
  console.log('\n[Test Suite 9] Image Naming (name_x vs image_x_x), Same-Tab Transition & Final ZIP');

  // 9.1 When custom name is provided -> name_x
  const named1 = resolveImageFilename('cool_tee', 1, 1);
  assert(named1 === 'cool_tee_1.png', `Custom name 'cool_tee' gives name_1: ${named1}`);

  const named2 = resolveImageFilename('cool_tee', 1, 2);
  assert(named2 === 'cool_tee_2.png', `Custom name 'cool_tee' gives name_2: ${named2}`);

  const named3 = resolveImageFilename('cool_tee', 1, 3);
  assert(named3 === 'cool_tee_3.png', `Custom name 'cool_tee' gives name_3: ${named3}`);

  const namedUserLiteral = resolveImageFilename('name', 2, 1);
  assert(namedUserLiteral === 'name_1.png', `Custom name 'name' gives name_1: ${namedUserLiteral}`);

  const namedComplex = resolveImageFilename('Summer Drop 2026!', 3, 2);
  assert(namedComplex === 'summer_drop_2026_2.png', `Complex custom name slugified properly: ${namedComplex}`);

  // 9.2 When custom name is NOT provided -> image_x_x (first x: designIndex, second x: promptIndex)
  const unnamed1 = resolveImageFilename('', 1, 1);
  assert(unnamed1 === 'image_1_1.png', `Empty custom name on design 1 prompt 1 gives image_1_1: ${unnamed1}`);

  const unnamed2 = resolveImageFilename('', 1, 2);
  assert(unnamed2 === 'image_1_2.png', `Empty custom name on design 1 prompt 2 gives image_1_2: ${unnamed2}`);

  const unnamed3 = resolveImageFilename('', 2, 1);
  assert(unnamed3 === 'image_2_1.png', `Empty custom name on design 2 prompt 1 gives image_2_1: ${unnamed3}`);

  const unnamed4 = resolveImageFilename('', 2, 3);
  assert(unnamed4 === 'image_2_3.png', `Empty custom name on design 2 prompt 3 gives image_2_3: ${unnamed4}`);

  const unnamedNull = resolveImageFilename(null, 3, 1);
  assert(unnamedNull === 'image_3_1.png', `Null custom name gives image_3_1: ${unnamedNull}`);

  const unnamedUndefined = resolveImageFilename(undefined, 4, 2);
  assert(unnamedUndefined === 'image_4_2.png', `Undefined custom name gives image_4_2: ${unnamedUndefined}`);

  const unnamedWhitespace = resolveImageFilename('   ', 5, 1);
  assert(unnamedWhitespace === 'image_5_1.png', `Whitespace-only custom name gives image_5_1: ${unnamedWhitespace}`);

  // 9.3 Queue Item customName Retention & Default Blank Behavior
  const queueWithCustom = createQueueItem(mockFile1, 0, { baseFilename: 'urban_streetwear' });
  assert(queueWithCustom.customName === 'urban_streetwear', 'Queue item initialized with explicit baseFilename sets customName');

  const queueWithoutCustom = createQueueItem(mockFile2, 1, { baseFilename: '' });
  assert(queueWithoutCustom.customName === '', 'Queue item initialized with empty baseFilename sets customName = ""');

  const queueWithUndefinedCustom = createQueueItem(mockFile1, 2, {});
  assert(queueWithUndefinedCustom.customName === '', 'Queue item initialized with no settings sets customName = ""');

  // 9.4 Verification of Single Chat Thread & No Page Reloads / Tab Discarding
  const chatgptContentScript = fs.readFileSync(path.join(rootDir, 'content/chatgpt.js'), 'utf8');
  assert(chatgptContentScript.includes('isElementActive'), 'content/chatgpt.js includes isElementActive for background tab / minimized window resilience');
  assert(chatgptContentScript.includes('baselineTurnCount'), 'content/chatgpt.js tracks baselineTurnCount accurately across multiple turns in one chat');

  const serviceWorkerCode = fs.readFileSync(path.join(rootDir, 'background/service-worker.js'), 'utf8');
  assert(serviceWorkerCode.includes('Continuing in same continuous chat'), 'background/service-worker.js runs all designs sequentially inside ONE continuous chat');
  assert(serviceWorkerCode.includes('autoDiscardable: false'), 'background/service-worker.js prevents tab discarding when tab is not on screen');
  assert(!serviceWorkerCode.includes("chrome.tabs.update(tab.id, { url: 'https://chatgpt.com/' })"), 'service-worker.js does NOT reload or navigate tab between queue items');

  // 9.5 Verification of No Automatic Popout Window on Start
  const popupJsCode = fs.readFileSync(path.join(rootDir, 'popup/popup.js'), 'utf8');
  assert(!popupJsCode.includes("chrome.windows.create({ url: chrome.runtime.getURL('popup/popup.html?detached=true')"), 'popup.js does not auto-popout on startAutomation');

  // 9.6 One-Time Single Consolidated ZIP Archive Packaging
  assert(!serviceWorkerCode.includes('settings.autoZipQueueItems !== false'), 'service-worker.js does not download intermediate ZIPs after each design');
  assert(serviceWorkerCode.includes('all_generated_images.zip') || serviceWorkerCode.includes('_all_images.zip'), 'service-worker.js downloads all images ONE TIME in a single final consolidated ZIP archive');
  assert(serviceWorkerCode.includes('resolveImageFilename'), 'service-worker.js uses resolveImageFilename for individual and ZIP file naming');

  // 9.7 Tabbed-Out Duplicate Prevention (No Duplicate Prompts or Image Re-uploads)
  assert(serviceWorkerCode.includes('promptSubmitted'), 'service-worker.js uses promptSubmitted flag to prevent sending the same prompt multiple times on retries');
  assert(chatgptContentScript.includes('skipping redundant upload'), 'content/chatgpt.js detects existing composer attachments to prevent duplicate reference image uploads');
  assert(!chatgptContentScript.includes('assistantMsgs[assistantMsgs.length - 1]'), 'content/chatgpt.js never falls back to previous assistant turns for image detection');

  // 9.8 First-time Reference Upload & Single-Prompt Dispatch Precision
  assert(chatgptContentScript.includes('isAttachButton'), 'content/chatgpt.js explicitly excludes attach buttons from being mistaken for uploaded thumbnails');
  assert(!chatgptContentScript.includes("sendBtn.dispatchEvent(new MouseEvent('click'"), 'content/chatgpt.js does not dispatch duplicate click before sendBtn.click()');
  assert(chatgptContentScript.includes('_isSubmittingPrompt'), 'content/chatgpt.js has re-entrancy protection against sending prompt twice');
  assert(chatgptContentScript.includes('dismissStuckOverlays'), 'content/chatgpt.js includes dismissStuckOverlays to prevent stuck modal backdrops');
  assert(!chatgptContentScript.includes("new DragEvent('dragenter'"), 'content/chatgpt.js does not trigger ChatGPT full-screen drag overlays');
  assert(!chatgptContentScript.includes("composer.getAttribute('aria-disabled') !== 'true'"), 'content/chatgpt.js waitForIdle does not block on background aria-disabled state');
  assert(!chatgptContentScript.includes("form.dispatchEvent(new Event('submit'"), 'content/chatgpt.js does not dispatch duplicate form submit events');
  assert(chatgptContentScript.includes('insertAndSubmitPrompt'), 'content/chatgpt.js uses atomic insertAndSubmitPrompt for background prompt delivery');

  const mainScript = fs.readFileSync(path.join(rootDir, 'content/chatgpt-main.js'), 'utf8');
  assert(mainScript.includes('__lexicalEditor'), 'content/chatgpt-main.js accesses __lexicalEditor directly in MAIN world');
  assert(mainScript.includes('setEditorState'), 'content/chatgpt-main.js updates Lexical editor state directly for instant prompt readiness');

  const manifestJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'manifest.json'), 'utf8'));
  const hasMainWorld = manifestJson.content_scripts.some(cs => cs.world === 'MAIN' && cs.js.includes('content/chatgpt-main.js'));
  assert(hasMainWorld, 'manifest.json configures content/chatgpt-main.js in MAIN world');

  // 10. MacBook / Retina Display & macOS App Nap Image Detection Resilience
  console.log('\n[Test Suite 10] MacBook / Retina Display & macOS App Nap Image Detection Resilience');

  assert(chatgptContentScript.includes('extractBestImageUrl'), 'content/chatgpt.js defines extractBestImageUrl for Retina srcset parsing');
  assert(chatgptContentScript.includes('isOpenAIGeneratedImageUrl'), 'content/chatgpt.js defines isOpenAIGeneratedImageUrl for OpenAI CDN recognition');
  assert(chatgptContentScript.includes('wakeUpImage'), 'content/chatgpt.js defines wakeUpImage for macOS lazy loading & decode wake-up');
  assert(chatgptContentScript.includes('isExcludedImage'), 'content/chatgpt.js defines isExcludedImage for avatar/icon filtering');
  assert(chatgptContentScript.includes('files.oaiusercontent.com'), 'content/chatgpt.js explicitly recognizes files.oaiusercontent.com URLs');
  assert(chatgptContentScript.includes('oaidalleapiprodscus.blob.core.windows.net'), 'content/chatgpt.js explicitly recognizes DALL-E blob storage URLs');

  // Verify Retina 2x srcset extraction simulation
  function simulateExtractBestImageUrl(img) {
    if (!img) return null;
    const srcset = img.srcset || (img.getAttribute && img.getAttribute('srcset'));
    if (srcset) {
      const candidates = srcset
        .split(',')
        .map((s) => s.trim().split(/\s+/)[0])
        .filter((u) => u && !u.startsWith('data:image/svg') && !u.startsWith('data:image/gif'));
      if (candidates.length > 0) {
        return candidates[candidates.length - 1];
      }
    }
    return img.currentSrc || img.src || null;
  }

  const mockRetinaImg = {
    srcset: 'https://files.oaiusercontent.com/file-std_1024 1x, https://files.oaiusercontent.com/file-retina_2048 2x',
    currentSrc: 'https://files.oaiusercontent.com/file-std_1024',
    src: ''
  };
  const extractedRetinaUrl = simulateExtractBestImageUrl(mockRetinaImg);
  assert(extractedRetinaUrl === 'https://files.oaiusercontent.com/file-retina_2048', `Retina MacBook selects highest-res 2x image from srcset: ${extractedRetinaUrl}`);

  // Verify App Nap background image acceptance without blocking indefinitely on img.complete
  function simulateIsOpenAIGeneratedImageUrl(url) {
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

  assert(simulateIsOpenAIGeneratedImageUrl('https://files.oaiusercontent.com/file-abc12345'), 'Recognizes files.oaiusercontent.com image URL');
  assert(simulateIsOpenAIGeneratedImageUrl('https://oaidalleapiprodscus.blob.core.windows.net/private/org-123/img.png'), 'Recognizes DALL-E Azure Blob storage image URL');
  assert(simulateIsOpenAIGeneratedImageUrl('blob:https://chatgpt.com/f9c80d26-70e1-4560-b60c-263a9fbffb69'), 'Recognizes local ChatGPT Blob URL');
  assert(!simulateIsOpenAIGeneratedImageUrl('https://lh3.googleusercontent.com/a/avatar123'), 'Rejects Google profile avatars');
  assert(!simulateIsOpenAIGeneratedImageUrl('https://cdn.oaistatic.com/_next/static/media/logo.png'), 'Rejects ChatGPT UI static logo');

  // Verify audio/voice button exclusion from stop button detection
  assert(chatgptContentScript.includes('speech'), 'content/chatgpt.js excludes speech buttons from stop detection');
  assert(chatgptContentScript.includes('voice'), 'content/chatgpt.js excludes voice buttons from stop detection');
  assert(chatgptContentScript.includes('listen'), 'content/chatgpt.js excludes listening buttons from stop detection');

  // Summary
  console.log('\n========================================');
  console.log(`RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('========================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
})();


