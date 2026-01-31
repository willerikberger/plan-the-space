# Architecture

## Component Hierarchy

```
app/page.tsx
  ClientLoader (dynamic import, ssr: false)
    ErrorBoundary (catches render errors, offers reload)
      PlannerApp
      Sidebar
        CalibrationPanel
        ShapePanel
        LinePanel
        ImagePanel
        CleanupPanel
        ObjectList
        StoragePanel
      Toolbar
      PlannerCanvas (forwardRef, imperative handle)
        useFabricCanvas       -- canvas init, resize, cleanup
        usePanZoom            -- zoom + pan via mouse wheel / alt-drag
        useCalibration        -- calibration line + endpoint circles
        useShapes             -- shape rects + labels + dims
        useLines              -- distance lines + labels
        useImages             -- background + overlay images
        useCleanup            -- mask rects + cleanup mode toggling
        useCanvasEvents       -- routes mouse/object events by mode
        useKeyboardShortcuts  -- Delete, Escape, undo/redo handlers
        useHistory            -- snapshot-based undo/redo with image deduplication
      StatusBar
```

## Data Flow

```
Sidebar panel
  --> PlannerApp callback
    --> canvasRef.current.someMethod()
      --> Hook function (e.g. shapes.addShape)
        --> Creates Fabric object(s)
        --> Stores metadata in Zustand (usePlannerStore)
        --> Stores Fabric refs in allFabricRefsRef Map
```

User canvas interactions flow through `useCanvasEvents`:

```
Fabric event (mouse:down, object:modified, etc.)
  --> useCanvasEvents handler
    --> Reads current mode from store
    --> Dispatches to mode-specific hook handler
    --> Hook updates Fabric objects + store
    --> triggerAutoSave() if applicable
```

Canvas-level operations are extracted into utility modules:

- `canvasOrchestration.ts` — pure functions: `getFabricState`, `clearCanvas`, `reorderObjects`, `deleteObject`, `loadProjectFromData`
- `autoSave.ts` — `scheduleAutoSave` (debounced timer) and `handleBeforeUnload` (best-effort save on page close)

## State Management Split

The app separates state into two layers:

| Layer         | Location                                        | Contents                                                               | Serializable |
| ------------- | ----------------------------------------------- | ---------------------------------------------------------------------- | ------------ |
| Zustand store | `lib/store.ts`                                  | Object metadata, mode, scale, colors, status                           | Yes          |
| FabricRefs    | `allFabricRefsRef` (React ref in PlannerCanvas) | Mutable Fabric.js canvas objects (Rect, Line, FabricText, FabricImage) | No           |

Fabric objects cannot go into Zustand because they are mutable class instances with circular references. The FabricRefs `Map<number, FabricRefs>` is a React ref that lives alongside the store, keyed by object ID.

## Mode System

```typescript
type PlannerMode =
  | "normal"
  | "calibrating"
  | "drawing-line"
  | "drawing-mask"
  | "cleanup";
```

Mode transitions:

```
NORMAL <--> CALIBRATING     (start/cancel/apply calibration)
NORMAL <--> DRAWING-LINE    (start/cancel/finish line)
NORMAL <--> CLEANUP         (enter/exit cleanup mode)
CLEANUP --> DRAWING-MASK    (start drawing mask)
DRAWING-MASK --> CLEANUP    (finish/cancel mask)
```

`useCanvasEvents` checks `usePlannerStore.getState().mode` on every mouse event and routes to the appropriate handler:

- `calibrating` --> `handleCalibrationClick`, `updateCalibrationLine`, `finishCalibrationLine`
- `drawing-mask` --> `handleMaskDrawStart`, `updateMaskRect`, `finishMaskRect`
- `drawing-line` --> `handleLineDrawStart`, `updateDrawingLine`, `finishDrawingLine`
- `normal` / `cleanup` --> pan/zoom, object selection, standard interactions

## Auto-Save

1. `triggerAutoSave()` is called after any object modification (move, scale, rotate, create, delete)
2. Existing timer is cleared, new timer set with 2000ms delay
3. On timeout: `serializeProject()` combines store metadata + Fabric state, writes to IndexedDB
4. Always on (`autoSaveEnabled` defaults to `true`); wrapped in try/catch with status messages
5. `beforeunload` handler warns if unsaved changes exist

## Undo/Redo (History)

Snapshot-based hybrid approach that pairs Zustand store state with Fabric canvas state. The implementation in `lib/history.ts` is layered:

1. **HistoryStack** — immutable data structure (`{ readonly entries, readonly pointer }`) manipulated by pure functions (`pushSnapshot`, `undoStack`, `redoStack`, `getStackState`). Max `HISTORY_LIMIT` (50) entries; eviction returns discarded snapshots so their images can be released.
2. **ImagePool** — class providing IDB-backed image deduplication with reference counting. Images are stored once under a fingerprint key (`img_${length}_${first64}_${last64}`). An LRU in-memory cache (`IMAGE_LRU_SIZE` = 3) provides fast resolution without IDB reads.
3. **HistoryManager** — wrapper composing `HistoryStack` + `ImagePool`, no React dependency. Exposes `push()`, `undo()`, `redo()`, `getState()`, `reset()`. Automatically releases images from discarded or evicted snapshots.

**Mode guard**: snapshots are only captured in `normal` or `cleanup` modes, and skipped when `isRestoringRef` is true (prevents nested captures during restore).

**Snapshot capture triggers:**

| Trigger                             | Hook/Method                             |
| ----------------------------------- | --------------------------------------- |
| Add/delete shape                    | `addShapeWithHistory`, `deleteSelected` |
| Add/delete line                     | line drawing finish, `deleteSelected`   |
| Add/delete mask                     | mask drawing finish, `deleteSelected`   |
| Load background image               | `loadBackgroundImage`                   |
| Add overlay/cleanup image           | `addOverlayImage`, `addCleanupImage`    |
| Apply calibration                   | `applyCalibration`                      |
| Object modified (move/scale/rotate) | `object:modified` handler               |
| Reorder objects                     | `moveObjectUp`, `moveObjectDown`        |
| Clear all                           | `clearAll`                              |
| Load/import project                 | after `resetHistory()` + project load   |

## Serialization Strategy

**Export (save/export):**

1. Iterate store objects
2. For each, call `getFabricState(id)` to extract position/scale/rotation from the Fabric object
3. `serializeObject()` merges metadata + Fabric state into `SerializedObject`
4. Wrap in `SerializedProject` (version 3, timestamp, background image data, metadata)

**Import (load/import):**

1. `deserializeProject()` splits JSON into `PlannerObject[]` (store) + `SerializedObject[]` (for Fabric reconstruction)
2. `loadProject()` bulk-loads metadata into the store
3. Each hook's `load*()` function (e.g. `shapes.loadShape`, `lines.loadLine`) reconstructs Fabric objects from the serialized data
4. `reorderObjects()` ensures correct z-ordering

## Z-Order

Canvas objects are layered bottom-to-top:

1. Background image (locked, not selectable)
2. Mask rectangles
3. Background image objects (from cleanup mode)
4. Shapes, lines, overlay images (user-interactable)

`reorderObjects()` enforces this ordering after any load or structural change.
