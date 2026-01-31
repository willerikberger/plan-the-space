import { create } from 'zustand'
import type { PlannerStore, PlannerMode, PlannerObject, HistoryState } from './types'
import { SHAPE_COLORS, LINE_COLORS, DEFAULTS } from './constants'

const initialHistoryState: HistoryState = {
  canUndo: false,
  canRedo: false,
  undoCount: 0,
  redoCount: 0,
}

const initialState = {
  mode: 'normal' as PlannerMode,
  pixelsPerMeter: null as number | null,
  backgroundImageData: null as string | null,
  objects: new Map<number, PlannerObject>(),
  objectIdCounter: 0,
  selectedColor: SHAPE_COLORS[0],
  selectedLineColor: LINE_COLORS[0],
  lineWidth: DEFAULTS.lineWidth,
  autoSaveEnabled: true,
  statusMessage: 'Load an image to get started',
  historyState: initialHistoryState,
  calibrationPixelLength: null as number | null,
  showCalibrationInput: false,
}

export const usePlannerStore = create<PlannerStore>()((set, get) => ({
  ...initialState,

  // Mode
  setMode: (mode) => set({ mode }),

  // Scale
  setPixelsPerMeter: (ppm) => set({ pixelsPerMeter: ppm }),

  // Background
  setBackgroundImageData: (data) => set({ backgroundImageData: data }),

  // Objects
  addObject: (obj) =>
    set((state) => {
      const next = new Map(state.objects)
      next.set(obj.id, obj)
      return { objects: next }
    }),

  removeObject: (id) =>
    set((state) => {
      const next = new Map(state.objects)
      next.delete(id)
      return { objects: next }
    }),

  updateObject: (id, partial) =>
    set((state) => {
      const existing = state.objects.get(id)
      if (!existing) return state
      const next = new Map(state.objects)
      next.set(id, { ...existing, ...partial } as PlannerObject)
      return { objects: next }
    }),

  clearObjects: (typesToClear) =>
    set((state) => {
      if (!typesToClear) {
        return { objects: new Map() }
      }
      const next = new Map(state.objects)
      for (const [id, obj] of next) {
        if (typesToClear.includes(obj.type)) {
          next.delete(id)
        }
      }
      return { objects: next }
    }),

  nextObjectId: () => {
    const id = get().objectIdCounter
    set({ objectIdCounter: id + 1 })
    return id
  },

  // Colors
  setSelectedColor: (color) => set({ selectedColor: color }),
  setSelectedLineColor: (color) => set({ selectedLineColor: color }),

  // Line drawing
  setLineWidth: (w) => set({ lineWidth: w }),

  // Auto-save
  setAutoSaveEnabled: (enabled) => set({ autoSaveEnabled: enabled }),

  // Status
  setStatusMessage: (msg) => set({ statusMessage: msg }),

  // History
  setHistoryState: (historyState) => set({ historyState }),

  // Calibration UI
  setCalibrationPixelLength: (len) => set({ calibrationPixelLength: len }),
  setShowCalibrationInput: (show) => set({ showCalibrationInput: show }),

  // Bulk load
  loadProject: ({ pixelsPerMeter, backgroundImageData, objects }) => {
    const map = new Map<number, PlannerObject>()
    let maxId = 0
    for (const obj of objects) {
      map.set(obj.id, obj)
      if (obj.id >= maxId) maxId = obj.id + 1
    }
    set({
      pixelsPerMeter,
      backgroundImageData,
      objects: map,
      objectIdCounter: maxId,
      mode: 'normal',
    })
  },

  // Reset
  reset: () => set({ ...initialState, objects: new Map() }),
}))

// Selectors
export const selectVisibleObjects = (state: PlannerStore): PlannerObject[] => {
  const result: PlannerObject[] = []
  for (const obj of state.objects.values()) {
    if (obj.type === 'shape' || obj.type === 'line' || obj.type === 'overlayImage') {
      result.push(obj)
    }
  }
  return result
}

export const selectObjectById = (state: PlannerStore, id: number): PlannerObject | undefined =>
  state.objects.get(id)
