# Canvas Hooks

All hooks live in `src/components/canvas/hooks/` and are composed inside `PlannerCanvas`.

## Hook Summary

| Hook                   | File                      | Purpose                                                      |
| ---------------------- | ------------------------- | ------------------------------------------------------------ |
| `useFabricCanvas`      | `useFabricCanvas.ts`      | Initialize Fabric canvas, handle resize and cleanup          |
| `usePanZoom`           | `usePanZoom.ts`           | Mouse wheel zoom (0.1x--10x), alt-drag / empty-space pan     |
| `useCalibration`       | `useCalibration.ts`       | Draw calibration line, calculate pixels-per-meter            |
| `useShapes`            | `useShapes.ts`            | Create/load shape rects with name + dimension labels         |
| `useLines`             | `useLines.ts`             | Draw distance lines with 45-degree snapping and meter labels |
| `useImages`            | `useImages.ts`            | Load background image, add overlay images                    |
| `useCleanup`           | `useCleanup.ts`           | Cleanup mode: hide objects, draw masks, add bg images        |
| `useCanvasEvents`      | `useCanvasEvents.ts`      | Central event dispatcher: routes mouse/object events by mode |
| `useKeyboardShortcuts` | `useKeyboardShortcuts.ts` | Delete/Backspace, Escape, undo/redo key handling             |
| `useHistory`           | `useHistory.ts`           | Snapshot-based undo/redo with image deduplication            |

## Hook Composition

```
PlannerCanvas
  |
  |-- useFabricCanvas() --> { canvasElRef, containerRef, fabricCanvasRef, initCanvas }
  |
  |-- allFabricRefsRef = useRef(new Map<number, AnyFabricRefs>())
  |
  |-- usePanZoom(fabricCanvasRef)
  |-- useCalibration(fabricCanvasRef)
  |-- useShapes(fabricCanvasRef, allFabricRefsRef as Map<number, ShapeFabricRefs>)
  |-- useLines(fabricCanvasRef, allFabricRefsRef as Map<number, LineFabricRefs>)
  |-- useImages(fabricCanvasRef, allFabricRefsRef as Map<number, ImageFabricRefs>)
  |-- useCleanup(fabricCanvasRef, allFabricRefsRef as Map<number, MaskFabricRefs | ImageFabricRefs>)
  |
  |-- useHistory(fabricCanvasRef, { getFabricState, restoreFromSnapshot })
  |
  |-- useCanvasEvents(fabricCanvasRef, { ...all handler callbacks })
  |-- useKeyboardShortcuts(fabricCanvasRef, { cancelCalibration, cancelLineDrawing, deleteSelected, undo, redo })
```

All hooks that manage objects receive `fabricCanvasRef` and a typed cast of `allFabricRefsRef`.

## Hook Details

### useFabricCanvas

**Returns:** `{ canvasElRef, containerRef, fabricCanvasRef, initCanvas }`

- Creates `fabric.Canvas` on first `initCanvas()` call (lazy)
- Canvas settings: `preserveObjectStacking: true`, dark background (`#1a1a2e`)
- Resizes canvas on window resize
- Disposes canvas on unmount

### usePanZoom

**Params:** `fabricCanvasRef`
**Returns:** `{ isPanningRef, startPan, movePan, endPan }`

- `startPan(clientX, clientY)` -- begin panning
- `movePan(clientX, clientY)` -- update viewport transform
- `endPan()` -- stop panning
- Zoom via mouse wheel in `useCanvasEvents` (min 0.1, max 10)

### useCalibration

**Params:** `fabricCanvasRef`
**Returns:** `{ startCalibration, cancelCalibration, applyCalibration, handleCalibrationClick, updateCalibrationLine, finishCalibrationLine, startPointRef }`

- `startCalibration()` -- sets mode to `calibrating`, locks all objects
- Click-drag draws a temporary orange dashed line with endpoint circles
- `finishCalibrationLine()` -- calculates pixel distance, shows calibration input UI
- `applyCalibration(meters)` -- sets `pixelsPerMeter = pixelDistance / meters`, removes visuals, returns to normal mode
- `cancelCalibration()` -- removes visuals, returns to normal mode

### useShapes

**Params:** `fabricCanvasRef, fabricRefsRef`
**Returns:** `{ addShape, updateShapeLabels, updateShapeDimensions, loadShape }`

- `addShape(name, widthM, heightM)` -- creates Rect + FabricText label + FabricText dims, centers on canvas
- `updateShapeLabels(rect)` -- repositions name and dims text relative to rect center
- `updateShapeDimensions(rect, finalize)` -- recalculates meters from `baseWidthPx * scaleX / pixelsPerMeter`, updates dims text, optionally updates store
- `loadShape(serialized)` -- reconstructs shape from `SerializedShape`

### useLines

**Params:** `fabricCanvasRef, fabricRefsRef`
**Returns:** `{ lineStartRef, startLineDrawing, cancelLineDrawing, handleLineDrawStart, updateDrawingLine, finishDrawingLine, updateLineLabel, loadLine }`

- `startLineDrawing()` -- sets mode to `drawing-line`
- Click-drag with 45-degree angle snapping
- Label displays length in meters (calculated from `pixelsPerMeter`)
- `finishDrawingLine()` -- validates min length (10px), creates store entry, returns to normal
- `loadLine(serialized)` -- reconstructs from `SerializedLine`

### useImages

**Params:** `fabricCanvasRef, fabricRefsRef`
**Returns:** `{ backgroundRef, loadBackgroundImage, loadBackgroundFromData, addOverlayImage, loadImageObject }`

- `loadBackgroundImage(file)` -- reads file, fits to 90% of canvas, locks object
- `loadBackgroundFromData(dataUrl, onComplete)` -- same but from base64 string (used during load)
- `addOverlayImage(file)` -- adds to canvas center, scaled to max 50% of canvas, never upscaled
- `loadImageObject(serialized)` -- reconstructs background or overlay image from serialized data

### useCleanup

**Params:** `fabricCanvasRef, fabricRefsRef`
**Returns:** `{ enterCleanupMode, exitCleanupMode, startDrawingMask, addCleanupImage, handleMaskDrawStart, updateMaskRect, finishMaskRect, loadMask }`

- `enterCleanupMode()` -- hides shapes/lines/overlays, shows masks + bg images
- `exitCleanupMode()` -- reverses visibility, returns to normal
- `startDrawingMask()` -- sets mode to `drawing-mask`
- Click-drag creates white filled rectangle (mask)
- `finishMaskRect()` -- validates min size (10px), removes stroke, stores mask, returns to cleanup mode
- `addCleanupImage(file)` -- adds a background image in cleanup context
- `loadMask(serialized)` -- reconstructs from `SerializedMask`

### useCanvasEvents

**Params:** `fabricCanvasRef, handlers: CanvasEventHandlers`
**Returns:** void (registers/unregisters Fabric event listeners)

Registers handlers for:

| Fabric Event      | Behavior                                                                |
| ----------------- | ----------------------------------------------------------------------- |
| `mouse:down`      | Route by mode: calibration click, mask start, line start, or pan start  |
| `mouse:move`      | Route by mode: update calibration line, mask rect, drawing line, or pan |
| `mouse:up`        | Route by mode: finish calibration, mask, line, or end pan               |
| `object:modified` | Update shape dims/labels or line label, trigger auto-save               |
| `object:scaling`  | Live-update shape dimensions during scale                               |
| `object:moving`   | Update shape/line label positions                                       |
| `object:rotating` | Update shape label positions                                            |

### useKeyboardShortcuts

**Params:** `fabricCanvasRef, { cancelCalibration, cancelLineDrawing, deleteSelected, undo, redo }`
**Returns:** void (registers/unregisters keydown listener)

**Stable handler ref pattern**: A single `keydown` listener is registered on mount (empty dependency array). A `handlerRef` is updated synchronously each render with the latest closure. The listener delegates to `handlerRef.current`, so it always sees fresh state without re-registering -- no listener churn.

All shortcuts are skipped when an `<input>` or `<textarea>` has focus.

| Key                            | Action                                                        |
| ------------------------------ | ------------------------------------------------------------- |
| `Delete` / `Backspace`         | Delete selected objects                                       |
| `Escape`                       | Cancel current mode (calibration, line drawing, drawing-mask) |
| `Ctrl+Z` / `Cmd+Z`             | Undo                                                          |
| `Ctrl+Shift+Z` / `Cmd+Shift+Z` | Redo                                                          |
| `Ctrl+Y` / `Cmd+Y`             | Redo (alternate)                                              |

### useHistory

**Params:** `{ getFabricState, restoreFromSnapshot }`
**Returns:** `{ captureSnapshot, undo, redo, resetHistory, isRestoringRef, managerRef }`

| Function            | Description                                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `captureSnapshot()` | Captures paired Zustand + Fabric state. Only runs in `normal`/`cleanup` modes; skipped when `isRestoringRef` is true. Registers image data in IDB pool for deduplication. |
| `undo()`            | Decrements history pointer, restores previous snapshot. Sets `isRestoringRef` during restore to prevent nested captures.                                                  |
| `redo()`            | Increments history pointer, restores next snapshot. Same guarding as undo.                                                                                                |
| `resetHistory()`    | Clears history stack and IDB image pool. Called on project load/import.                                                                                                   |
| `isRestoringRef`    | `React.MutableRefObject<boolean>` -- true during restore, prevents snapshot capture loops                                                                                 |
| `managerRef`        | `React.MutableRefObject<HistoryManager>` -- direct access to the `HistoryManager` instance                                                                                |

Backed by a layered architecture in `lib/history.ts`:

1. **HistoryStack** — immutable data structure manipulated by pure functions (`pushSnapshot`, `undoStack`, `redoStack`, `getStackState`, `getCurrentSnapshot`). 50-entry limit enforced by `HISTORY_LIMIT`.
2. **ImagePool** — class managing IDB-backed image deduplication with reference counting and an LRU in-memory cache (3 entries). Accepts an optional `StorageAdapter`.
3. **HistoryManager** — wrapper composing `HistoryStack` + `ImagePool`. Provides `push()`, `undo()`, `redo()`, `getState()`, `reset()`. Automatically releases images from discarded or evicted snapshots.

## PlannerCanvasHandle

The imperative API exposed by `PlannerCanvas` via `forwardRef`:

```typescript
interface PlannerCanvasHandle {
  // Calibration
  startCalibration: () => void;
  cancelCalibration: () => void;
  applyCalibration: (meters: number) => void;
  // Shapes
  addShape: (name: string, widthM: number, heightM: number) => void;
  // Lines
  startLineDrawing: () => void;
  cancelLineDrawing: () => void;
  // Images
  loadBackgroundImage: (file: File) => void;
  addOverlayImage: (file: File) => void;
  // Cleanup
  enterCleanupMode: () => void;
  exitCleanupMode: () => void;
  startDrawingMask: () => void;
  addCleanupImage: (file: File) => void;
  // Objects
  selectObject: (id: number) => void;
  deleteObject: (id: number) => void;
  deleteSelected: () => void;
  clearAll: () => void;
  moveObjectUp: (id: number) => void;
  moveObjectDown: (id: number) => void;
  selectedObjectId: () => number | null;
  // History
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  // Storage
  save: () => Promise<void>;
  load: () => Promise<void>;
  clearStorage: () => Promise<void>;
  exportJson: () => void;
  importJson: (file: File) => Promise<void>;
  toggleAutoSave: () => void;
  // Reorder
  reorderObjects: () => void;
}
```
