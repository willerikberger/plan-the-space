import { create } from "zustand";
import type { StateCreator } from "zustand";
import type {
  PlannerStore,
  PlannerMode,
  PlannerObject,
  HistoryState,
  CanvasSlice,
  ObjectsSlice,
  UISlice,
  HistorySlice,
} from "./types";
import { SHAPE_COLORS, LINE_COLORS, DEFAULTS } from "./constants";

// ============================================
// Slice creator type
// ============================================
type StoreSliceCreator<T> = StateCreator<PlannerStore, [], [], T>;

// ============================================
// Initial values (used by slices and reset)
// ============================================
const initialHistoryState: HistoryState = {
  canUndo: false,
  canRedo: false,
  undoCount: 0,
  redoCount: 0,
};

const initialCanvasState = {
  mode: "normal" as PlannerMode,
  pixelsPerMeter: null as number | null,
  backgroundImageData: null as string | null,
  calibrationPixelLength: null as number | null,
  showCalibrationInput: false,
};

const initialObjectsState = {
  objects: new Map<number, PlannerObject>(),
  objectIdCounter: 0,
};

const initialUIState = {
  selectedColor: SHAPE_COLORS[0],
  selectedLineColor: LINE_COLORS[0],
  lineWidth: DEFAULTS.lineWidth,
  autoSaveEnabled: true,
  statusMessage: "Load an image to get started",
};

// ============================================
// Canvas slice — calibration, mode, scale
// ============================================
const createCanvasSlice: StoreSliceCreator<CanvasSlice> = (set) => ({
  ...initialCanvasState,
  setMode: (mode) => set({ mode }),
  setPixelsPerMeter: (ppm) => set({ pixelsPerMeter: ppm }),
  setBackgroundImageData: (data) => set({ backgroundImageData: data }),
  setCalibrationPixelLength: (len) => set({ calibrationPixelLength: len }),
  setShowCalibrationInput: (show) => set({ showCalibrationInput: show }),
});

// ============================================
// Objects slice — object CRUD
// ============================================
const createObjectsSlice: StoreSliceCreator<ObjectsSlice> = (set, get) => ({
  ...initialObjectsState,
  addObject: (obj) =>
    set((state) => {
      const next = new Map(state.objects);
      next.set(obj.id, obj);
      return { objects: next };
    }),
  removeObject: (id) =>
    set((state) => {
      const next = new Map(state.objects);
      next.delete(id);
      return { objects: next };
    }),
  updateObject: (id, partial) =>
    set((state) => {
      const existing = state.objects.get(id);
      if (!existing) return state;
      const next = new Map(state.objects);
      next.set(id, { ...existing, ...partial } as PlannerObject);
      return { objects: next };
    }),
  clearObjects: (typesToClear) =>
    set((state) => {
      if (!typesToClear) {
        return { objects: new Map() };
      }
      const next = new Map(state.objects);
      for (const [id, obj] of next) {
        if (typesToClear.includes(obj.type)) {
          next.delete(id);
        }
      }
      return { objects: next };
    }),
  nextObjectId: () => {
    const id = get().objectIdCounter;
    set({ objectIdCounter: id + 1 });
    return id;
  },
});

// ============================================
// UI slice — colors, line width, status
// ============================================
const createUISlice: StoreSliceCreator<UISlice> = (set) => ({
  ...initialUIState,
  setSelectedColor: (color) => set({ selectedColor: color }),
  setSelectedLineColor: (color) => set({ selectedLineColor: color }),
  setLineWidth: (w) => set({ lineWidth: w }),
  setAutoSaveEnabled: (enabled) => set({ autoSaveEnabled: enabled }),
  setStatusMessage: (msg) => set({ statusMessage: msg }),
});

// ============================================
// History slice
// ============================================
const createHistorySlice: StoreSliceCreator<HistorySlice> = (set) => ({
  historyState: initialHistoryState,
  setHistoryState: (historyState) => set({ historyState }),
});

// ============================================
// Composed store
// ============================================
export const usePlannerStore = create<PlannerStore>()((...a) => ({
  ...createCanvasSlice(...a),
  ...createObjectsSlice(...a),
  ...createUISlice(...a),
  ...createHistorySlice(...a),

  // Cross-slice actions
  loadProject: ({ pixelsPerMeter, backgroundImageData, objects }) => {
    const [set] = a;
    const map = new Map<number, PlannerObject>();
    let maxId = 0;
    for (const obj of objects) {
      map.set(obj.id, obj);
      if (obj.id >= maxId) maxId = obj.id + 1;
    }
    set({
      pixelsPerMeter,
      backgroundImageData,
      objects: map,
      objectIdCounter: maxId,
      mode: "normal",
    });
  },

  reset: () => {
    const [set] = a;
    set({
      ...initialCanvasState,
      ...initialObjectsState,
      ...initialUIState,
      historyState: initialHistoryState,
      objects: new Map(),
    });
  },
}));

// Selectors
export const selectVisibleObjects = (state: PlannerStore): PlannerObject[] => {
  const result: PlannerObject[] = [];
  for (const obj of state.objects.values()) {
    if (
      obj.type === "shape" ||
      obj.type === "line" ||
      obj.type === "overlayImage"
    ) {
      result.push(obj);
    }
  }
  return result;
};

export const selectObjectById = (
  state: PlannerStore,
  id: number,
): PlannerObject | undefined => state.objects.get(id);
