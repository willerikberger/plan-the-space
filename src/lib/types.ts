import type { Rect, Line, FabricImage, Circle } from "fabric";

// ============================================
// Mode
// ============================================
export type PlannerMode =
  | "normal"
  | "calibrating"
  | "drawing-line"
  | "drawing-mask"
  | "cleanup";

// ============================================
// Object types
// ============================================
export type ObjectType =
  | "shape"
  | "line"
  | "mask"
  | "backgroundImage"
  | "overlayImage";

export interface Point {
  x: number;
  y: number;
}

// ============================================
// World-space types (meters)
// ============================================
export interface WorldPoint {
  x: number; // meters
  y: number; // meters
}

export interface Camera {
  pixelsPerMeter: number;
  zoom: number;
  panX: number; // canvas-space pan offset (pixels)
  panY: number; // canvas-space pan offset (pixels)
  viewportWidth: number; // canvas element width (pixels)
  viewportHeight: number; // canvas element height (pixels)
}

export interface SnappedPoint extends Point {
  angle: number;
}

// ============================================
// Planner objects (store metadata, not Fabric refs)
// ============================================
interface BaseObject {
  id: number;
  name: string;
}

export interface ShapeObject extends BaseObject {
  type: "shape";
  widthM: number;
  heightM: number;
  color: string;
  worldX?: number; // center X in meters (world-space)
  worldY?: number; // center Y in meters (world-space)
  angle?: number; // rotation in degrees
}

export interface LineObject extends BaseObject {
  type: "line";
  lengthM: number;
  color: string;
  worldX1?: number; // start X in meters (world-space)
  worldY1?: number; // start Y in meters (world-space)
  worldX2?: number; // end X in meters (world-space)
  worldY2?: number; // end Y in meters (world-space)
}

export interface MaskObject extends BaseObject {
  type: "mask";
  worldX?: number; // top-left X in meters (world-space)
  worldY?: number; // top-left Y in meters (world-space)
  widthM?: number; // width in meters
  heightM?: number; // height in meters
  angle?: number; // rotation in degrees
}

export interface BackgroundImageObject extends BaseObject {
  type: "backgroundImage";
  imageData: string;
}

export interface OverlayImageObject extends BaseObject {
  type: "overlayImage";
  imageData: string;
}

export type PlannerObject =
  | ShapeObject
  | LineObject
  | MaskObject
  | BackgroundImageObject
  | OverlayImageObject;

// ============================================
// Fabric refs (mutable, non-serializable)
// ============================================
export interface ShapeFabricRefs {
  type: "shape";
  rect: Rect;
}

export interface LineFabricRefs {
  type: "line";
  line: Line;
}

export interface MaskFabricRefs {
  type: "mask";
  rect: Rect;
}

export interface ImageFabricRefs {
  type: "image";
  image: FabricImage;
}

export type FabricRefs =
  | ShapeFabricRefs
  | LineFabricRefs
  | MaskFabricRefs
  | ImageFabricRefs;

// ============================================
// Fabric custom properties (attached to Fabric objects at runtime)
// ============================================

export interface FabricCustomProps {
  objectId?: number;
  objectType?:
    | "shape"
    | "shapeLabel"
    | "shapeDims"
    | "line"
    | "lineLabel"
    | "mask"
    | "overlayImage"
    | "backgroundImage"
    | "background";
  parentId?: number;
  shapeName?: string;
  shapeWidthM?: number;
  shapeHeightM?: number;
  shapeColor?: string;
  baseWidthPx?: number;
  baseHeightPx?: number;
  imageData?: string;
  imageDataRef?: string;
  lineName?: string;
  lineColor?: string;
  lengthM?: number;
}

// ============================================
// History (undo/redo)
// ============================================
export type ImageRef = string; // hash key into image dedup pool

export interface StoreSnapshot {
  pixelsPerMeter: number | null;
  objects: PlannerObject[]; // deep clone of Map values
  objectIdCounter: number;
  camera?: Camera | null;
  layers?: Record<LayerGroup, LayerEntry[]>;
}

export interface FabricObjectSnapshot {
  id: number;
  type: ObjectType;
  fabricState: Record<string, unknown>; // output of getFabricState(id)
}

export interface HistorySnapshot {
  storeSnapshot: StoreSnapshot;
  fabricSnapshots: FabricObjectSnapshot[];
  timestamp: number;
}

export interface HistoryState {
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  redoCount: number;
}

// ============================================
// Serialization (JSON export/import)
// ============================================
interface SerializedBase {
  id: number;
  type: ObjectType;
  name: string;
  left: number;
  top: number;
  scaleX: number;
  scaleY: number;
  angle: number;
}

export interface SerializedShape extends SerializedBase {
  type: "shape";
  widthM: number;
  heightM: number;
  color: string;
  baseWidthPx: number;
  baseHeightPx: number;
  width: number;
  height: number;
}

export interface SerializedLine extends SerializedBase {
  type: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  lengthM: number;
  color: string;
  strokeWidth: number;
}

export interface SerializedMask extends SerializedBase {
  type: "mask";
  width: number;
  height: number;
}

export interface SerializedImage extends SerializedBase {
  type: "backgroundImage" | "overlayImage";
  imageData: string;
  originX: string;
  originY: string;
}

export type SerializedObject =
  | SerializedShape
  | SerializedLine
  | SerializedMask
  | SerializedImage;

export interface BackgroundImagePosition {
  left: number;
  top: number;
  scaleX: number;
  scaleY: number;
}

export interface SerializedProjectBase {
  version: number;
  pixelsPerMeter: number | null;
  backgroundImage: string | null;
  backgroundImagePosition?: BackgroundImagePosition;
  savedAt: string;
  objects: SerializedObject[];
  id?: string; // IndexedDB key
}

export interface SerializedProjectV3 extends SerializedProjectBase {
  version: 3;
  metadata?: { appVersion?: string; exportedFrom?: string };
}

// V4 serialized objects: extend v3 types with optional world-space coords
export interface SerializedShapeV4 extends SerializedShape {
  worldX?: number; // center X in meters
  worldY?: number; // center Y in meters
}

export interface SerializedLineV4 extends SerializedLine {
  worldX1?: number; // start X in meters
  worldY1?: number; // start Y in meters
  worldX2?: number; // end X in meters
  worldY2?: number; // end Y in meters
}

export interface SerializedMaskV4 extends SerializedMask {
  worldX?: number; // top-left X in meters
  worldY?: number; // top-left Y in meters
  widthM?: number; // width in meters
  heightM?: number; // height in meters
}

export type SerializedObjectV4 =
  | SerializedShapeV4
  | SerializedLineV4
  | SerializedMaskV4
  | SerializedImage;

export interface SerializedCamera {
  pixelsPerMeter: number;
  zoom: number;
  panX: number;
  panY: number;
  viewportWidth: number;
  viewportHeight: number;
}

export interface SerializedLayerEntry {
  objectId: number;
  zIndex: number;
}

export interface SerializedLayers {
  background: SerializedLayerEntry[];
  masks: SerializedLayerEntry[];
  content: SerializedLayerEntry[];
}

export interface SerializedProjectV4 extends SerializedProjectBase {
  version: 4;
  camera?: SerializedCamera;
  layers?: SerializedLayers;
  metadata?: { appVersion?: string; exportedFrom?: string };
}

// Union keeps backward compat — v2 has no metadata field
export type SerializedProject = SerializedProjectBase;

// ============================================
// Mode transitions
// ============================================

/** Valid transitions between planner modes */
const MODE_TRANSITIONS: Record<PlannerMode, readonly PlannerMode[]> = {
  normal: ["calibrating", "drawing-line", "drawing-mask", "cleanup"],
  calibrating: ["normal"],
  "drawing-line": ["normal"],
  "drawing-mask": ["cleanup"],
  cleanup: ["normal", "drawing-mask"],
} as const;

/** Check whether a mode transition is valid */
export function canTransitionMode(from: PlannerMode, to: PlannerMode): boolean {
  if (from === to) return true;
  return MODE_TRANSITIONS[from].includes(to);
}

// ============================================
// Calibration transient state
// ============================================
export interface CalibrationState {
  startPoint: Point | null;
  line: Line | null;
  startCircle: Circle | null;
  endCircle: Circle | null;
  pixelLength: number | null;
}

// ============================================
// Store slices
// ============================================

// Canvas slice — calibration, mode, scale
export interface CanvasSliceState {
  mode: PlannerMode;
  pixelsPerMeter: number | null;
  calibrationPixelLength: number | null;
  showCalibrationInput: boolean;
  camera: Camera | null;
}

export interface CanvasSliceActions {
  setMode: (mode: PlannerMode) => void;
  setPixelsPerMeter: (ppm: number | null) => void;
  setCalibrationPixelLength: (len: number | null) => void;
  setShowCalibrationInput: (show: boolean) => void;
  setCamera: (camera: Camera) => void;
  updateCameraViewport: (width: number, height: number) => void;
}

export type CanvasSlice = CanvasSliceState & CanvasSliceActions;

// Objects slice — object CRUD
export interface ObjectsSliceState {
  objects: Map<number, PlannerObject>;
  objectIdCounter: number;
}

export interface ObjectsSliceActions {
  addObject: (obj: PlannerObject) => void;
  removeObject: (id: number) => void;
  updateObject: (id: number, partial: Partial<PlannerObject>) => void;
  clearObjects: (typesToClear?: ObjectType[]) => void;
  nextObjectId: () => number;
}

export type ObjectsSlice = ObjectsSliceState & ObjectsSliceActions;

// UI slice — colors, line width, status
export interface UISliceState {
  selectedColor: string;
  selectedLineColor: string;
  lineWidth: number;
  autoSaveEnabled: boolean;
  statusMessage: string;
}

export interface UISliceActions {
  setSelectedColor: (color: string) => void;
  setSelectedLineColor: (color: string) => void;
  setLineWidth: (w: number) => void;
  setAutoSaveEnabled: (enabled: boolean) => void;
  setStatusMessage: (msg: string) => void;
}

export type UISlice = UISliceState & UISliceActions;

// History slice
export interface HistorySliceState {
  historyState: HistoryState;
}

export interface HistorySliceActions {
  setHistoryState: (state: HistoryState) => void;
}

export type HistorySlice = HistorySliceState & HistorySliceActions;

// ============================================
// Layer system
// ============================================
export type LayerGroup = "background" | "masks" | "content";

export interface LayerEntry {
  objectId: number;
  zIndex: number; // ordering within the group
}

export interface LayerVisibility {
  background: boolean;
  masks: boolean;
  content: boolean;
}

export interface LayerSliceState {
  layers: Record<LayerGroup, LayerEntry[]>;
  layerVisibility: LayerVisibility;
}

export interface LayerSliceActions {
  addToLayer: (objectId: number, group: LayerGroup) => void;
  removeFromLayer: (objectId: number) => void;
  moveUpInLayer: (objectId: number) => void;
  moveDownInLayer: (objectId: number) => void;
  getRenderOrder: () => number[]; // flat array of objectIds in render order
  clearLayers: () => void;
  setLayerVisibility: (visibility: Partial<LayerVisibility>) => void;
}

export type LayerSlice = LayerSliceState & LayerSliceActions;

/** Determine which layer group an object type belongs to */
export function layerGroupForType(type: ObjectType): LayerGroup {
  switch (type) {
    case "backgroundImage":
      return "background";
    case "mask":
      return "masks";
    case "shape":
    case "line":
    case "overlayImage":
      return "content";
  }
}

// ============================================
// Multi-project types
// ============================================

export interface ProjectRecord {
  id: string; // UUID
  name: string;
  description?: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  deletedAt: string | null; // ISO 8601 or null
  thumbnailDataUrl: string | null;
  projectData: SerializedProject;
}

export interface AppState {
  lastOpenedProjectId: string | null;
}

// ============================================
// Project slice (multi-project management)
// ============================================

export type ActiveView = "picker" | "canvas" | "wizard";

export interface ProjectListItem {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  thumbnailDataUrl: string | null;
}

export interface ProjectSliceState {
  activeView: ActiveView;
  activeProjectId: string | null;
  projects: ProjectListItem[];
}

export interface ProjectSliceActions {
  setActiveView: (view: ActiveView) => void;
  setActiveProjectId: (id: string | null) => void;
  setProjects: (projects: ProjectListItem[]) => void;
  addProject: (project: ProjectListItem) => void;
  updateProjectMeta: (
    id: string,
    partial: Partial<Pick<ProjectListItem, "name" | "thumbnailDataUrl">>,
  ) => void;
  softDeleteProject: (id: string) => void;
  restoreProject: (id: string) => void;
  permanentlyDeleteProject: (id: string) => void;
}

export type ProjectSlice = ProjectSliceState & ProjectSliceActions;

// ============================================
// Compound store types (backward compat)
// ============================================
export type PlannerState = CanvasSliceState &
  ObjectsSliceState &
  UISliceState &
  HistorySliceState &
  LayerSliceState &
  ProjectSliceState;

export type PlannerActions = CanvasSliceActions &
  ObjectsSliceActions &
  UISliceActions &
  HistorySliceActions &
  LayerSliceActions &
  ProjectSliceActions & {
    loadProject: (data: {
      pixelsPerMeter: number | null;
      objects: PlannerObject[];
    }) => void;
    reset: () => void;
  };

export type PlannerStore = PlannerState & PlannerActions;
