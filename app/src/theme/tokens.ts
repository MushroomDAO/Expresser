// Design tokens — mirror of design_handoff_expresser/README.md
// Keep in sync when the canonical design changes.

export const palette = {
  // Light theme
  bg: '#fbf7f1',
  fg: '#1d1c1a',
  fgSub: 'rgba(29,28,26,0.55)',
  card: 'rgba(0,0,0,0.04)',

  // Dark theme
  bgDark: '#0e0f12',
  fgDark: '#f5f4ef',
  fgSubDark: 'rgba(245,244,239,0.55)',
  cardDark: 'rgba(255,255,255,0.05)',

  // Brand
  primary: '#e87aa3',
  primaryLight: '#ff9ec0',
  stamen1: '#fff5c2',
  stamen2: '#f5c454',
  stamen3: '#b97a1f',

  // Semantic
  recRed: '#ff4d6a',
  success: '#3fbe6e',
  warn: '#e6a44b',
} as const;

// Rainbow gradient stops for the 'rainbow' variant + toast progress.
export const rainbowStops = [
  '#ff8aa8',
  '#ffc887',
  '#fff09a',
  '#a3e8b0',
  '#a4cfff',
  '#d4a8ff',
] as const;

export const radius = {
  card: 14,
  toast: 22,
  pill: 100,
  list: 14,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const typography = {
  // 30px / 600 / -0.02em / 1.15
  h1: { fontSize: 30, fontWeight: '600', letterSpacing: -0.6, lineHeight: 34 },
  // 22px / 600 / -0.015em / 1.25
  h2: { fontSize: 22, fontWeight: '600', letterSpacing: -0.33, lineHeight: 28 },
  body: { fontSize: 13, lineHeight: 20 },
  // 11px / mono / 0.18em letter-spacing / 0.7 opacity
  eyebrow: { fontSize: 11, letterSpacing: 1.98, opacity: 0.7 },
  toastTitle: { fontSize: 14, fontWeight: '600' },
  toastSub: { fontSize: 11.5, opacity: 0.62 },
} as const;

// Petal button geometry — README §Components.
export const petalGeom = {
  size: 188,
  petalLen: 58,
  petalWid: 42,
  petalCount: 6,
} as const;

// Gesture thresholds — README §Interactions.
export const gestures = {
  pressDelayMs: 130,
  swipeUpPx: 80,
  swipeMinDx: 16,
  swipeAxisRatio: 1.4,
  swipeReleasePx: 40,
  recordMinMs: 600,
  videoLongPressMs: 320,
} as const;

// Animation timing — README §动效时序.
export const motion = {
  buttonPressMs: 180,
  petalSwayMs: 9000,
  recRingMs: 1600,
  transcriptChunkMs: 380,
  countdownMs: 5000,
  shimmerMs: 1400,
  toastEnterMs: 500,
  swipeFlashMs: 700,
  cameraEnterMs: 400,
  poolFlashMs: 1800,
  transitionMs: 520,
  capturingMs: 280,
} as const;

export type Variant = 'petal' | 'rainbow' | 'siri' | 'glass';
