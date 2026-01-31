# State Management

## Zustand Store

Defined in `src/lib/store.ts`. Created with `create<PlannerStore>()`.

### State Shape

| Field | Type | Default | Description |
|---|---|---|---|
| `mode` | `PlannerMode` | `'normal'` | Current interaction mode |
| `pixelsPerMeter` | `number \| null` | `null` | Scale factor (set via calibration) |
| `backgroundImageData` | `string \| null` | `null` | Base64 data URL of main background |
| `objects` | `Map<number, PlannerObject>` | empty Map | All object metadata |
| `objectIdCounter` | `number` | `0` | Monotonic ID generator |
| `selectedColor` | `string` | `'rgba(76, 175, 80, 0.6)'` | Current shape fill color |
| `selectedLineColor` | `string` | `'rgba(244, 67, 54, 1)'` | Current line stroke color |
| `lineWidth` | `number` | `3` | Line stroke width |
| `autoSaveEnabled` | `boolean` | `true` | Whether auto-save is active (always on) |
| `historyState` | `HistoryState` | `{ canUndo: false, canRedo: false, undoCount: 0, redoCount: 0 }` | Undo/redo availability for toolbar buttons |
| `statusMessage` | `string` | `'Load an image to get started'` | Status bar text |
| `calibrationPixelLength` | `number \| null` | `null` | Measured pixel distance (calibration UI) |
| `showCalibrationInput` | `boolean` | `false` | Whether calibration input is visible |

### Actions

| Action | Signature | Description |
|---|---|---|
| `setMode` | `(mode: PlannerMode) => void` | Set interaction mode |
| `setPixelsPerMeter` | `(ppm: number \| null) => void` | Set scale |
| `setBackgroundImageData` | `(data: string \| null) => void` | Set background image |
| `addObject` | `(obj: PlannerObject) => void` | Add object to map |
| `removeObject` | `(id: number) => void` | Remove object by ID |
| `updateObject` | `(id: number, partial: Partial<PlannerObject>) => void` | Merge partial update |
| `clearObjects` | `(typesToClear?: ObjectType[]) => void` | Clear all or specific types |
| `nextObjectId` | `() => number` | Increment counter, return previous value |
| `setSelectedColor` | `(color: string) => void` | Set shape color |
| `setSelectedLineColor` | `(color: string) => void` | Set line color |
| `setLineWidth` | `(w: number) => void` | Set line width |
| `setAutoSaveEnabled` | `(enabled: boolean) => void` | Toggle auto-save |
| `setHistoryState` | `(state: HistoryState) => void` | Update undo/redo availability (called by `useHistory`) |
| `setStatusMessage` | `(msg: string) => void` | Set status text |
| `setCalibrationPixelLength` | `(len: number \| null) => void` | Set pixel distance |
| `setShowCalibrationInput` | `(show: boolean) => void` | Show/hide calibration UI |
| `loadProject` | `(data: { pixelsPerMeter, backgroundImageData, objects }) => void` | Bulk load from import |
| `reset` | `() => void` | Reset to initial state |

### Selectors

```typescript
// Returns shapes, lines, and overlay images (not masks or background images)
selectVisibleObjects(state: PlannerStore): PlannerObject[]

// Lookup by ID
selectObjectById(state: PlannerStore, id: number): PlannerObject | undefined
```

### Access Patterns

```typescript
// Reactive (in components)
const mode = usePlannerStore((s) => s.mode)

// Synchronous (in callbacks, event handlers)
const state = usePlannerStore.getState()
state.setMode('normal')
```

## FabricRefs Pattern

### Why Fabric Objects Can't Live in Zustand

Fabric.js objects (`Rect`, `Line`, `FabricText`, `FabricImage`) are:
- Mutable class instances with internal state
- Contain circular references (canvas <-> object)
- Not serializable (methods, DOM references)
- Managed by the Fabric canvas lifecycle

Zustand expects serializable, immutable-style updates. Putting Fabric objects there would break reactivity and serialization.

### The Map Approach

`PlannerCanvas` holds a single React ref:

```typescript
const allFabricRefsRef = useRef(new Map<number, AnyFabricRefs>())
```

Each hook receives a typed cast of this ref:

```typescript
const shapes = useShapes(
  fabricCanvasRef,
  allFabricRefsRef as React.RefObject<Map<number, ShapeFabricRefs>>,
)
```

### FabricRefs Types

| Type | Keys | For |
|---|---|---|
| `ShapeFabricRefs` | `rect`, `label`, `dims` | Shape rectangles with name + dimension text |
| `LineFabricRefs` | `line`, `label` | Distance lines with length text |
| `MaskFabricRefs` | `rect` | Cleanup mask rectangles |
| `ImageFabricRefs` | `image` | Background and overlay images |

### Custom Fabric Properties

Fabric objects carry custom properties for identification:

| Property | Type | Set on | Purpose |
|---|---|---|---|
| `objectId` | `number` | Primary objects (rect, line, image) | Links Fabric object to store |
| `objectType` | `string` | All Fabric objects | Discriminator (`'shape'`, `'line'`, `'mask'`, `'background'`, etc.) |
| `parentId` | `number` | Labels and dims text | Links child text to parent object |
| `baseWidthPx` | `number` | Shape rects | Original unscaled width |
| `baseHeightPx` | `number` | Shape rects | Original unscaled height |
| `shapeName` | `string` | Shape rects | Display name |

Accessed via: `(fabricObject as unknown as Record<string, unknown>).objectId`

## Object Lifecycle

```
1. CREATE
   Hook (e.g. addShape) called
   --> nextObjectId() from store
   --> Create Fabric objects (rect, label, dims)
   --> Set custom props (objectId, objectType, etc.)
   --> Add to Fabric canvas
   --> Store metadata in Zustand (addObject)
   --> Store Fabric refs in allFabricRefsRef Map

2. MODIFY
   User drags/scales/rotates on canvas
   --> useCanvasEvents fires handler
   --> Hook updates Fabric objects directly (label positions, dims text)
   --> If finalized: updateObject() on store
   --> captureSnapshot() (history)
   --> triggerAutoSave()

3. SERIALIZE
   save/export triggered
   --> Iterate store objects
   --> getFabricState(id) extracts position/scale from Fabric object
   --> serializeObject() merges metadata + Fabric state
   --> Write to IndexedDB or download as JSON

4. DELETE
   deleteObject(id) called
   --> Remove all Fabric objects from canvas (rect, label, dims, line, image)
   --> Delete from allFabricRefsRef Map
   --> removeObject(id) from store
   --> captureSnapshot() (history)
   --> triggerAutoSave()
```
