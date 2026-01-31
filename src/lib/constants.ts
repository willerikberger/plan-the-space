// ============================================
// Shape colors (RGBA with 0.6 alpha for fill)
// ============================================
export const SHAPE_COLORS = [
  'rgba(76, 175, 80, 0.6)',
  'rgba(33, 150, 243, 0.6)',
  'rgba(255, 152, 0, 0.6)',
  'rgba(156, 39, 176, 0.6)',
  'rgba(244, 67, 54, 0.6)',
  'rgba(121, 85, 72, 0.6)',
  'rgba(96, 125, 139, 0.6)',
  'rgba(255, 235, 59, 0.6)',
] as const

// ============================================
// Line colors (RGBA with 1.0 alpha)
// ============================================
export const LINE_COLORS = [
  'rgba(244, 67, 54, 1)',
  'rgba(33, 150, 243, 1)',
  'rgba(76, 175, 80, 1)',
  'rgba(255, 152, 0, 1)',
  'rgba(156, 39, 176, 1)',
  'rgba(255, 255, 255, 1)',
  'rgba(0, 0, 0, 1)',
  'rgba(255, 235, 59, 1)',
] as const

// ============================================
// Canvas
// ============================================
export const CANVAS_BG = '#1a1a2e'

// ============================================
// Theme colors (dark palette)
// ============================================
export const THEME = {
  bg: '#1a1a2e',
  sidebar: '#16213e',
  accent: '#0f3460',
  primary: '#e94560',
  calibration: '#f39c12',
  cleanup: '#9b59b6',
  maskStroke: '#9b59b6',
  success: '#27ae60',
  danger: '#c0392b',
  textPrimary: '#eee',
  textSecondary: '#888',
  textMuted: '#666',
  green: '#4ade80',
} as const

// ============================================
// Defaults
// ============================================
export const DEFAULTS = {
  shapeWidthM: 2,
  shapeHeightM: 3,
  lineWidth: 3,
  labelFontSize: 14,
  dimsFontSize: 12,
  lineLabelFontSize: 12,
} as const

// ============================================
// Zoom
// ============================================
export const ZOOM_MIN = 0.1
export const ZOOM_MAX = 10

// ============================================
// Auto-save
// ============================================
export const AUTOSAVE_DEBOUNCE_MS = 2000

// ============================================
// IndexedDB
// ============================================
export const DB_NAME = 'PlanTheSpaceDB'
export const DB_VERSION = 2
export const STORE_NAME = 'projects'
export const IMAGE_POOL_STORE = 'image-pool'
export const STORAGE_KEY = 'plan-the-space-project'

// History
export const HISTORY_LIMIT = 50
export const IMAGE_LRU_SIZE = 3

// ============================================
// Calibration
// ============================================
export const MIN_LINE_LENGTH_PX = 10
export const MIN_MASK_SIZE_PX = 10
