# Types

All types are defined in `src/lib/types.ts`.

## Mode

```typescript
type PlannerMode =
  | "normal"
  | "calibrating"
  | "drawing-line"
  | "drawing-mask"
  | "cleanup";
```

| Value          | Description                                   |
| -------------- | --------------------------------------------- |
| `normal`       | Default. Select, move, scale, rotate objects. |
| `calibrating`  | Drawing a reference line to set scale.        |
| `drawing-line` | Drawing a distance measurement line.          |
| `drawing-mask` | Drawing a cleanup mask rectangle.             |
| `cleanup`      | Viewing masks and background images only.     |

## Object Types

```typescript
type ObjectType =
  | "shape"
  | "line"
  | "mask"
  | "backgroundImage"
  | "overlayImage";
```

## Geometry

```typescript
interface Point {
  x: number;
  y: number;
}

interface SnappedPoint extends Point {
  angle: number; // Angle in radians, snapped to 45-degree increments
}
```

## Planner Objects (Discriminated Union)

Store metadata only -- no Fabric references.

```typescript
// Base (not exported)
interface BaseObject {
  id: number;
  name: string;
}

interface ShapeObject extends BaseObject {
  type: "shape";
  widthM: number; // Width in meters
  heightM: number; // Height in meters
  color: string; // Fill color (RGBA string)
}

interface LineObject extends BaseObject {
  type: "line";
  lengthM: number; // Length in meters
  color: string; // Stroke color (RGBA string)
}

interface MaskObject extends BaseObject {
  type: "mask";
}

interface BackgroundImageObject extends BaseObject {
  type: "backgroundImage";
  imageData: string; // Base64 data URL
}

interface OverlayImageObject extends BaseObject {
  type: "overlayImage";
  imageData: string; // Base64 data URL
}

type PlannerObject =
  | ShapeObject
  | LineObject
  | MaskObject
  | BackgroundImageObject
  | OverlayImageObject;
```

## Fabric Ref Types

Mutable references to Fabric.js canvas objects, stored in `allFabricRefsRef`.

```typescript
interface ShapeFabricRefs {
  rect: Rect; // The rectangle
  label: FabricText; // Name label (centered on rect)
  dims: FabricText; // Dimensions text, e.g. "2.0m x 3.0m"
}

interface LineFabricRefs {
  line: Line; // The line object
  label: FabricText; // Length label at midpoint
}

interface MaskFabricRefs {
  rect: Rect; // White filled rectangle (mask area)
}

interface ImageFabricRefs {
  image: FabricImage; // The image object
}

type FabricRefs =
  | ShapeFabricRefs
  | LineFabricRefs
  | MaskFabricRefs
  | ImageFabricRefs;
```

## FabricCustomProps

Custom properties attached to Fabric objects at runtime, defined in `types.ts`. Accessed via `getFabricProp(obj, key)` / `setFabricProps(obj, props)` from `fabricHelpers.ts`.

```typescript
interface FabricCustomProps {
  objectId?: number; // Links Fabric object to store entry
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
  parentId?: number; // Links child text objects to parent
  shapeName?: string; // Display name for shapes
  shapeWidthM?: number; // Real-world width in meters
  shapeHeightM?: number; // Real-world height in meters
  shapeColor?: string; // Shape fill color
  baseWidthPx?: number; // Original unscaled width in pixels
  baseHeightPx?: number; // Original unscaled height in pixels
  imageData?: string; // Base64 data URI for images
  imageDataRef?: string; // ImagePool ref key (used in history snapshots)
  lineName?: string; // Display name for lines
  lineColor?: string; // Line stroke color
  lengthM?: number; // Line length in meters
}
```

## Store Slice Types

The Zustand store is composed from four slices. Each slice defines a `*State` interface (fields) and a `*Actions` interface (setters), combined into a single type.

```typescript
// Canvas slice — mode, calibration, scale
type CanvasSlice = CanvasSliceState & CanvasSliceActions

// Objects slice — object CRUD
type ObjectsSlice = ObjectsSliceState & ObjectsSliceActions

// UI slice — colors, line width, auto-save, status
type UISlice = UISliceState & UISliceActions

// History slice — undo/redo availability
type HistorySlice = HistorySliceState & HistorySliceActions

// Compound types (composed from slices)
type PlannerState = CanvasSliceState & ObjectsSliceState & UISliceState & HistorySliceState
type PlannerActions = CanvasSliceActions & ObjectsSliceActions & UISliceActions &
  HistorySliceActions & { loadProject: (...) => void; reset: () => void }
type PlannerStore = PlannerState & PlannerActions
```

See the full slice interfaces with all fields in `src/lib/types.ts` (lines 232-313).

## Storage Types

Defined in `src/lib/storage/storageAdapter.ts`.

```typescript
interface StorageAdapter {
  save(project: SerializedProject): Promise<void>;
  load(): Promise<SerializedProject | null>;
  clear(): Promise<void>;
  saveImage(ref: string, data: string): Promise<void>;
  loadImage(ref: string): Promise<string | null>;
  deleteImage(ref: string): Promise<void>;
  clearImages(): Promise<void>;
}

interface DBMigration {
  fromVersion: number; // The DB version this migration upgrades FROM
  migrate(db: IDBDatabase, tx: IDBTransaction): void;
}
```

Two implementations:

- `createIndexedDBAdapter()` — production adapter using real IndexedDB
- `createInMemoryAdapter()` — test/SSR adapter using plain `Map`s

## HistoryStack

Immutable data structure for undo/redo, defined in `lib/history.ts`:

```typescript
interface HistoryStack {
  readonly entries: readonly HistorySnapshot[];
  readonly pointer: number; // -1 = empty
}
```

Manipulated by pure functions: `pushSnapshot(stack, snapshot)`, `undoStack(stack)`, `redoStack(stack)`, `getStackState(stack)`, `getCurrentSnapshot(stack)`. All return new stack instances.

## History Types

```typescript
// Fingerprint key for deduplicated image data: "img_${length}_${first64}_${last64}"
type ImageRef = string;

interface StoreSnapshot {
  pixelsPerMeter: number | null;
  backgroundImageRef: ImageRef | null; // ref to deduplicated image in IDB pool
  objects: PlannerObject[]; // deep clone of store Map values
  objectIdCounter: number;
}

interface FabricObjectSnapshot {
  id: number;
  type: ObjectType;
  fabricState: Record<string, unknown>; // extracted from getFabricState()
}

interface HistorySnapshot {
  storeSnapshot: StoreSnapshot;
  fabricSnapshots: FabricObjectSnapshot[];
  timestamp: number; // Date.now()
}

interface HistoryState {
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number; // pointer position
  redoCount: number; // stack.length - 1 - pointer
}
```

## Serialization Types

### SerializedObject (Discriminated Union)

```typescript
// Base (not exported)
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

interface SerializedShape extends SerializedBase {
  type: "shape";
  widthM: number;
  heightM: number;
  color: string;
  baseWidthPx: number; // Original unscaled width in pixels
  baseHeightPx: number; // Original unscaled height in pixels
  width: number; // Current Fabric rect width
  height: number; // Current Fabric rect height
}

interface SerializedLine extends SerializedBase {
  type: "line";
  x1: number; // Start x
  y1: number; // Start y
  x2: number; // End x
  y2: number; // End y
  lengthM: number;
  color: string;
  strokeWidth: number;
}

interface SerializedMask extends SerializedBase {
  type: "mask";
  width: number; // Computed width (fabricWidth * scaleX)
  height: number; // Computed height (fabricHeight * scaleY)
}

interface SerializedImage extends SerializedBase {
  type: "backgroundImage" | "overlayImage";
  imageData: string; // Base64 data URL
  originX: string; // Fabric origin X
  originY: string; // Fabric origin Y
}

type SerializedObject =
  | SerializedShape
  | SerializedLine
  | SerializedMask
  | SerializedImage;
```

### SerializedProject

```typescript
// Base type (covers both v2 and v3 shapes)
interface SerializedProjectBase {
  version: number;
  pixelsPerMeter: number | null;
  backgroundImage: string | null; // Base64 data URL of main background
  savedAt: string; // ISO 8601 timestamp
  objects: SerializedObject[];
  id?: string; // Present when stored in IndexedDB
}

// V3 adds optional metadata
interface SerializedProjectV3 extends SerializedProjectBase {
  version: 3;
  metadata?: {
    appVersion?: string; // e.g. '1.0.0'
    exportedFrom?: string; // e.g. 'plan-the-space'
  };
}

// Union type used throughout the codebase
type SerializedProject = SerializedProjectBase;
```

## Calibration State

Transient state during calibration (not persisted).

```typescript
interface CalibrationState {
  startPoint: Point | null;
  line: Line | null; // Temporary calibration line
  startCircle: Circle | null; // Start endpoint visual
  endCircle: Circle | null; // End endpoint visual
  pixelLength: number | null; // Measured pixel distance
}
```

## Store Types (Flat View)

These are the compound types composed from slices (see Store Slice Types above for the per-slice breakdown).

```typescript
interface PlannerState {
  mode: PlannerMode;
  pixelsPerMeter: number | null;
  backgroundImageData: string | null;
  objects: Map<number, PlannerObject>;
  objectIdCounter: number;
  selectedColor: string;
  selectedLineColor: string;
  lineWidth: number;
  autoSaveEnabled: boolean; // default: true (always on)
  historyState: HistoryState; // undo/redo availability
  statusMessage: string;
  calibrationPixelLength: number | null;
  showCalibrationInput: boolean;
}

interface PlannerActions {
  setMode: (mode: PlannerMode) => void;
  setPixelsPerMeter: (ppm: number | null) => void;
  setBackgroundImageData: (data: string | null) => void;
  addObject: (obj: PlannerObject) => void;
  removeObject: (id: number) => void;
  updateObject: (id: number, partial: Partial<PlannerObject>) => void;
  clearObjects: (typesToClear?: ObjectType[]) => void;
  nextObjectId: () => number;
  setSelectedColor: (color: string) => void;
  setSelectedLineColor: (color: string) => void;
  setLineWidth: (w: number) => void;
  setAutoSaveEnabled: (enabled: boolean) => void;
  setHistoryState: (state: HistoryState) => void;
  setStatusMessage: (msg: string) => void;
  setCalibrationPixelLength: (len: number | null) => void;
  setShowCalibrationInput: (show: boolean) => void;
  loadProject: (data: {
    pixelsPerMeter: number | null;
    backgroundImageData: string | null;
    objects: PlannerObject[];
  }) => void;
  reset: () => void;
}

type PlannerStore = PlannerState & PlannerActions;
```
