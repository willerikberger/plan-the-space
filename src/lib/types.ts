import type { Rect, FabricText, Line, FabricImage, Circle } from "fabric";

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
}

export interface LineObject extends BaseObject {
  type: "line";
  lengthM: number;
  color: string;
}

export interface MaskObject extends BaseObject {
  type: "mask";
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
  rect: Rect;
  label: FabricText;
  dims: FabricText;
}

export interface LineFabricRefs {
  line: Line;
  label: FabricText;
}

export interface MaskFabricRefs {
  rect: Rect;
}

export interface ImageFabricRefs {
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
  backgroundImageRef: ImageRef | null;
  objects: PlannerObject[]; // deep clone of Map values
  objectIdCounter: number;
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

export interface SerializedProjectBase {
  version: number;
  pixelsPerMeter: number | null;
  backgroundImage: string | null;
  savedAt: string;
  objects: SerializedObject[];
  id?: string; // IndexedDB key
}

export interface SerializedProjectV3 extends SerializedProjectBase {
  version: 3;
  metadata?: { appVersion?: string; exportedFrom?: string };
}

// Union keeps backward compat — v2 has no metadata field
export type SerializedProject = SerializedProjectBase;

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
  backgroundImageData: string | null;
  calibrationPixelLength: number | null;
  showCalibrationInput: boolean;
}

export interface CanvasSliceActions {
  setMode: (mode: PlannerMode) => void;
  setPixelsPerMeter: (ppm: number | null) => void;
  setBackgroundImageData: (data: string | null) => void;
  setCalibrationPixelLength: (len: number | null) => void;
  setShowCalibrationInput: (show: boolean) => void;
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
// Compound store types (backward compat)
// ============================================
export type PlannerState = CanvasSliceState &
  ObjectsSliceState &
  UISliceState &
  HistorySliceState;

export type PlannerActions = CanvasSliceActions &
  ObjectsSliceActions &
  UISliceActions &
  HistorySliceActions & {
    loadProject: (data: {
      pixelsPerMeter: number | null;
      backgroundImageData: string | null;
      objects: PlannerObject[];
    }) => void;
    reset: () => void;
  };

export type PlannerStore = PlannerState & PlannerActions;
