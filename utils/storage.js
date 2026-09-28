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
  baseFilename: '',
  autoStartNext: true,
  keepSessionHistory: true,
  debugMode: true,

  // Apparel & Model Customization
  modelGender: 'female', // 'female' | 'male'
  tshirtType: 'same', // 'same' (matches reference image hoodie, t-shirt, etc.) or custom string like 'hoodie', 'oversized', etc.
  sleeveType: 'same', // 'same' (matches reference sleeve length) or custom string like 'long', 'short', 'sleeveless', etc.
  zoomType: 'medium', // 'medium' | 'full_body' | 'torso_zoom' | 'macro_zoom' (Model Framing)
  printZoomType: 'tight', // 'tight' | 'chest_macro' | 'extreme_macro' | 'flat_lay' (Print Zoom Preset)
  startingPoseOffset: 0, // 0..9 (Preset Sets 1 to 10)
  autoZipQueueItems: false // only download once at the end in a single consolidated ZIP
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

// ============================================================================
// 30 CATALOG POSES: 3 Angles x 10 Presets
// Angle 1: Front View (Model in printed T-shirt)
// Angle 2: Back View (Model showing back of T-shirt, clean/no print)
// Angle 3: Side View (Model in side profile / 3/4 turn showing drape & fit)
// ============================================================================

export const FRONT_POSES = [
  {
    id: 1,
    angle: 'front',
    name: 'Front 1: Classic Natural Stance',
    shortName: 'Classic Front',
    direction: 'FRONT VIEW ONLY',
    description: 'Standing front-facing in a clean, relaxed, confident posture with hands held naturally behind the back or relaxed at sides, keeping the front of the T-shirt completely smooth, flat, and unobstructed from collar to hem. Direct, warm, charismatic smile looking toward the camera.'
  },
  {
    id: 2,
    angle: 'front',
    name: 'Front 2: Hands in Pockets Casual',
    shortName: 'Pockets Front',
    direction: 'FRONT VIEW - HANDS IN POCKETS',
    description: 'Standing in a relaxed streetwear stance with thumbs or hands tucked naturally into shorts/pants pockets, shoulders dropped comfortably, displaying the front chest print cleanly without creasing or obstruction.'
  },
  {
    id: 3,
    angle: 'front',
    name: 'Front 3: Dynamic In-Motion Walk',
    shortName: 'In-Motion Walk',
    direction: 'FRONT VIEW - DYNAMIC WALKING STRIDE',
    description: 'Captured in a natural forward walking stride toward the camera, arms in a gentle relaxed mid-motion swing, creating realistic lifestyle garment movement while keeping the main chest print fully facing camera and clearly legible.'
  },
  {
    id: 4,
    angle: 'front',
    name: 'Front 4: Loose Cross-Arms Confident',
    shortName: 'Folded Arms Front',
    direction: 'FRONT VIEW - RELAXED FOLDED ARMS',
    description: 'Standing tall with arms loosely and naturally crossed low across the waist (comfortably below the chest graphic), exuding confidence, keeping the front graphic print flat, centered, and completely unobstructed.'
  },
  {
    id: 5,
    angle: 'front',
    name: 'Front 5: Hand Near Collar / Hair',
    shortName: 'Collar Touch Front',
    direction: 'FRONT VIEW - EDITORIAL TOUCH',
    description: 'One hand casually raised brushing hair behind the ear or lightly resting near the collarbone, other arm relaxed naturally down, creating a stylish high-fashion catalog lookbook aesthetic while showcasing the neckline and front print.'
  },
  {
    id: 6,
    angle: 'front',
    name: 'Front 6: Thumbs Hooked in Waistband',
    shortName: 'Waistband Thumbs',
    direction: 'FRONT VIEW - THUMBS HOOKED',
    description: 'Thumbs hooked lightly in the front waistband or pocket edges with elbows gently angled back, naturally tensioning the front fabric to keep the graphic completely flat, wide, and centered for maximum visibility.'
  },
  {
    id: 7,
    angle: 'front',
    name: 'Front 7: Casual Weight-Shift Hip Lean',
    shortName: 'Weight Shift Front',
    direction: 'FRONT VIEW - WEIGHT SHIFT',
    description: 'Casual weight shifted onto one hip with one hand resting lightly on the hip, gentle stylish head tilt, creating subtle diagonal fabric folds and an effortlessly stylish commercial streetwear look.'
  },
  {
    id: 8,
    angle: 'front',
    name: 'Front 8: Subtle 15° Torso Angle Pivot',
    shortName: '15° Pivot Front',
    direction: 'FRONT VIEW - SUBTLE ANGLE PIVOT',
    description: 'Torso angled just 15 degrees from center while shoulders and gaze remain squarely focused on the camera, accentuating the model\'s athletic posture and the front print dimension.'
  },
  {
    id: 9,
    angle: 'front',
    name: 'Front 9: Relaxed Lookbook Stance',
    shortName: 'Studio Lean Front',
    direction: 'FRONT VIEW - RELAXED STANCE',
    description: 'Relaxed studio posture with one foot slightly forward, shoulders relaxed, arms hanging naturally at sides with fingers gently curved, letting the front garment drape cleanly.'
  },
  {
    id: 10,
    angle: 'front',
    name: 'Front 10: Both Hands on Hips Power Pose',
    shortName: 'Power Stance Front',
    direction: 'FRONT VIEW - POWER STANCE',
    description: 'Confident lookbook stance with both hands placed lightly on hips, elbows back, framing the torso and keeping the entire front graphic print prominent, flat, and centered.'
  }
];

export const BACK_POSES = [
  {
    id: 1,
    angle: 'back',
    name: 'Back 1: Classic Straight Rear View',
    shortName: 'Straight Back',
    direction: 'BACK VIEW ONLY',
    description: 'Standing squarely facing away from the camera, posture upright and balanced, arms resting naturally at sides, showing the clean plain back of the T-shirt completely smooth, flat, and unobstructed from collar to hem.'
  },
  {
    id: 2,
    angle: 'back',
    name: 'Back 2: Over-The-Shoulder Right Glance',
    shortName: 'Over-Shoulder Right',
    direction: 'BACK VIEW - OVER-THE-SHOULDER GLANCE',
    description: 'Model positioned with back facing camera, casually turning head over right shoulder with a confident, attractive glance back at the camera, while the back fabric of the T-shirt remains smooth, flat, and clearly visible.'
  },
  {
    id: 3,
    angle: 'back',
    name: 'Back 3: Hands in Rear Pockets Stance',
    shortName: 'Rear Pockets Back',
    direction: 'BACK VIEW - HANDS IN REAR POCKETS',
    description: 'Standing facing away from the camera with thumbs hooked casually into the back pockets of shorts/chinos, pulling the back of the T-shirt taut and smooth to showcase shoulder width and clean back construction.'
  },
  {
    id: 4,
    angle: 'back',
    name: 'Back 4: Gentle In-Motion Step Away',
    shortName: 'Walking Away Back',
    direction: 'BACK VIEW - WALKING AWAY',
    description: 'Captured in a gentle walking stride moving away from the camera, arms swinging naturally, showing authentic lifestyle fabric drape and clean back garment movement.'
  },
  {
    id: 5,
    angle: 'back',
    name: 'Back 5: Looking Over Left Shoulder',
    shortName: 'Left Glance Back',
    direction: 'BACK VIEW - LEFT SHOULDER GLANCE',
    description: 'Full back view of the garment with the model gracefully looking back over the left shoulder, showcasing the clean back yoke, neck ribbing, and shoulder drop.'
  },
  {
    id: 6,
    angle: 'back',
    name: 'Back 6: Hands Loosely Behind Waist',
    shortName: 'Hands Behind Back',
    direction: 'BACK VIEW - HANDS LOOSELY BEHIND',
    description: 'Standing facing away with hands loosely clasped behind the lower back, accentuating the clean straight drape and natural sleeve hang.'
  },
  {
    id: 7,
    angle: 'back',
    name: 'Back 7: Hand Touching Nape / Collar',
    shortName: 'Nape Touch Back',
    direction: 'BACK VIEW - EDITORIAL NAPE TOUCH',
    description: 'One hand casually raised touching the back of the neck or brushing hair up, exposing the back neckline and collar ribbing with refined catalog elegance.'
  },
  {
    id: 8,
    angle: 'back',
    name: 'Back 8: Subtle 15° Rear Angle Turn',
    shortName: '15° Turn Back',
    direction: 'BACK VIEW - SLIGHT REAR ANGLE',
    description: 'Back turned 15 degrees from center, revealing the curvature of the back shoulder and side seam while keeping the back panel as the dominant subject.'
  },
  {
    id: 9,
    angle: 'back',
    name: 'Back 9: Relaxed Weight Shift Posture',
    shortName: 'Contra Posture Back',
    direction: 'BACK VIEW - CONTRA POSTURE',
    description: 'Relaxed streetwear back pose with weight placed onto one leg, one arm hanging naturally, the other hand slightly resting near waistband, showing natural garment folds.'
  },
  {
    id: 10,
    angle: 'back',
    name: 'Back 10: Symmetrical Clean Catalog Stance',
    shortName: 'Symmetrical Back',
    direction: 'BACK VIEW - SYMMETRICAL CATALOG',
    description: 'Perfect symmetrical catalog stance facing directly away, arms hanging straight down at sides, displaying the exact garment back proportions, sleeve cuffs, and bottom hemline.'
  }
];

export const SIDE_POSES = [
  {
    id: 1,
    angle: 'side',
    name: 'Side 1: Clean 90° Profile Right',
    shortName: '90° Profile Right',
    direction: 'SIDE PROFILE VIEW (90 DEGREES - RIGHT)',
    description: 'Clean 90-degree right side profile view, posture upright and elegant, arms positioned naturally to reveal the side silhouette, sleeve length, shoulder drop, and relaxed drape of the T-shirt without blocking the garment.'
  },
  {
    id: 2,
    angle: 'side',
    name: 'Side 2: Clean 90° Profile Left',
    shortName: '90° Profile Left',
    direction: 'SIDE PROFILE VIEW (90 DEGREES - LEFT)',
    description: 'Clean 90-degree left side profile view, showcasing the left sleeve construction, armhole drape, hemline drop, and side seam alignment cleanly against the studio background.'
  },
  {
    id: 3,
    angle: 'side',
    name: 'Side 3: 45° Three-Quarter Dynamic Turn',
    shortName: '45° Dynamic Turn',
    direction: 'THREE-QUARTER VIEW (45 DEGREES)',
    description: 'Torso turned at a 45-degree angle to the camera with one shoulder slightly forward and head turned facing the camera, showing both the front chest artwork and the natural side drape, sleeve cut, and shoulder drop of the garment.'
  },
  {
    id: 4,
    angle: 'side',
    name: 'Side 4: Forward Hand in Pocket Profile',
    shortName: 'Side Pocket Hand',
    direction: 'SIDE PROFILE - FRONT HAND IN POCKET',
    description: 'Side profile stance with the forward hand tucked casually into the front pocket, pulling the side fabric gently to highlight the sleeve cut and side torso drape.'
  },
  {
    id: 5,
    angle: 'side',
    name: 'Side 5: Dynamic In-Motion Profile Stride',
    shortName: 'Side Dynamic Stride',
    direction: 'SIDE PROFILE - IN-MOTION STRIDE',
    description: 'Side profile captured in a fluid mid-stride walking motion across the frame, showcasing the flow, movement, and silhouette of the T-shirt in motion.'
  },
  {
    id: 6,
    angle: 'side',
    name: 'Side 6: Profile Gaze Straight Ahead',
    shortName: 'Side Look Ahead',
    direction: 'SIDE PROFILE - LOOKING FORWARD',
    description: 'Sharp side profile with model gazing straight ahead in profile, chin slightly lifted, accentuating the clean neckline and side silhouette of the garment.'
  },
  {
    id: 7,
    angle: 'side',
    name: 'Side 7: 45° Angle Gentle Shoulder Glance',
    shortName: '45° Glance Side',
    direction: 'THREE-QUARTER VIEW - HEAD TURN',
    description: 'Model angled at 45 degrees with head turned with a direct charming gaze toward the lens, bridging side profile silhouette with expressive catalog portraiture.'
  },
  {
    id: 8,
    angle: 'side',
    name: 'Side 8: Side Profile Hand on Hip',
    shortName: 'Side Hand on Hip',
    direction: 'SIDE PROFILE - HAND ON HIP',
    description: 'Side profile with the camera-facing hand resting firmly on the hip, elbow angled back to completely clear the side of the torso, giving a clean view of the side seam and hem.'
  },
  {
    id: 9,
    angle: 'side',
    name: 'Side 9: Relaxed Streetwear Profile Lean',
    shortName: 'Side Relaxed Lean',
    direction: 'SIDE PROFILE - RELAXED POSTURE',
    description: 'Effortless side profile streetwear posture with a subtle lean back, soft shoulder drop, showing the oversized or tailored side drape naturally.'
  },
  {
    id: 10,
    angle: 'side',
    name: 'Side 10: Upright Minimalist High Fashion',
    shortName: 'Side Minimalist',
    direction: 'SIDE PROFILE - MINIMALIST HIGH FASHION',
    description: 'Sleek, minimalist side profile posture with shoulders pulled back, arms straight down, displaying the sleeve length and garment drop with mathematical precision.'
  }
];

// Combined array of all 30 poses (3 angles * 10 presets)
export const PRESET_POSES = [...FRONT_POSES, ...BACK_POSES, ...SIDE_POSES];

// 10 Preset Sets (Front + Back + Side combo for each rotation index 0..9)
export const POSE_SETS = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  name: `Preset ${i + 1}: ${FRONT_POSES[i].shortName} / ${BACK_POSES[i].shortName} / ${SIDE_POSES[i].shortName}`,
  front: FRONT_POSES[i],
  back: BACK_POSES[i],
  side: SIDE_POSES[i]
}));

export const MODEL_GENDERS = {
  female: {
    id: 'female',
    label: 'Female Model',
    description: 'an attractive, hot and sexy adult female fashion model with an athletic build and radiant skin',
    styling: 'The model is styled wearing fitted black retro dolphin shorts with white trim beneath the T-shirt. The model has gorgeous long dark wavy hair casually draped over her shoulders, radiant skin, tasteful makeup, and a warm, charming, confident, hot and sexy smile looking toward the camera.'
  },
  male: {
    id: 'male',
    label: 'Male Model',
    description: 'a handsome, athletic, and stylish adult male fashion model with a fit build and well-groomed hair',
    styling: 'The model is styled wearing clean tailored dark streetwear shorts/chinos beneath the T-shirt. The model has modern well-groomed hair, confident masculine posture, radiant skin, and a friendly, charismatic expression looking toward the camera.'
  }
};

export const TSHIRT_TYPES = {
  same: {
    id: 'same',
    label: 'Same as Reference',
    description: 'The T-shirt fit, silhouette, and construction must be identical to the reference image: faithfully replicate the exact garment cut, drape, shoulder drop, sleeve length, and fit shown in the reference image without altering its style.'
  },
  oversized: {
    id: 'oversized',
    label: 'Oversized Fit',
    description: 'The T-shirt has an oversized, drop-shoulder streetwear fit: roomy loose silhouette, wide dropped shoulders, relaxed elbow-length sleeves, and an elongated body drape hanging freely.'
  },
  normal: {
    id: 'normal',
    label: 'Regular / Normal Fit',
    description: 'The T-shirt has a classic regular/normal fit: standard tailored shoulders, comfortable standard cut through the torso, standard short sleeves, and a classic straight hemline.'
  },
  slim: {
    id: 'slim',
    label: 'Slim Fit',
    description: 'The T-shirt has a tailored slim fit: neatly contouring the chest, shoulders, and torso with tapered sleeves, showcasing a modern fitted athletic silhouette.'
  },
  boxy: {
    id: 'boxy',
    label: 'Boxy Heavyweight Fit',
    description: 'The T-shirt has a modern boxy streetwear fit: wide square torso cut, structured heavyweight drape, dropped shoulders, and slightly cropped wide body.'
  },
  crop: {
    id: 'crop',
    label: 'Crop T-Shirt',
    description: 'The T-shirt has a stylish cropped cut: relaxed shoulders, hemline cut short resting comfortably at waist level, modern casual streetwear style.'
  },
  polo: {
    id: 'polo',
    label: 'Polo Collar T-Shirt',
    description: 'The T-shirt is a polo collar style: ribbed collar with front button placket, tailored short sleeves, and clean smart-casual construction.'
  }
};

export const ZOOM_TYPES = {
  medium: {
    id: 'medium',
    label: 'Medium Shot (Head to Mid-Thigh)',
    description: 'Medium-shot portrait, tightly framed from just above the model\'s head down to MID-THIGH only. The bottom of the image cuts off at mid-thigh, just below the shorts. ABSOLUTELY NO knees, NO lower legs, NO calves, NO feet, NO sneakers/shoes, and NO floor in the frame. The model\'s head, face, and the entire T-shirt must dominate and fill the frame vertically.'
  },
  full_body: {
    id: 'full_body',
    label: 'Full Body Shot (Head to Toe)',
    description: 'Full-body vertical fashion lookbook shot, capturing the model completely from head to toe including clean minimalist footwear (white sneakers), centered against the seamless studio background, keeping the T-shirt clearly legible.'
  },
  torso_zoom: {
    id: 'torso_zoom',
    label: 'Torso / Waist-Up Zoomed',
    description: 'Close torso/waist-up shot, framed tightly from the collarbone/shoulders down to the waistline. Highly zoomed-in on the T-shirt chest graphic and fabric texture, keeping the garment as the absolute primary focus.'
  },
  macro_zoom: {
    id: 'macro_zoom',
    label: 'Extreme Macro Zoom',
    description: 'Ultra-tight macro crop focused directly on the graphic print and fabric weave, capturing realistic cotton texture, print ink depth, and fine stitching with microscopic clarity.'
  }
};

// ============================================================================
// PRINT IMAGE ZOOM PRESETS (for Graphic Print / Detail Image)
// ============================================================================
export const PRINT_ZOOM_TYPES = {
  tight: {
    id: 'tight',
    label: 'Tight Graphic Crop',
    shortLabel: 'Tight',
    description: 'Tightly cropped directly around the boundaries of the printed graphic artwork, keeping the print centered and filling the majority of the frame with clean, minimal surrounding garment margins.'
  },
  chest_macro: {
    id: 'chest_macro',
    label: 'Chest & Graphic View',
    shortLabel: 'Chest',
    description: 'Framed on the upper torso/chest graphic area, displaying the graphic artwork centered naturally on the garment chest with collar ribbing and natural shoulder drape context.'
  },
  extreme_macro: {
    id: 'extreme_macro',
    label: 'Extreme Macro (Ink/Texture)',
    shortLabel: 'Macro',
    description: 'Ultra-tight microscopic macro zoom focusing into the fine details of the graphic print, capturing rich ink texture, pigment film, and cotton knit fabric weave with extreme clarity.'
  },
  flat_lay: {
    id: 'flat_lay',
    label: 'Flat Lay Graphic',
    shortLabel: 'Flat',
    description: 'Crisp flat-lay product perspective of the front garment showing the printed design completely flat, unwrinkled, and geometrically balanced.'
  }
};

export function resolveGarmentFit(fitInput = 'same') {
  const clean = (typeof fitInput === 'string' && fitInput.trim().length > 0 ? fitInput : 'same').trim();
  const lower = clean.toLowerCase();

  // If user entered "same" or variants like "same as image", "same as reference"
  if (lower === 'same' || lower.includes('same as') || lower === 'reference' || lower === 'as image') {
    return {
      id: 'same',
      label: 'Same as Reference',
      apparelName: 'garment',
      isSame: true,
      description: 'GARMENT TYPE & SILHOUETTE (SAME AS REFERENCE): Replicate the exact garment type, cut, silhouette, fabric, drape, and construction visibly shown in the reference image: whether the reference image is a hoodie, pullover, crewneck sweatshirt, oversized T-shirt, jacket, polo, tank top, or any other apparel item, faithfully preserve that exact garment type, hood/collar, neckline, sleeves, and fit without changing or altering it.'
    };
  }

  // Predefined fits
  if (TSHIRT_TYPES[lower]) {
    const predefined = TSHIRT_TYPES[lower];
    const isPolo = lower === 'polo';
    return {
      id: predefined.id,
      label: predefined.label,
      apparelName: isPolo ? 'polo shirt' : 'T-shirt',
      isSame: false,
      description: predefined.description
    };
  }

  // Custom user input (e.g. "hoodie", "oversized hoodie", "sweatshirt", "denim jacket", "crop hoodie")
  const isHoodie = lower.includes('hoodie');
  const isJacket = lower.includes('jacket');
  const isSweatshirt = lower.includes('sweatshirt') || lower.includes('crewneck');
  const apparelName = isHoodie ? 'hoodie' : isJacket ? 'jacket' : isSweatshirt ? 'sweatshirt' : clean;

  return {
    id: 'custom',
    label: clean,
    apparelName,
    isSame: false,
    description: `GARMENT TYPE & FIT (${clean.toUpperCase()}): The garment must be an authentic ${clean}: accurately construct the silhouette, garment cut, fabric weight, drape, collar/hood, and sleeves to reflect a premium ${clean} while faithfully preserving the print, artwork, colors, and graphics from the reference image.`
  };
}

export function resolveSleeveType(sleeveInput = 'same') {
  const clean = (typeof sleeveInput === 'string' && sleeveInput.trim().length > 0 ? sleeveInput : 'same').trim();
  const lower = clean.toLowerCase();

  if (lower === 'same' || lower.includes('same as') || lower === 'reference' || lower === 'as image') {
    return {
      id: 'same',
      label: 'Same as Reference',
      isSame: true,
      description: 'SLEEVE LENGTH & STYLE (SAME AS REFERENCE): Replicate the exact sleeve length, sleeve cut, cuff finish, and armhole tailoring visibly shown in the reference image (whether short sleeves, long sleeves, sleeveless, 3/4 sleeves, or drop-shoulder sleeves), preserving that exact sleeve construction faithfully.'
    };
  }

  const isLong = lower.includes('long') || lower.includes('full');
  const isShort = lower.includes('short') && !lower.includes('sleeveless');
  const isSleeveless = lower.includes('sleeveless') || lower.includes('tank');
  const isThreeQuarter = lower.includes('3/4') || lower.includes('three quarter');
  const isHalf = lower.includes('half');

  let detailedSleeveDesc = '';
  if (isLong) {
    detailedSleeveDesc = 'The garment MUST have authentic LONG SLEEVES extending fully to the wrists, with clean finished/ribbed cuffs.';
  } else if (isShort) {
    detailedSleeveDesc = 'The garment MUST have classic SHORT SLEEVES ending at the mid-bicep with clean hemmed cuffs.';
  } else if (isSleeveless) {
    detailedSleeveDesc = 'The garment MUST be SLEEVELESS with clean bound armholes (tank top cut) with NO sleeves attached.';
  } else if (isThreeQuarter) {
    detailedSleeveDesc = 'The garment MUST have THREE-QUARTER (3/4) LENGTH SLEEVES ending comfortably just below the elbow.';
  } else if (isHalf) {
    detailedSleeveDesc = 'The garment MUST have RELAXED HALF-LENGTH SLEEVES extending down toward the elbow.';
  } else {
    detailedSleeveDesc = `The garment MUST be constructed with authentic ${clean} sleeves.`;
  }

  return {
    id: 'custom',
    label: clean,
    isSame: false,
    description: `MANDATORY SLEEVE CUSTOMIZATION (${clean.toUpperCase()}): Even if the reference image shows different sleeves, the model's garment MUST be tailored with ${clean} sleeves: ${detailedSleeveDesc}`
  };
}

export function calculatePoseIndices(queueIndex = 0, startingOffset = 0) {
  const presetIndex = (startingOffset + queueIndex) % 10;
  return [presetIndex, presetIndex, presetIndex];
}

export function buildPromptsForConfig(config = {}) {
  const genderKey = config.modelGender || 'female';
  const zoomKey = config.zoomType || 'medium';
  const poseIndices = Array.isArray(config.poseIndices) && config.poseIndices.length >= 3
    ? config.poseIndices
    : [0, 0, 0];

  const model = MODEL_GENDERS[genderKey] || MODEL_GENDERS.female;
  const fit = resolveGarmentFit(config.tshirtType || 'same');
  const sleeve = resolveSleeveType(config.sleeveType || 'same');
  const zoom = ZOOM_TYPES[zoomKey] || ZOOM_TYPES.medium;
  const printZoomKey = config.printZoomType || 'tight';
  const printZoom = PRINT_ZOOM_TYPES[printZoomKey] || PRINT_ZOOM_TYPES.tight;

  const frontIdx = (poseIndices[0] !== undefined ? poseIndices[0] : 0) % FRONT_POSES.length;
  const backIdx = (poseIndices[1] !== undefined ? poseIndices[1] : 0) % BACK_POSES.length;
  const sideIdx = (poseIndices[2] !== undefined ? poseIndices[2] : 0) % SIDE_POSES.length;

  const frontPose = FRONT_POSES[frontIdx] || FRONT_POSES[0];
  const backPose = BACK_POSES[backIdx] || BACK_POSES[0];
  const sidePose = SIDE_POSES[sideIdx] || SIDE_POSES[0];

  const fitLower = (config.tshirtType || 'same').toLowerCase();
  const isHoodie = fitLower.includes('hoodie') || fit.apparelName === 'hoodie';
  const isJacket = fitLower.includes('jacket') || fit.apparelName === 'jacket';
  const isSweatshirt = fitLower.includes('sweatshirt') || fitLower.includes('crewneck') || fit.apparelName === 'sweatshirt';
  const isCustomApparel = !fit.isSame;

  // Garment conversion rules
  let garmentConversionRule = '';
  if (isCustomApparel) {
    if (isHoodie) {
      garmentConversionRule = `MANDATORY GARMENT CONVERSION TO HOODIE (CRITICAL):
The user explicitly specified a HOODIE. Even if the uploaded reference image shows a T-shirt, flat graphic, mockup, or other apparel, DO NOT generate a T-shirt.
You MUST transform and convert the garment into an authentic hooded sweatshirt (hoodie):
• It MUST have an attached double-layered fabric hood draped naturally around the neck and upper back with hanging drawstrings and metal/fabric eyelets.
• It MUST have long sleeves with ribbed cuffs at the wrists${!sleeve.isSame ? ` (customized as: ${sleeve.label} sleeves)` : ''}.
• It MUST be made of heavyweight cozy cotton/fleece fabric with a ribbed bottom hem.
• It MUST NOT have short sleeves or a simple T-shirt crewneck collar.
• Faithfully transfer and apply the exact graphic artwork, illustrations, typography, and colors from the reference image onto the front chest of this hoodie.`;
    } else if (isJacket) {
      garmentConversionRule = `MANDATORY GARMENT CONVERSION TO JACKET (CRITICAL):
The user explicitly specified a JACKET (${fit.label}). Even if the uploaded reference image shows a T-shirt or graphic, DO NOT generate a T-shirt.
Transform the garment into an authentic ${fit.label} with full long sleeves${!sleeve.isSame ? ` (customized as: ${sleeve.label} sleeves)` : ''}, structured fabric, collar/lapels or stand collar, and front closure, displaying the reference artwork and colors on the garment.`;
    } else if (isSweatshirt) {
      garmentConversionRule = `MANDATORY GARMENT CONVERSION TO SWEATSHIRT (CRITICAL):
The user explicitly specified a SWEATSHIRT (${fit.label}). Even if the uploaded reference image shows a T-shirt, DO NOT generate a T-shirt.
Transform the garment into an authentic long-sleeve crewneck sweatshirt with ribbed collar, ribbed cuffs at the wrists${!sleeve.isSame ? ` (customized as: ${sleeve.label} sleeves)` : ''}, ribbed hem, and heavyweight fleece fabric, displaying the reference artwork and colors on the front chest.`;
    } else {
      garmentConversionRule = `MANDATORY GARMENT TYPE & FIT (${fit.label.toUpperCase()}):
The model MUST wear an authentic ${fit.label} (NOT a default t-shirt unless requested). Accurately construct the silhouette, garment cut, collar, and sleeves of a ${fit.label}, while faithfully applying the artwork, print, and colors from the reference image onto the garment.`;
    }
  } else {
    garmentConversionRule = `GARMENT TYPE & SILHOUETTE (SAME AS REFERENCE):
Replicate the exact garment type, cut, silhouette, drape, and sleeves shown in the reference image:
• Whether the reference image is an oversized T-shirt, regular T-shirt, hoodie, pullover, crewneck sweatshirt, or jacket, faithfully replicate that exact garment type, fit, and construction.
• If the reference image shows a T-shirt, the generated image MUST be a T-shirt with the exact same neckline and sleeves.
• If the reference image shows a hoodie, the generated image MUST be a hoodie.
• DO NOT add a hood, collar stand, or drawstrings if the reference is a normal T-shirt.
• DO NOT change or alter the garment type.`;
  }

  // Sleeve rule injection
  if (!sleeve.isSame) {
    garmentConversionRule += `\n• ${sleeve.description}`;
  }

  // Prompt 1: Front View with Model in Printed Garment
  const prompt1 = `Reference Image Guide:
${isCustomApparel ? `Use the uploaded reference image for the graphic print, artwork, colors, and design styling. The garment itself must be transformed into a ${fit.label}.` : `Use the uploaded reference image as the exact source of truth for both the garment type and the artwork.`}

Create a premium e-commerce fashion photograph of ${model.description} wearing ${isCustomApparel ? `a ${fit.label} featuring the exact printed graphic from the reference image` : `the ${fit.apparelName} shown in the reference image`}.

FRONT VIEW ONLY:
${frontPose.direction}.
The model is facing the camera displaying the front of the ${fit.apparelName} with the printed graphic/design clearly visible, centered, completely flat, and unobstructed. The front graphic/print must match the uploaded reference image exactly in design, artwork, colors, placement, and proportions.

EXACT FRAMING & CROPPING (CRITICAL):
${zoom.description.replace(/T-shirt/g, fit.apparelName)}

STYLING & POSE:
${model.styling}
${frontPose.description}

GARMENT FIT & FIDELITY:
${garmentConversionRule}
The graphic print, artwork, colors, and design elements must match the reference image with 100% precision. Do not invent any unverified text or symbols.

LIGHTING & BACKGROUND:
Clean pure white seamless studio background (#FFFFFF), soft professional portrait studio lighting, no floor or ground shadow, photorealistic skin and fabric texture.

Photorealistic, sharp focus, clean, premium e-commerce fashion product photography suitable for Meesho, Amazon, Flipkart listings.`;

  // Prompt 2: Back View of Model
  const prompt2 = `Reference Image Guide:
Maintain the exact same ${model.id === 'male' ? 'adult male' : 'adult female'} model, body proportions, styling, lighting, and studio environment as the previous image, wearing the exact same ${fit.apparelName}.

BACK VIEW ONLY:
${backPose.direction}.
The model is turned facing away from the camera displaying the clean back of the ${fit.apparelName}. The back of the ${fit.apparelName} must contain NO printed graphic unless visibly present on the back in the reference image. Clean unprinted fabric drape.

EXACT FRAMING & CROPPING (CRITICAL):
${zoom.description.replace(/T-shirt/g, fit.apparelName)}

STYLING & POSE:
${backPose.description}
Preserve the exact same model styling and seamless pure white studio setup.

GARMENT CONSTRUCTION & BACK VIEW FIDELITY:
${isHoodie ? `The hoodie must show the hood resting naturally and smoothly on the upper back/neck, long sleeves draped naturally, ribbed hem, and clean unprinted fleece fabric across the back.` : `The back of the ${fit.apparelName} must remain completely consistent in color, fabric, and silhouette.`}
${garmentConversionRule}

LIGHTING & BACKGROUND:
Clean pure white seamless studio background (#FFFFFF), soft diffused commercial portrait lighting, no floor or ground shadow, realistic fabric folds and natural skin texture.

Photorealistic premium fashion e-commerce photography suitable for marketplace product listings.`;

  // Prompt 3: Side View of Model
  const prompt3 = `Reference Image Guide:
Maintain the exact same ${model.id === 'male' ? 'adult male' : 'adult female'} model, appearance, body proportions, styling, lighting, and studio environment as the previous images, wearing the exact same ${fit.apparelName}.

SIDE PROFILE VIEW:
${sidePose.direction}.
Show the clean side profile and silhouette of the ${fit.apparelName}${isHoodie ? ', including the hood profile, long sleeves, and relaxed drape' : ', sleeve length, shoulder drop, and side hem drape'}.

EXACT FRAMING & CROPPING (CRITICAL):
${zoom.description.replace(/T-shirt/g, fit.apparelName)}

STYLING & POSE:
${sidePose.description}

GARMENT FIT & FIDELITY:
${garmentConversionRule}

LIGHTING & BACKGROUND:
Clean pure white seamless studio background (#FFFFFF), soft commercial studio lighting, realistic fabric draping, realistic shadows on garment folds, no floor or ground shadow.

Photorealistic high-end clothing catalog photography designed for online fashion marketplaces.`;

  // Prompt 4: Detail Close-Up (Collar/Neckline vs Hood)
  let detailTitle = 'Neckline & Collar Close-Up';
  let detailFocus = '';
  let detailDesc = '';

  if (isHoodie) {
    detailTitle = 'Hood & Drawstrings Close-Up';
    detailFocus = 'attached hood, drawstrings, eyelets, and neck construction of the hoodie';
    detailDesc = 'double-layered fabric hood shape, thick drawstrings with aglets/tips, metal/stitched eyelets, clean neck seam, and heavyweight fleece texture';
  } else if (fitLower.includes('polo')) {
    detailTitle = 'Polo Collar & Placket Close-Up';
    detailFocus = 'polo collar, ribbing, and button placket';
    detailDesc = 'polo collar shape, ribbing, button placket, buttons, and collar seam construction';
  } else if (fit.isSame) {
    detailTitle = 'Collar & Neckline Close-Up';
    detailFocus = 'collar, neckline, or hood construction (matching the exact construction visibly present in the reference image)';
    detailDesc = 'exact collar ribbing, stitching, neckline width, and seam construction from the reference image. If the reference is a T-shirt, show the ribbed crewneck collar cleanly and DO NOT show or add any hood or drawstrings';
  } else {
    detailTitle = 'Neckline & Collar Close-Up';
    detailFocus = `neckline and collar construction of the ${fit.label}`;
    detailDesc = `collar shape, collar ribbing/stitching, fabric texture, and seam construction of the ${fit.label}. DO NOT add a hood or drawstrings unless the garment is a hoodie`;
  }

  const prompt4 = `Reference Image Guide:
Use the uploaded reference image for the ${fit.apparelName}.

Create an ultra-realistic professional e-commerce PRODUCT DETAIL CLOSE-UP focusing exclusively on the ${detailFocus}.

${isHoodie ? 'Show ONLY the hood, drawstrings, eyelets, and neck construction of the hoodie.' : 'Show ONLY the upper neckline and collar region of the garment (DO NOT add any hood or drawstrings if not present in the reference image).'}

The image must accurately reproduce the ${detailDesc}.

Do not redesign or alter the construction. Centered in frame. Show realistic fabric texture, fine stitching, subtle natural wrinkles, and realistic construction details.

Clean white or very light neutral studio background, soft diffused lighting, extremely sharp focus, realistic shadows, premium commercial product photography.

No model face, no full body, no unnecessary props, no additional text, no watermark. Macro-level clothing detail photography suitable for an e-commerce product listing.`;

  // Prompt 5: Graphic Print Close-Up
  const prompt5 = `Reference Image Guide:
Use the uploaded reference image as the exact source of truth for the graphic print and artwork.

Create an ultra-realistic high-resolution PRODUCT DETAIL CLOSE-UP showing ONLY the printed graphic/design on the ${fit.apparelName}.

EXACT FRAMING & PRINT ZOOM:
${printZoom.description}

The print must be reproduced EXACTLY as it appears in the reference image.

Preserve every visible element of the original artwork: exact shapes, illustrations, typography, lettering, symbols, colors, outlines, textures, distressed effects, proportions, spacing, orientation, and print placement.

DO NOT redesign, rewrite, reinterpret, regenerate, correct, beautify, replace, or invent any text or artwork.

The graphic must remain visually identical to the reference. Show the print applied naturally onto the actual ${fit.apparelName} fabric, including realistic fabric texture, subtle wrinkles, slight material deformation, realistic ink/print texture and natural lighting.

Clean neutral/white studio presentation, professional commercial product photography, extremely sharp details.

No model face, no unnecessary background elements, no additional graphics, no invented text, no watermark. High-resolution e-commerce product-detail photography.`;

  // Prompt 6: Marketplace Listing Infographic
  let featureBullet1 = `• ${fit.label}`;
  let featureBullet2 = isHoodie ? '• Double-layered hood & drawstrings' : isSweatshirt ? '• Reinforced ribbed crewneck' : '• Reinforced collar';
  let featureBullet3 = !sleeve.isSame
    ? `• ${sleeve.label} sleeves`
    : (isHoodie || isSweatshirt || isJacket ? '• Long sleeves with ribbed cuffs' : '• Short sleeves');
  let featureBullet4 = isHoodie || isSweatshirt ? '• Heavyweight premium fleece' : '• Premium breathable fabric';
  let featureBullet5 = isHoodie ? '• Front kangaroo pocket' : '• Comfortable all-day feel';
  let featureBullet6 = '• Vibrant high-definition graphic print';

  const prompt6 = `Reference Image Guide:
Create a premium fashion e-commerce PRODUCT LISTING INFOGRAPHIC for a ${fit.label}.

The final image should look like a professionally designed marketplace listing image for a ${fit.label} displaying the artwork from the reference image.

${garmentConversionRule}

MAIN COMPOSITION:
Place a large, highly realistic front view of the ${fit.label} prominently on the left or center-left side. Make the ${fit.apparelName} the dominant visual element.

On the opposite side, create a clean organized product-information area containing concise visual feature callouts:
${featureBullet1}
${featureBullet2}
${featureBullet3}
${featureBullet4}
${featureBullet5}
${featureBullet6}

Add several smaller premium close-up panels along the bottom showing useful details of the same ${fit.apparelName}:
1. ${isHoodie ? 'hood & drawstrings' : 'neckline/collar'}
2. fabric texture
3. printed design
4. ${isHoodie || isSweatshirt ? 'cuff/hem ribbing' : 'sleeve/hem stitching'}

Clean white background, realistic product photography, soft studio lighting, subtle shadows, accurate colors, sharp fabric details, polished commercial retouching.

No unnecessary models, no lifestyle scene, no clutter, no watermark. Final result should look like a ready-to-use premium marketplace product listing image for Meesho, Amazon, Flipkart or similar e-commerce platforms.`;

  return [
    { id: 1, title: `Front View (${frontPose.shortName})`, text: prompt1 },
    { id: 2, title: `Back View (${backPose.shortName})`, text: prompt2 },
    { id: 3, title: `Side View (${sidePose.shortName})`, text: prompt3 },
    { id: 4, title: detailTitle, text: prompt4 },
    { id: 5, title: 'Graphic Print Close-Up', text: prompt5 },
    { id: 6, title: 'Listing Infographic', text: prompt6 }
  ];
}

export const DEFAULT_PROMPT_TITLES = [
  'Front View (Classic Front)',
  'Back View (Straight Back)',
  'Side View (90° Profile Right)',
  'Neckline & Collar Close-Up',
  'Graphic Print Close-Up',
  'Listing Infographic'
];

export const DEFAULT_PROMPT_TEXTS = buildPromptsForConfig().map((p) => p.text);

export function createDefaultPrompts(count = 6, config = {}) {
  const generated = buildPromptsForConfig(config);
  const prompts = [];
  for (let i = 1; i <= count; i++) {
    const item = generated[i - 1] || { title: `Prompt ${i}`, text: '' };
    prompts.push({
      id: i,
      title: item.title,
      text: item.text,
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

/**
 * Resolves standard image filename:
 * - If customName is provided: `${name}_${promptIndex}.${extension}`
 * - If customName is NOT provided (empty): `image_${designIndex}_${promptIndex}.${extension}`
 */
export function resolveImageFilename(customName, designIndex = 1, promptIndex = 1, extension = 'png') {
  const clean = (typeof customName === 'string' ? customName.trim() : '');
  if (clean.length > 0) {
    const slug = clean
      .toLowerCase()
      .replace(/[\/\\:*?"<>|]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 35);
    if (slug.length > 0) {
      return `${slug}_${promptIndex}.${extension}`;
    }
  }
  return `image_${designIndex}_${promptIndex}.${extension}`;
}

export function createQueueItem(fileData, queueIndex = 0, settings = {}) {
  const rawName = fileData.name ? fileData.name.replace(/\.[^/.]+$/, '') : `design_${queueIndex + 1}`;
  const customName = (settings.customName || settings.baseFilename || '').trim();
  const baseFilename = customName || rawName.toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 30) || `design_${queueIndex + 1}`;
  const startingOffset = typeof settings.startingPoseOffset === 'number'
    ? settings.startingPoseOffset
    : (typeof settings.startingPoseIndex === 'number' ? settings.startingPoseIndex : 0);
  const poseIndices = calculatePoseIndices(queueIndex, startingOffset);

  const itemConfig = {
    modelGender: settings.modelGender || 'female',
    tshirtType: settings.tshirtType || 'same',
    sleeveType: settings.sleeveType || 'same',
    zoomType: settings.zoomType || 'medium',
    printZoomType: settings.printZoomType || 'tight',
    customName: customName,
    startingPoseOffset: (startingOffset + queueIndex) % 10
  };

  const promptConfigs = buildPromptsForConfig({
    modelGender: itemConfig.modelGender,
    tshirtType: itemConfig.tshirtType,
    sleeveType: itemConfig.sleeveType,
    zoomType: itemConfig.zoomType,
    printZoomType: itemConfig.printZoomType,
    poseIndices,
    baseName: baseFilename
  });

  const prompts = promptConfigs.map((cfg, idx) => ({
    id: idx + 1,
    title: cfg.title,
    text: cfg.text,
    enabled: true,
    status: PROMPT_STATUS.WAITING,
    filename: null,
    imageUrl: null,
    retries: 0,
    maxRetries: 3,
    error: null,
    startedAt: null,
    completedAt: null
  }));

  return {
    id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    name: rawName,
    customName: customName,
    baseFilename,
    referenceImage: fileData,
    file: fileData,
    status: 'waiting', // 'waiting' | 'in_progress' | 'completed' | 'failed'
    config: itemConfig,
    poseIndices,
    prompts,
    images: [],
    generatedImages: [],
    completedCount: 0,
    zipPath: null,
    error: null
  };
}

export function createInitialSession() {
  const defaultPrompts = createDefaultPrompts(6);
  return {
    sessionId: `session_${Date.now()}`,
    state: AUTOMATION_STATE.IDLE,
    statusMessage: 'Ready to start automation',
    currentPromptIndex: 0,
    referenceImage: null, // { name: string, type: string, size: number, dataUrl: string }
    referenceUploaded: false,
    baseFilename: '',
    defaultsInitialized: true,
    prompts: defaultPrompts,
    queue: [], // Array of queue items for multi-image processing
    currentQueueIndex: 0,
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
    // Ensure queue structure exists
    if (!Array.isArray(session.queue)) {
      session.queue = [];
      session.currentQueueIndex = 0;
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

    const updatedQueue = (current.queue || []).map(item => ({
      ...item,
      status: 'waiting',
      completedCount: 0,
      zipPath: null,
      error: null,
      images: [],
      prompts: (item.prompts || []).map(p => ({
        ...p,
        status: PROMPT_STATUS.WAITING,
        imageUrl: null,
        filename: null,
        retries: 0,
        error: null,
        startedAt: null,
        completedAt: null
      }))
    }));

    const newSession = {
      ...createInitialSession(),
      baseFilename: current.baseFilename || 'name',
      referenceImage: current.referenceImage || null,
      referenceUploaded: false,
      prompts: updatedPrompts,
      queue: updatedQueue,
      currentQueueIndex: 0,
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
