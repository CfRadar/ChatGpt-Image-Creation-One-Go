// utils/storage.js
// Chrome Storage API wrapper for PromptFlow

export const STORAGE_KEYS = {
  SESSION: 'promptflow_active_session',
  SETTINGS: 'promptflow_settings',
  HISTORY: 'promptflow_history'
};

export const DEFAULT_SETTINGS = {
  generationTimeoutMinutes: 5,
  downloadRetries: 3,
  delayBetweenPromptsSeconds: 2,
  downloadFolder: 'PromptFlow',
  folderPattern: 'flat', // 'flat' | 'date' | 'session'
  baseFilename: 'name',
  autoStartNext: true,
  keepSessionHistory: true,
  debugMode: true
};

export const PROMPT_STATUS = {
  WAITING: 'waiting',
  UPLOADING: 'uploading',
  GENERATING: 'generating',
  DETECTING: 'detecting',
  DOWNLOADING: 'downloading',
  COMPLETED: 'completed',
  FAILED: 'failed',
  SKIPPED: 'skipped'
};

export const AUTOMATION_STATE = {
  IDLE: 'IDLE',
  PREPARING: 'PREPARING',
  OPENING_CHATGPT: 'OPENING_CHATGPT',
  CHECKING_CHATGPT: 'CHECKING_CHATGPT',
  UPLOADING_REFERENCE: 'UPLOADING_REFERENCE',
  WAITING_FOR_UPLOAD: 'WAITING_FOR_UPLOAD',
  SENDING_PROMPT: 'SENDING_PROMPT',
  WAITING_FOR_GENERATION: 'WAITING_FOR_GENERATION',
  DETECTING_IMAGE: 'DETECTING_IMAGE',
  DOWNLOADING_IMAGE: 'DOWNLOADING_IMAGE',
  NEXT_PROMPT: 'NEXT_PROMPT',
  PAUSED: 'PAUSED',
  STOPPED: 'STOPPED',
  ERROR: 'ERROR',
  COMPLETED: 'COMPLETED'
};

export const DEFAULT_PROMPT_TITLES = [
  'Front View (Model)',
  'Back View (Model)',
  'Side Profile (Model)',
  'Neckline & Collar Close-Up',
  'Graphic Print Close-Up',
  'Listing Infographic'
];

export const DEFAULT_PROMPT_TEXTS = [
  // 1) Front View
  `Use the uploaded reference image as the exact source of truth for the T-shirt.

Create a premium e-commerce fashion photograph of an attractive, hot and sexy adult female fashion model wearing the exact same oversized T-shirt shown in the reference image.

FRONT VIEW ONLY.

EXACT FRAMING & CROPPING (CRITICAL):
Medium-shot portrait, tightly framed from just above the model's head down to MID-THIGH only. The bottom of the image cuts off at mid-thigh, just below the shorts. ABSOLUTELY NO knees, NO lower legs, NO calves, NO feet, NO sneakers/shoes, and NO floor in the frame. The model's head, face, and the entire T-shirt must dominate and fill the frame vertically.

STYLING & POSE:
The model is styled wearing fitted black retro dolphin shorts with white trim beneath the oversized T-shirt. Pose with hands naturally behind her back so the front of the oversized T-shirt hangs flat, smooth, and completely unobstructed from collar to hem. The model has gorgeous long dark wavy hair casually draped over her shoulders, radiant skin, tasteful makeup, and a warm, charming, confident, hot and sexy smile looking toward the camera.

T-SHIRT FIDELITY:
The T-shirt must remain completely faithful to the reference: identical color, fabric appearance, oversized fit, length, shoulder width, sleeve length, neckline, stitching, seams, proportions, graphics, artwork, print placement, print size, and print colors. Do not redesign, reinterpret, simplify, or alter the garment or its print.

LIGHTING & BACKGROUND:
Clean pure white seamless studio background (#FFFFFF), soft professional portrait studio lighting, no floor or ground shadow, photorealistic skin and fabric texture.

Photorealistic, sharp focus, clean, premium e-commerce fashion product photography suitable for Meesho, Amazon, Flipkart listings.`,

  // 2) Back View
  `Use the uploaded reference image as the exact source of truth for the T-shirt and maintain the same adult female model, body proportions, styling, lighting, and studio environment as the previous image.

Create a premium e-commerce fashion photograph showing the BACK VIEW of the exact same oversized T-shirt worn by the same hot and sexy model.

BACK VIEW ONLY.

EXACT FRAMING & CROPPING (CRITICAL):
Medium-shot portrait, tightly framed from just above the model's head down to MID-THIGH only. The bottom of the image cuts off at mid-thigh, just below the shorts. ABSOLUTELY NO knees, NO lower legs, NO calves, NO feet, NO sneakers/shoes, and NO floor in the frame. The back of the head, hair, and the entire back of the T-shirt must dominate and fill the frame vertically.

STYLING & POSE:
The model is turned completely around facing away from the camera, displaying the back of the T-shirt clearly. Styled in the same fitted black retro shorts with white trim. Natural confident posture with arms at sides or behind, keeping the back of the garment flat, smooth, and fully visible from collar to hem.

T-SHIRT FIDELITY:
The back of the T-shirt must be plain and contain NO printed graphic unless a back print is visibly present in the reference image. Preserve the exact garment construction from the reference: identical color, fabric, oversized silhouette, length, shoulder width, sleeve shape, neckline, stitching, seams, and natural fabric behavior. Do not invent any back artwork or branding.

LIGHTING & BACKGROUND:
Clean pure white seamless studio background (#FFFFFF), soft diffused commercial portrait lighting, no floor or ground shadow, realistic fabric folds and natural skin texture.

Photorealistic premium fashion e-commerce photography suitable for marketplace product listings.`,

  // 3) Side Profile
  `Use the uploaded reference image as the exact source of truth for the T-shirt and maintain the same adult female model, appearance, body proportions, styling, lighting, and studio environment as the previous images.

Create a premium e-commerce fashion photograph showing a CLEAR SIDE PROFILE of the same hot and sexy model wearing the exact same oversized T-shirt.

SIDE VIEW ONLY, approximately 90-degree profile.

EXACT FRAMING & CROPPING (CRITICAL):
Medium-shot portrait, tightly framed from just above the model's head down to MID-THIGH only. The bottom of the image cuts off at mid-thigh, just below the shorts. ABSOLUTELY NO knees, NO lower legs, NO calves, NO feet, NO sneakers/shoes, and NO floor in the frame. The model's head, face profile, and the entire side silhouette of the T-shirt must fill the frame.

STYLING & POSE:
The model is shown in side profile, styled in the same fitted black retro shorts with white trim. Natural, elegant, alluring pose with arms positioned so the side drape, sleeve length, shoulder drop, and oversized T-shirt silhouette are completely visible and unobstructed.

T-SHIRT FIDELITY:
The T-shirt must remain identical to the reference image in color, fabric, construction, proportions, neckline, sleeves, stitching, seams, print characteristics, and overall design. Do not modify or redesign the garment.

LIGHTING & BACKGROUND:
Clean pure white seamless studio background (#FFFFFF), soft commercial studio lighting, realistic fabric draping, realistic shadows on garment folds, no floor or ground shadow.

Photorealistic high-end clothing catalog photography designed for online fashion marketplaces.`,

  // 4) Neckline and Collar Close-Up
  `Use the uploaded reference image as the exact source of truth for the T-shirt.

Create an ultra-realistic professional e-commerce PRODUCT DETAIL CLOSE-UP focusing exclusively on the neckline and collar of the exact same T-shirt.

Show ONLY the upper neck/collar region of the garment, with enough surrounding fabric to clearly demonstrate the neckline construction.

The image must accurately reproduce the reference T-shirt's exact collar shape, collar width, ribbing, stitching, thickness, fabric texture, color, seam construction, and natural material appearance.

The collar must not be redesigned or stylized.

Use a straight-on, carefully controlled product-photography camera angle. The neckline should be centered and occupy most of the frame.

Show realistic cotton/fabric texture, fine stitching, subtle natural wrinkles and realistic construction details. If a neck label is visible in the reference, reproduce it accurately; do not invent or replace it.

Clean white or very light neutral studio background, soft diffused lighting, extremely sharp focus, realistic shadows, premium commercial product photography.

No model face, no full body, no unnecessary props, no additional text, no watermark.

Macro-level clothing detail photography suitable for an e-commerce product listing.`,

  // 5) Graphic Print Close-Up
  `Use the uploaded reference image as the exact source of truth for the T-shirt print.

Create an ultra-realistic high-resolution PRODUCT DETAIL CLOSE-UP showing ONLY the printed graphic/design on the T-shirt.

The print must be reproduced EXACTLY as it appears in the reference image.

Preserve every visible element of the original artwork: exact shapes, illustrations, typography, lettering, symbols, colors, outlines, textures, distressed effects, proportions, spacing, orientation, and print placement.

DO NOT redesign, rewrite, reinterpret, regenerate, correct, beautify, replace, or invent any text or artwork.

The graphic must remain visually identical to the reference.

Show the print applied naturally onto the actual T-shirt fabric, including realistic fabric texture, subtle wrinkles, slight material deformation, realistic ink/print texture and natural lighting. Do not make the artwork appear digitally pasted onto the shirt.

Crop tightly around the printed area so the print is the primary and dominant subject. Show enough surrounding fabric to establish that the graphic is printed on the T-shirt.

Clean neutral/white studio presentation, professional commercial product photography, extremely sharp details, accurate colors, realistic fabric texture.

No model face, no unnecessary background elements, no additional graphics, no invented text, no watermark.

High-resolution e-commerce product-detail photography.`,

  // 6) Marketplace Product Listing Infographic
  `Use the uploaded reference image as the exact source of truth for the T-shirt itself.

Create a premium fashion e-commerce PRODUCT LISTING INFOGRAPHIC based on the visual structure and presentation style of the supplied reference image.

The final image should look like a professionally designed marketplace listing image for an oversized T-shirt.

IMPORTANT: The supplied product/reference image determines the actual garment. Preserve the exact T-shirt design, color, fabric appearance, silhouette, oversized proportions, neckline, sleeves, stitching, seams, artwork, graphics, print placement and print colors. Do not redesign the product.

Create a clean premium white/light-neutral background with a sophisticated fashion-catalog aesthetic.

MAIN COMPOSITION:
Place a large, highly realistic front view of the exact T-shirt prominently on the left or center-left side. Make the T-shirt the dominant visual element.

On the opposite side, create a clean organized product-information area containing concise visual feature callouts relevant to the actual garment, such as:
• Oversized fit
• Fabric/material
• Comfortable feel
• Short sleeves
• Round neck
• Print/design
• Lightweight/breathable construction
• Casual/streetwear styling

Only mention attributes that can reasonably be determined from the reference image. Do not invent technical specifications, fabric composition, measurements, certifications, or performance claims.

Add several smaller premium close-up panels along the bottom showing useful details of the same T-shirt, such as:
1. neckline/collar
2. fabric texture
3. printed design
4. sleeve/hem stitching

All detail panels must show the exact same garment and must remain visually consistent with the main product.

Use elegant modern editorial typography, balanced spacing, thin separators, subtle neutral design elements, minimal decorative graphics, and a premium Indian e-commerce fashion-catalog aesthetic.

The layout should feel similar in information density and professional presentation to the supplied reference, but DO NOT copy any brand name, exact wording, logo, or proprietary graphic from the reference unless it belongs to the actual T-shirt being displayed.

Maintain perfect consistency of the garment across every panel.

Clean white background, realistic product photography, soft studio lighting, subtle shadows, accurate colors, sharp fabric details, polished commercial retouching.

No unnecessary models, no lifestyle scene, no clutter, no watermark, no invented product claims.

Final result should look like a ready-to-use premium marketplace product listing image for Meesho, Amazon, Flipkart or similar e-commerce platforms.`
];

export function createDefaultPrompts(count = 6) {
  const prompts = [];
  for (let i = 1; i <= count; i++) {
    prompts.push({
      id: i,
      title: DEFAULT_PROMPT_TITLES[i - 1] || `Prompt ${i}`,
      text: DEFAULT_PROMPT_TEXTS[i - 1] || '',
      enabled: true,
      status: PROMPT_STATUS.WAITING,
      filename: null,
      imageUrl: null,
      retries: 0,
      maxRetries: 3,
      error: null,
      startedAt: null,
      completedAt: null
    });
  }
  return prompts;
}

export function createInitialSession() {
  return {
    sessionId: `session_${Date.now()}`,
    state: AUTOMATION_STATE.IDLE,
    statusMessage: 'Ready to start automation',
    currentPromptIndex: 0,
    referenceImage: null, // { name: string, type: string, size: number, dataUrl: string }
    referenceUploaded: false,
    baseFilename: 'name',
    defaultsInitialized: true,
    prompts: createDefaultPrompts(6),
    stats: {
      total: 0,
      completed: 0,
      failed: 0,
      skipped: 0
    },
    startedAt: null,
    completedAt: null,
    lastUpdated: Date.now(),
    tabId: null,
    error: null
  };
}

class StorageManager {
  async get(key, defaultValue = null) {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      return defaultValue;
    }
    try {
      const result = await chrome.storage.local.get([key]);
      return result[key] !== undefined ? result[key] : defaultValue;
    } catch (e) {
      console.error(`StorageManager.get error for ${key}:`, e);
      return defaultValue;
    }
  }

  async set(key, value) {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      return;
    }
    try {
      await chrome.storage.local.set({ [key]: value });
    } catch (e) {
      console.error(`StorageManager.set error for ${key}:`, e);
    }
  }

  async remove(key) {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      return;
    }
    try {
      await chrome.storage.local.remove([key]);
    } catch (e) {
      console.error(`StorageManager.remove error for ${key}:`, e);
    }
  }

  // Active Session
  async getSession() {
    let session = await this.get(STORAGE_KEYS.SESSION, null);
    if (!session) {
      session = createInitialSession();
      await this.saveSession(session);
      return session;
    }
    // Ensure all 6 prompts structure exists
    if (!Array.isArray(session.prompts) || session.prompts.length === 0) {
      session.prompts = createDefaultPrompts(6);
      session.defaultsInitialized = true;
      await this.saveSession(session);
      return session;
    }
    // If upgrading from older version without default prompts populated,
    // and all prompts are empty, automatically initialize with 6 default prompts
    if (!session.defaultsInitialized) {
      const allEmpty = session.prompts.every((p) => !p.text || !p.text.trim());
      if (allEmpty) {
        session.prompts = createDefaultPrompts(session.prompts.length || 6);
      }
      session.defaultsInitialized = true;
      await this.saveSession(session);
    }
    return session;
  }

  async saveSession(session) {
    session.lastUpdated = Date.now();
    await this.set(STORAGE_KEYS.SESSION, session);
    return session;
  }

  async updateSession(updates) {
    const current = await this.getSession();
    const updated = { ...current, ...updates, lastUpdated: Date.now() };
    await this.set(STORAGE_KEYS.SESSION, updated);
    return updated;
  }

  async resetSession() {
    const newSession = createInitialSession();
    await this.saveSession(newSession);
    return newSession;
  }

  async resetSessionPreservingInputs() {
    const current = await this.getSession();
    const updatedPrompts = (current.prompts || createDefaultPrompts(6)).map(p => ({
      ...p,
      status: PROMPT_STATUS.WAITING,
      imageUrl: null,
      filename: null,
      retries: 0,
      error: null,
      startedAt: null,
      completedAt: null
    }));

    const newSession = {
      ...createInitialSession(),
      baseFilename: current.baseFilename || 'name',
      referenceImage: current.referenceImage || null,
      referenceUploaded: false,
      prompts: updatedPrompts,
      state: AUTOMATION_STATE.IDLE,
      statusMessage: 'Ready to start automation',
      currentPromptIndex: 0,
      error: null
    };
    await this.saveSession(newSession);
    return newSession;
  }

  // Settings
  async getSettings() {
    const stored = await this.get(STORAGE_KEYS.SETTINGS, null);
    return stored ? { ...DEFAULT_SETTINGS, ...stored } : { ...DEFAULT_SETTINGS };
  }

  async saveSettings(settings) {
    const merged = { ...DEFAULT_SETTINGS, ...settings };
    await this.set(STORAGE_KEYS.SETTINGS, merged);
    return merged;
  }

  // History
  async getHistory() {
    const history = await this.get(STORAGE_KEYS.HISTORY, []);
    return Array.isArray(history) ? history : [];
  }

  async addHistoryEntry(entry) {
    const history = await this.getHistory();
    const newEntry = {
      id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toISOString(),
      ...entry
    };
    history.unshift(newEntry);
    // Keep up to 50 entries
    if (history.length > 50) {
      history.splice(50);
    }
    await this.set(STORAGE_KEYS.HISTORY, history);
    return newEntry;
  }

  async clearHistory() {
    await this.set(STORAGE_KEYS.HISTORY, []);
  }
}

export const storage = new StorageManager();
export default storage;
