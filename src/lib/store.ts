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
  LayerSlice,
  ProjectSlice,
  LayerGroup,
  LayerEntry,
  LayerVisibility,
  ProjectListItem,
  Camera,
  ViewAidsSlice,
  GuideAxis,
} from "./types";
import { canTransitionMode, layerGroupForType } from "./types";
import {
  SHAPE_COLORS,
  LINE_COLORS,
  DEFAULTS,
  VIEW_AIDS_DEFAULTS,
} from "./constants";

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
  calibrationPixelLength: null as number | null,
  showCalibrationInput: false,
  camera: null as Camera | null,
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

const initialViewAidsState = {
  viewAids: {
    showGrid: VIEW_AIDS_DEFAULTS.showGrid,
    showRulers: VIEW_AIDS_DEFAULTS.showRulers,
    snapEnabled: VIEW_AIDS_DEFAULTS.snapEnabled,
    gridStepM: VIEW_AIDS_DEFAULTS.gridStepM,
    majorEvery: VIEW_AIDS_DEFAULTS.majorEvery,
    guideLock: VIEW_AIDS_DEFAULTS.guideLock,
    guides: [...VIEW_AIDS_DEFAULTS.guides],
    snapTolerancePx: VIEW_AIDS_DEFAULTS.snapTolerancePx,
  },
};

function createGuideId(): string {
  if (
    typeof crypto !== "undefined" &&
    "randomUUID" in crypto &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `guide-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

// ============================================
// Canvas slice — calibration, mode, scale
// ============================================
const createCanvasSlice: StoreSliceCreator<CanvasSlice> = (set) => ({
  ...initialCanvasState,
  setMode: (mode) =>
    set((state) => {
      if (!canTransitionMode(state.mode, mode)) {
        console.warn(`Invalid mode transition: ${state.mode} → ${mode}`);
        return state;
      }
      return { mode };
    }),
  setPixelsPerMeter: (ppm) => set({ pixelsPerMeter: ppm }),
  setCalibrationPixelLength: (len) => set({ calibrationPixelLength: len }),
  setShowCalibrationInput: (show) => set({ showCalibrationInput: show }),
  setCamera: (camera) => set({ camera }),
  updateCameraViewport: (width, height) =>
    set((state) => {
      if (!state.camera) return state;
      return {
        camera: {
          ...state.camera,
          viewportWidth: width,
          viewportHeight: height,
        },
      };
    }),
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
      // Also add to the correct layer group
      const group = layerGroupForType(obj.type);
      const entries = state.layers[group].filter((e) => e.objectId !== obj.id);
      const maxZ =
        entries.length > 0 ? Math.max(...entries.map((e) => e.zIndex)) : -1;
      const withoutObject: Record<LayerGroup, LayerEntry[]> = {
        background: state.layers.background.filter(
          (e) => e.objectId !== obj.id,
        ),
        masks: state.layers.masks.filter((e) => e.objectId !== obj.id),
        content: state.layers.content.filter((e) => e.objectId !== obj.id),
      };
      return {
        objects: next,
        layers: {
          ...withoutObject,
          [group]: normalizeLayerEntries([
            ...entries,
            { objectId: obj.id, zIndex: maxZ + 1 },
          ]),
        },
      };
    }),
  removeObject: (id) =>
    set((state) => {
      const next = new Map(state.objects);
      next.delete(id);
      // Also remove from layers
      return {
        objects: next,
        layers: {
          background: state.layers.background.filter((e) => e.objectId !== id),
          masks: state.layers.masks.filter((e) => e.objectId !== id),
          content: state.layers.content.filter((e) => e.objectId !== id),
        },
      };
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
        return {
          objects: new Map(),
          layers: { background: [], masks: [], content: [] },
        };
      }
      const next = new Map(state.objects);
      const removedIds = new Set<number>();
      for (const [id, obj] of next) {
        if (typesToClear.includes(obj.type)) {
          next.delete(id);
          removedIds.add(id);
        }
      }
      return {
        objects: next,
        layers: {
          background: state.layers.background.filter(
            (e) => !removedIds.has(e.objectId),
          ),
          masks: state.layers.masks.filter((e) => !removedIds.has(e.objectId)),
          content: state.layers.content.filter(
            (e) => !removedIds.has(e.objectId),
          ),
        },
      };
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
let statusTimeoutId: ReturnType<typeof setTimeout> | undefined;

const createUISlice: StoreSliceCreator<UISlice> = (set) => ({
  ...initialUIState,
  setSelectedColor: (color) => set({ selectedColor: color }),
  setSelectedLineColor: (color) => set({ selectedLineColor: color }),
  setLineWidth: (w) => set({ lineWidth: w }),
  setAutoSaveEnabled: (enabled) => set({ autoSaveEnabled: enabled }),
  setStatusMessage: (msg) => {
    set({ statusMessage: msg });
    clearTimeout(statusTimeoutId);
    if (msg) {
      statusTimeoutId = setTimeout(() => {
        set({ statusMessage: "" });
      }, 5000);
    }
  },
});

// ============================================
// History slice
// ============================================
const createHistorySlice: StoreSliceCreator<HistorySlice> = (set) => ({
  historyState: initialHistoryState,
  setHistoryState: (historyState) => set({ historyState }),
});

// ============================================
// View aids slice
// ============================================
const createViewAidsSlice: StoreSliceCreator<ViewAidsSlice> = (set) => ({
  ...initialViewAidsState,

  setViewAids: (partial) =>
    set((state) => ({
      viewAids: { ...state.viewAids, ...partial },
    })),

  toggleGrid: () =>
    set((state) => ({
      viewAids: { ...state.viewAids, showGrid: !state.viewAids.showGrid },
    })),

  toggleRulers: () =>
    set((state) => ({
      viewAids: { ...state.viewAids, showRulers: !state.viewAids.showRulers },
    })),

  toggleSnap: () =>
    set((state) => ({
      viewAids: { ...state.viewAids, snapEnabled: !state.viewAids.snapEnabled },
    })),

  setGridStepM: (stepM) =>
    set((state) => ({
      viewAids: {
        ...state.viewAids,
        gridStepM: Number.isFinite(stepM)
          ? Math.max(0.1, Math.min(10, stepM))
          : state.viewAids.gridStepM,
      },
    })),

  setMajorEvery: (majorEvery) =>
    set((state) => ({
      viewAids: {
        ...state.viewAids,
        majorEvery: Number.isFinite(majorEvery)
          ? Math.max(1, Math.min(20, Math.round(majorEvery)))
          : state.viewAids.majorEvery,
      },
    })),

  setGuideLock: (locked) =>
    set((state) => ({
      viewAids: { ...state.viewAids, guideLock: locked },
    })),

  addGuide: (axis: GuideAxis, valueM: number, id?: string) => {
    const guideId = id ?? createGuideId();
    set((state) => ({
      viewAids: {
        ...state.viewAids,
        guides: [
          ...state.viewAids.guides,
          { id: guideId, axis, valueM: Number(valueM) },
        ],
      },
    }));
    return guideId;
  },

  updateGuide: (id: string, valueM: number) =>
    set((state) => ({
      viewAids: {
        ...state.viewAids,
        guides: state.viewAids.guides.map((guide) =>
          guide.id === id ? { ...guide, valueM: Number(valueM) } : guide,
        ),
      },
    })),

  removeGuide: (id: string) =>
    set((state) => ({
      viewAids: {
        ...state.viewAids,
        guides: state.viewAids.guides.filter((guide) => guide.id !== id),
      },
    })),

  clearGuides: () =>
    set((state) => ({
      viewAids: {
        ...state.viewAids,
        guides: [],
      },
    })),

  replaceGuides: (guides) =>
    set((state) => ({
      viewAids: {
        ...state.viewAids,
        guides: [...guides],
      },
    })),
});

// ============================================
// Layer slice
// ============================================
const emptyLayers: Record<LayerGroup, LayerEntry[]> = {
  background: [],
  masks: [],
  content: [],
};

const allVisible: LayerVisibility = {
  background: true,
  masks: true,
  content: true,
};

function normalizeLayerEntries(entries: LayerEntry[]): LayerEntry[] {
  const minZById = new Map<number, number>();
  for (const entry of entries) {
    const existing = minZById.get(entry.objectId);
    if (existing == null || entry.zIndex < existing) {
      minZById.set(entry.objectId, entry.zIndex);
    }
  }
  return Array.from(minZById.entries())
    .sort((a, b) => a[1] - b[1])
    .map(([objectId], index) => ({ objectId, zIndex: index }));
}

function expectedObjectIdsForGroup(
  state: PlannerStore,
  group: LayerGroup,
): number[] {
  const expected: number[] = [];
  for (const obj of state.objects.values()) {
    if (layerGroupForType(obj.type) === group) expected.push(obj.id);
  }
  return expected;
}

function canonicalEntriesForGroup(
  state: PlannerStore,
  group: LayerGroup,
): LayerEntry[] {
  const expectedIds = expectedObjectIdsForGroup(state, group);
  const expectedSet = new Set(expectedIds);
  const normalized = normalizeLayerEntries(
    state.layers[group].filter((entry) => expectedSet.has(entry.objectId)),
  );
  const present = new Set(normalized.map((entry) => entry.objectId));
  const missing = expectedIds.filter((id) => !present.has(id));
  return [
    ...normalized,
    ...missing.map((objectId, index) => ({
      objectId,
      zIndex: normalized.length + index,
    })),
  ];
}

const createLayerSlice: StoreSliceCreator<LayerSlice> = (set, get) => ({
  layers: { ...emptyLayers, background: [], masks: [], content: [] },
  layerVisibility: { ...allVisible },

  addToLayer: (objectId, group) =>
    set((state) => {
      const entries = state.layers[group].filter(
        (e) => e.objectId !== objectId,
      );
      const maxZ =
        entries.length > 0 ? Math.max(...entries.map((e) => e.zIndex)) : -1;
      const withoutObject: Record<LayerGroup, LayerEntry[]> = {
        background: state.layers.background.filter(
          (e) => e.objectId !== objectId,
        ),
        masks: state.layers.masks.filter((e) => e.objectId !== objectId),
        content: state.layers.content.filter((e) => e.objectId !== objectId),
      };
      return {
        layers: {
          ...withoutObject,
          [group]: normalizeLayerEntries([
            ...entries,
            { objectId, zIndex: maxZ + 1 },
          ]),
        },
      };
    }),

  removeFromLayer: (objectId) =>
    set((state) => {
      const next: Record<LayerGroup, LayerEntry[]> = {
        background: state.layers.background.filter(
          (e) => e.objectId !== objectId,
        ),
        masks: state.layers.masks.filter((e) => e.objectId !== objectId),
        content: state.layers.content.filter((e) => e.objectId !== objectId),
      };
      return { layers: next };
    }),

  moveUpInLayer: (objectId) =>
    set((state) => {
      const obj = state.objects.get(objectId);
      if (!obj) return state;
      const group = layerGroupForType(obj.type);
      const sorted = canonicalEntriesForGroup(state, group);
      const idx = sorted.findIndex((entry) => entry.objectId === objectId);
      if (idx === -1 || idx >= sorted.length - 1) return state;

      const swapped = [...sorted];
      [swapped[idx], swapped[idx + 1]] = [swapped[idx + 1], swapped[idx]];

      return {
        layers: {
          background:
            group === "background"
              ? swapped.map((entry, index) => ({ ...entry, zIndex: index }))
              : canonicalEntriesForGroup(state, "background"),
          masks:
            group === "masks"
              ? swapped.map((entry, index) => ({ ...entry, zIndex: index }))
              : canonicalEntriesForGroup(state, "masks"),
          content:
            group === "content"
              ? swapped.map((entry, index) => ({ ...entry, zIndex: index }))
              : canonicalEntriesForGroup(state, "content"),
        },
      };
    }),

  moveDownInLayer: (objectId) =>
    set((state) => {
      const obj = state.objects.get(objectId);
      if (!obj) return state;
      const group = layerGroupForType(obj.type);
      const sorted = canonicalEntriesForGroup(state, group);
      const idx = sorted.findIndex((entry) => entry.objectId === objectId);
      if (idx === -1 || idx <= 0) return state;

      const swapped = [...sorted];
      [swapped[idx], swapped[idx - 1]] = [swapped[idx - 1], swapped[idx]];

      return {
        layers: {
          background:
            group === "background"
              ? swapped.map((entry, index) => ({ ...entry, zIndex: index }))
              : canonicalEntriesForGroup(state, "background"),
          masks:
            group === "masks"
              ? swapped.map((entry, index) => ({ ...entry, zIndex: index }))
              : canonicalEntriesForGroup(state, "masks"),
          content:
            group === "content"
              ? swapped.map((entry, index) => ({ ...entry, zIndex: index }))
              : canonicalEntriesForGroup(state, "content"),
        },
      };
    }),

  getRenderOrder: () => {
    const state = get();
    const sortByZ = (group: LayerGroup) =>
      canonicalEntriesForGroup(state, group).map((entry) => entry.objectId);
    return [
      ...sortByZ("background"),
      ...sortByZ("masks"),
      ...sortByZ("content"),
    ];
  },

  clearLayers: () =>
    set({
      layers: { background: [], masks: [], content: [] },
    }),

  setLayerVisibility: (visibility) =>
    set((state) => ({
      layerVisibility: { ...state.layerVisibility, ...visibility },
    })),
});

// ============================================
// Project slice (multi-project management)
// ============================================
const initialProjectState = {
  activeView: "picker" as const,
  activeProjectId: null as string | null,
  projects: [] as ProjectListItem[],
};

const createProjectSlice: StoreSliceCreator<ProjectSlice> = (set) => ({
  ...initialProjectState,

  setActiveView: (view) => set({ activeView: view }),
  setActiveProjectId: (id) => set({ activeProjectId: id }),
  setProjects: (projects) => set({ projects }),

  addProject: (project) =>
    set((state) => {
      const idx = state.projects.findIndex((p) => p.id === project.id);
      if (idx >= 0) {
        const next = [...state.projects];
        next[idx] = project;
        return { projects: next };
      }
      return { projects: [...state.projects, project] };
    }),

  updateProjectMeta: (id, partial) =>
    set((state) => {
      const idx = state.projects.findIndex((p) => p.id === id);
      if (idx < 0) return state;
      const next = [...state.projects];
      next[idx] = {
        ...next[idx],
        ...partial,
        updatedAt: new Date().toISOString(),
      };
      return { projects: next };
    }),

  softDeleteProject: (id) =>
    set((state) => {
      const idx = state.projects.findIndex((p) => p.id === id);
      if (idx < 0) return state;
      const next = [...state.projects];
      next[idx] = { ...next[idx], deletedAt: new Date().toISOString() };
      const updates: Partial<ProjectSlice> = { projects: next };
      if (state.activeProjectId === id) {
        updates.activeProjectId = null;
        updates.activeView = "picker";
      }
      return updates;
    }),

  restoreProject: (id) =>
    set((state) => {
      const idx = state.projects.findIndex((p) => p.id === id);
      if (idx < 0) return state;
      const next = [...state.projects];
      next[idx] = { ...next[idx], deletedAt: null };
      return { projects: next };
    }),

  permanentlyDeleteProject: (id) =>
    set((state) => {
      const next = state.projects.filter((p) => p.id !== id);
      const updates: Partial<ProjectSlice> = { projects: next };
      if (state.activeProjectId === id) {
        updates.activeProjectId = null;
      }
      return updates;
    }),
});

// ============================================
// Composed store
// ============================================
export const usePlannerStore = create<PlannerStore>()((...a) => ({
  ...createCanvasSlice(...a),
  ...createObjectsSlice(...a),
  ...createUISlice(...a),
  ...createHistorySlice(...a),
  ...createViewAidsSlice(...a),
  ...createLayerSlice(...a),
  ...createProjectSlice(...a),

  // Cross-slice actions
  loadProject: ({ pixelsPerMeter, objects, viewAids }) => {
    const [set] = a;
    const map = new Map<number, PlannerObject>();
    let maxId = 0;
    for (const obj of objects) {
      map.set(obj.id, obj);
      if (obj.id >= maxId) maxId = obj.id + 1;
    }
    set({
      pixelsPerMeter,
      objects: map,
      objectIdCounter: maxId,
      mode: "normal",
      viewAids: viewAids
        ? { ...initialViewAidsState.viewAids, ...viewAids }
        : { ...initialViewAidsState.viewAids },
    });
  },

  reset: () => {
    const [set] = a;
    set({
      ...initialCanvasState,
      ...initialObjectsState,
      ...initialUIState,
      ...initialViewAidsState,
      historyState: initialHistoryState,
      layers: { background: [], masks: [], content: [] },
      layerVisibility: { ...allVisible },
      objects: new Map(),
      // Preserve projects list; reset canvas-level project state only
    });
  },
}));

// Expose store for E2E tests (dev only)
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as Record<string, unknown>).__PLANNER_STORE__ =
    usePlannerStore;
}

// Memoized selectors — return stable references when the underlying data hasn't changed
let _cachedObjectsRef: Map<number, PlannerObject> | null = null;
let _cachedVisible: PlannerObject[] = [];
let _cachedRenderOrderObjectsRef: Map<number, PlannerObject> | null = null;
let _cachedRenderOrderLayersRef: PlannerStore["layers"] | null = null;
let _cachedRenderOrder: number[] = [];

export const selectVisibleObjects = (state: PlannerStore): PlannerObject[] => {
  if (state.objects === _cachedObjectsRef) return _cachedVisible;
  _cachedObjectsRef = state.objects;
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
  _cachedVisible = result;
  return result;
};

export const selectRenderOrder = (state: PlannerStore): number[] => {
  if (
    state.objects === _cachedRenderOrderObjectsRef &&
    state.layers === _cachedRenderOrderLayersRef
  ) {
    return _cachedRenderOrder;
  }
  _cachedRenderOrderObjectsRef = state.objects;
  _cachedRenderOrderLayersRef = state.layers;
  _cachedRenderOrder = state.getRenderOrder();
  return _cachedRenderOrder;
};

export const selectObjectById = (
  state: PlannerStore,
  id: number,
): PlannerObject | undefined => state.objects.get(id);
