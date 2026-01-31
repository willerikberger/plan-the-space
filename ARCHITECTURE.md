# Architecture

Plan the Space is a client-side canvas application for designing physical spaces to scale.
Users load a floor plan image, calibrate the pixel-to-meter ratio, then place shapes and
measurement lines at real-world dimensions. The entire app runs in the browser with no
backend -- persistence is handled through IndexedDB and JSON file export.

## Tech Stack

| Layer     | Technology                          |
| --------- | ----------------------------------- |
| Framework | Next.js 16 (App Router), React 19   |
| Language  | TypeScript 5                        |
| Canvas    | Fabric.js 6.9.1                     |
| State     | Zustand 5                           |
| Styling   | Tailwind CSS 4, Radix UI primitives |
| Icons     | Lucide                              |
| Testing   | Vitest 4, happy-dom, fake-indexeddb |

## Architecture Diagram

```
 Next.js App Router (SSR-disabled via next/dynamic)
 ┌──────────────────────────────────────────────────────────────────┐
 │  page.tsx ──> ClientLoader (dynamic, ssr: false, + Suspense)    │
 │                  │                                               │
 │                  ▼                                               │
 │  ┌──────────────────────────────────────────────────────┐       │
 │  │  ErrorBoundary                                       │       │
 │  │  ┌────────────────────────────────────────────────┐  │       │
 │  │  │              PlannerApp                        │  │       │
 │  │  │  ┌──────────┐       ┌───────────────────────┐  │  │       │
 │  │  │  │ Sidebar  │       │     main area         │  │  │       │
 │  │  │  │          │       │  ┌─────────────────┐  │  │  │       │
 │  │  │  │ Panels:  │       │  │    Toolbar      │  │  │  │       │
 │  │  │  │  Image   │  ref  │  ├─────────────────┤  │  │  │       │
 │  │  │  │  Calib.  │──────▶│  │ PlannerCanvas   │  │  │  │       │
 │  │  │  │  Shape   │       │  │ (forwardRef)    │  │  │  │       │
 │  │  │  │  Line    │       │  │                 │  │  │  │       │
 │  │  │  │  Cleanup │       │  │ Fabric <canvas> │  │  │  │       │
 │  │  │  │  Objects │       │  │ + 10 hooks      │  │  │  │       │
 │  │  │  │  Storage │       │  ├─────────────────┤  │  │  │       │
 │  │  │  └──────────┘       │  │   StatusBar     │  │  │  │       │
 │  │  │                     │  └─────────────────┘  │  │  │       │
 │  │  │                     └───────────────────────┘  │  │       │
 │  │  └────────────────────────────────────────────────┘  │       │
 │  └──────────────────────────────────────────────────────┘       │
 └──────────────────────────────────────────────────────────────────┘

 State & Persistence
 ┌───────────────────┐   ┌───────────────────┐   ┌────────────────┐
 │   Zustand Store   │   │  HistoryManager   │   │   IndexedDB    │
 │                   │   │                   │   │                │
 │  CanvasSlice      │   │  HistoryStack     │   │  projects      │
 │  ObjectsSlice     │◀──│  ImagePool ───────│──▶│  image-pool    │
 │  UISlice          │   │                   │   │                │
 │  HistorySlice     │   └───────────────────┘   └────────────────┘
 └───────────────────┘

 Data flow (user action):
   Sidebar click ──ref──▶ PlannerCanvasHandle method
     ──▶ hook function (e.g. useShapes.addShape)
       ──▶ Fabric canvas (create/modify objects)
       ──▶ Zustand store (addObject / updateObject)
       ──▶ captureSnapshot ──▶ HistoryManager
       ──▶ triggerAutoSave ──▶ scheduleAutoSave ──▶ IndexedDB
```

## Module Structure

```
src/
  app/
    page.tsx                        # Root route, renders ClientLoader
    layout.tsx                      # Root layout with metadata

  components/
    ClientLoader.tsx                # next/dynamic wrapper (ssr: false) with loading skeleton
    PlannerApp.tsx                  # Top-level layout: Sidebar + Canvas + Toolbar + StatusBar
    ErrorBoundary.tsx               # React class error boundary with reload button

    canvas/
      PlannerCanvas.tsx             # forwardRef component; composes all hooks, exposes
                                    #   PlannerCanvasHandle via useImperativeHandle
      hooks/
        useFabricCanvas.ts          # Creates Fabric.js Canvas, handles resize and disposal
        usePanZoom.ts               # Mouse-wheel zoom and click-drag pan
        useCalibration.ts           # Calibration line workflow (draw, measure, apply PPM)
        useShapes.ts                # Create/load rectangular shapes with labels and dims
        useLines.ts                 # Draw/load measurement lines with 45-degree snapping
        useImages.ts                # Background and overlay image loading
        useCleanup.ts               # Cleanup mode: mask rectangles, background images
        useCanvasEvents.ts          # Routes Fabric mouse/object events by current mode
        useKeyboardShortcuts.ts     # Global keyboard shortcuts (Delete, Escape, Ctrl+Z/Y)
        useHistory.ts               # Captures/restores HistoryManager snapshots

      utils/
        fabricHelpers.ts            # Typed accessors (getFabricProp, setFabricProps) and
                                    #   factory functions for Fabric objects
        geometry.ts                 # Pure math: distance, snap45, midpoint, fitImageScale
        serialization.ts            # Serialize/deserialize PlannerObject + Fabric state
                                    #   to/from SerializedProject JSON; v2-to-v3 migration
        canvasOrchestration.ts      # Canvas-level operations: getFabricState, clearCanvas,
                                    #   reorderObjects, deleteObject, loadProjectFromData
        autoSave.ts                 # Debounced auto-save scheduling and beforeunload handler

    sidebar/
      Sidebar.tsx                   # Container with mode toggle and tabbed panels
      CalibrationPanel.tsx          # Calibration controls and meter input
      ShapePanel.tsx                # Shape name/dimensions form and color picker
      LinePanel.tsx                 # Line drawing controls and color/width picker
      ImagePanel.tsx                # Overlay image upload
      CleanupPanel.tsx              # Mask drawing and background image controls
      ObjectList.tsx                # Sortable list of placed objects with reorder controls
      StoragePanel.tsx              # Save/load/export/import and auto-save toggle

    ui/
      Toolbar.tsx                   # Mode badge, scale display, undo/redo buttons
      StatusBar.tsx                 # Single-line status message from Zustand
      button.tsx                    # Radix-styled button component
      input.tsx                     # Radix-styled input component
      tabs.tsx                      # Radix tabs (used for shapes/lines/images)
      dialog.tsx                    # Radix dialog
      label.tsx                     # Radix label
      ColorPicker.tsx               # Color swatch picker
      FileInput.tsx                 # Styled file input with label

  lib/
    types.ts                        # All TypeScript types: PlannerObject, FabricRefs,
                                    #   FabricCustomProps, SerializedProject, store slices,
                                    #   history types, calibration state
    store.ts                        # Zustand store: 4 slices + cross-slice actions + selectors
    constants.ts                    # Colors, theme, defaults, zoom limits, DB config, limits
    history.ts                      # HistoryStack (pure functions), ImagePool (IDB-backed
                                    #   deduplication with LRU cache), HistoryManager
    utils.ts                        # cn() utility for Tailwind class merging

    storage/
      storageAdapter.ts             # StorageAdapter interface, DBMigration type,
                                    #   createInMemoryAdapter() for tests
      indexeddb.ts                  # IndexedDB adapter: PlanTheSpaceDB v2, two object stores
      json-export.ts                # Download project as JSON / import and validate from file

  __tests__/
    setup.ts                        # Vitest setup (fake-indexeddb)
    store.test.ts                   # Zustand store slice tests
    serialization.test.ts           # Serialize/deserialize round-trip tests
    geometry.test.ts                # Geometry utility tests
    history.test.ts                 # HistoryStack and HistoryManager tests
    indexeddb.test.ts               # IndexedDB adapter tests (fake-indexeddb)
    canvasOrchestration.test.ts     # Canvas orchestration utility tests
    autoSave.test.ts                # Auto-save scheduling tests
    fabricHelpers.test.ts           # Fabric property accessor tests
    ErrorBoundary.test.tsx          # Error boundary render tests
    integration-workflow.test.ts    # End-to-end workflow integration tests
```

## Data Flow

A typical user action flows through four layers:

1. **UI trigger**: The user clicks a sidebar button (e.g., "Add Shape"). The `Sidebar`
   component calls a callback prop that delegates through the `canvasRef` to
   `PlannerCanvasHandle`.

2. **Hook logic**: The imperative handle method calls into the appropriate hook
   (e.g., `useShapes.addShape`). The hook creates Fabric objects on the canvas, stores
   their references in `allFabricRefsRef`, and writes metadata to the Zustand store
   via `store.addObject()`.

3. **History capture**: After the action completes, `captureSnapshot()` reads the
   current Zustand state and each object's Fabric-level properties (via `getFabricState`),
   builds a `HistorySnapshot`, and pushes it onto the `HistoryManager` stack. Image
   data is deduplicated through the `ImagePool`.

4. **Auto-save**: `triggerAutoSave()` schedules a debounced (2-second) write to
   IndexedDB. The project is serialized via `serializeProject()` and stored under a
   fixed key. A `beforeunload` handler fires a best-effort save on page close.

Canvas interactions (drag, resize, draw) follow the same tail -- Fabric fires
`mouse:down` / `mouse:move` / `mouse:up`, `useCanvasEvents` routes by mode, the
appropriate hook updates Fabric objects and the Zustand store, then
`captureSnapshot()` and `triggerAutoSave()` fire.

### Undo/Redo Restore Flow

When the user triggers undo or redo:

1. `HistoryManager.undo()` / `redo()` moves the stack pointer and returns a snapshot.
2. `restoreFromSnapshot()` clears the canvas, resolves image refs back to data URIs
   via the `ImagePool`, loads objects into the Zustand store with `loadProject()`,
   and reconstructs Fabric objects from the serialized state using per-type loaders
   (`loadShape`, `loadLine`, `loadMask`, `loadImageObject`).
3. The `isRestoringRef` flag prevents nested history captures and auto-saves during
   the restore operation.

## State Management

### Zustand Store Slices

The store (`lib/store.ts`) is composed from four slices using the Zustand slice pattern:

| Slice            | State Fields                                                                                      | Key Actions                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **CanvasSlice**  | `mode`, `pixelsPerMeter`, `backgroundImageData`, `calibrationPixelLength`, `showCalibrationInput` | `setMode`, `setPixelsPerMeter`                                              |
| **ObjectsSlice** | `objects` (`Map<number, PlannerObject>`), `objectIdCounter`                                       | `addObject`, `removeObject`, `updateObject`, `clearObjects`, `nextObjectId` |
| **UISlice**      | `selectedColor`, `selectedLineColor`, `lineWidth`, `autoSaveEnabled`, `statusMessage`             | `setSelectedColor`, `setLineWidth`, `setStatusMessage`                      |
| **HistorySlice** | `historyState` (`canUndo`, `canRedo`, `undoCount`, `redoCount`)                                   | `setHistoryState`                                                           |

Cross-slice actions: `loadProject()` bulk-loads objects plus calibration state;
`reset()` returns all slices to their initial values.

Selectors: `selectVisibleObjects` returns shapes, lines, and overlay images (excludes
masks and background images). `selectObjectById` does a Map lookup by ID.

### The FabricRefs Pattern

Fabric.js objects are mutable, non-serializable class instances that cannot live in a
Zustand store. The solution is a split-state architecture:

- **Zustand store**: Holds serializable metadata (`PlannerObject` with `id`, `name`,
  dimensions, colors). This drives the sidebar UI and serialization.

- **allFabricRefsRef**: A `React.useRef<Map<number, FabricRefs>>` inside `PlannerCanvas`
  that maps object IDs to their live Fabric.js references. Each object type has its own
  refs shape:
  - `ShapeFabricRefs`: `{ rect, label, dims }` -- the rectangle, name label, and
    dimension text
  - `LineFabricRefs`: `{ line, label }` -- the line and its meter-length label
  - `MaskFabricRefs`: `{ rect }` -- the white mask rectangle
  - `ImageFabricRefs`: `{ image }` -- a FabricImage instance

Each hook receives a typed cast of this shared map for the refs it manages
(e.g., `useShapes` receives `Map<number, ShapeFabricRefs>`).

**Key invariant**: Fabric refs are never stored in Zustand. The Zustand store holds
only serializable metadata. Mutable Fabric objects live exclusively in the
`allFabricRefsRef` Map.

## Canvas System

### Fabric.js Integration

`useFabricCanvas` creates a Fabric `Canvas` instance on mount, binds it to a
`<canvas>` element within a resizable container div, handles window resize by
updating canvas dimensions, and disposes the canvas on unmount. All other hooks
receive `fabricCanvasRef` to interact with the canvas. The canvas is initialized with
`preserveObjectStacking: true` and a dark background (`#1a1a2e`).

### Hooks Composition

`PlannerCanvas` composes 10 hooks, all sharing `fabricCanvasRef` and `allFabricRefsRef`:

```
PlannerCanvas
  ├─ useFabricCanvas      → fabricCanvasRef, canvasElRef, containerRef, initCanvas
  ├─ usePanZoom           → startPan, movePan, endPan, isPanningRef (+ mouse:wheel zoom)
  ├─ useCalibration       → startCalibration, cancelCalibration, applyCalibration,
  │                          handleCalibrationClick, updateCalibrationLine, finishCalibrationLine
  ├─ useShapes            → addShape, updateShapeLabels, updateShapeDimensions, loadShape
  ├─ useLines             → startLineDrawing, cancelLineDrawing, handleLineDrawStart,
  │                          updateDrawingLine, finishDrawingLine, updateLineLabel, loadLine
  ├─ useImages            → loadBackgroundImage, loadBackgroundFromData, addOverlayImage,
  │                          loadImageObject, backgroundRef
  ├─ useCleanup           → enterCleanupMode, exitCleanupMode, startDrawingMask,
  │                          handleMaskDrawStart, updateMaskRect, finishMaskRect,
  │                          addCleanupImage, loadMask
  ├─ useCanvasEvents      → binds Fabric mouse/object events, routes by PlannerMode
  ├─ useKeyboardShortcuts → Delete/Backspace, Escape, Ctrl+Z, Ctrl+Shift+Z / Ctrl+Y
  └─ useHistory           → captureSnapshot, undo, redo, resetHistory, isRestoringRef
```

### Imperative Handle Pattern

`PlannerCanvas` uses `forwardRef` + `useImperativeHandle` to expose a
`PlannerCanvasHandle` interface with 25 methods. `PlannerApp` holds a `ref` to this
handle and passes callback props to the `Sidebar` that call through the ref:

```
Sidebar.onAddShape(name, w, h)
  → PlannerApp callback
    → canvasRef.current.addShape(name, w, h)
      → addShapeWithHistory(name, w, h)
        → useShapes.addShape(name, w, h)
        → captureSnapshot()
        → triggerAutoSave()
```

This keeps the Sidebar purely presentational -- it has no direct canvas or Fabric
dependencies. Actions that need history tracking are wrapped with
`captureSnapshot()` + `triggerAutoSave()` inside PlannerCanvas before being exposed
through the handle.

## History System

### HistoryManager

`HistoryManager` (in `lib/history.ts`) composes two subsystems:

**HistoryStack** -- An immutable data structure manipulated by pure functions:

- `pushSnapshot(stack, snapshot)` -- Appends a snapshot, truncates the redo branch,
  enforces `HISTORY_LIMIT` (50) by evicting the oldest entries. Returns the new stack
  plus arrays of discarded and evicted snapshots.
- `undoStack(stack)` / `redoStack(stack)` -- Moves the pointer back/forward by one,
  returns the new stack and the target snapshot (or null if at boundary).
- `getStackState(stack)` -- Derives `canUndo`, `canRedo`, `undoCount`, `redoCount`.
- `getCurrentSnapshot(stack)` -- Returns the snapshot at the current pointer.

**ImagePool** -- Manages image deduplication for history snapshots:

- Large image data URIs are stored in IndexedDB under a fingerprint-based ref key
  computed as `img_{length}_{first64chars}_{last64chars}`.
- The pool maintains in-memory reference counts. `registerImage()` increments the
  count (stores to IDB on first registration). `releaseImage()` decrements the count
  and deletes from IDB when it reaches zero.
- An LRU in-memory cache (`IMAGE_LRU_SIZE` = 3 entries) provides fast resolution
  without IDB reads for recently accessed images.

### Snapshot Structure

Each `HistorySnapshot` contains:

- `storeSnapshot`: Zustand state clone -- `pixelsPerMeter`, `backgroundImageRef`
  (image pool ref, not raw data), `objects` (deep-cloned PlannerObjects with image
  data replaced by refs), `objectIdCounter`.
- `fabricSnapshots[]`: Per-object Fabric state -- `id`, `type`, and a
  `fabricState` record with position, scale, angle, dimensions, and type-specific
  properties (line coordinates, stroke width, image origin, etc.).
- `timestamp`: Millisecond timestamp of capture.

### Snapshot Lifecycle

```
captureSnapshot()
  1. Read Zustand store state (objects, pixelsPerMeter, backgroundImageData)
  2. For background image, register in ImagePool → get backgroundImageRef
  3. For each image object, compute ref and register in ImagePool (fire-and-forget)
  4. Clone objects with imageData replaced by imageDataRef
  5. Read Fabric-level properties for each object via getFabricState()
  6. Build HistorySnapshot { storeSnapshot, fabricSnapshots, timestamp }
  7. Push onto HistoryStack
  8. Release images from any discarded (redo branch) or evicted (over limit) snapshots
  9. Sync HistoryState to Zustand store (updates toolbar undo/redo button state)
```

## Persistence

### IndexedDB Storage

The app uses IndexedDB (`PlanTheSpaceDB`, version 2) with two object stores:

| Store        | Purpose                              | Key Strategy                        |
| ------------ | ------------------------------------ | ----------------------------------- |
| `projects`   | Serialized project data              | Fixed key: `plan-the-space-project` |
| `image-pool` | Deduplicated image blobs for history | Fingerprint ref key from ImagePool  |

The `StorageAdapter` interface (`lib/storage/storageAdapter.ts`) abstracts persistence
with methods for project CRUD and image pool operations. Two implementations exist:

- `createIndexedDBAdapter()` -- Production adapter using real IndexedDB.
- `createInMemoryAdapter()` -- Test/SSR adapter using plain Maps.

The IndexedDB module exports backward-compatible function wrappers (`saveProject`,
`loadProject`, `clearProject`, etc.) that delegate to a lazily-created default adapter.

### Auto-Save

Auto-save is always enabled by default (`autoSaveEnabled: true`). On any state-mutating
action (object add/modify/delete, calibration, line drawing), `triggerAutoSave()` calls
`scheduleAutoSave()` which:

1. Checks that auto-save is enabled and no restore is in progress.
2. Clears any previously scheduled timer.
3. Sets a new timer for `AUTOSAVE_DEBOUNCE_MS` (2000ms).
4. When the timer fires, serializes the project and writes to IndexedDB.

A `beforeunload` handler fires a best-effort fire-and-forget save on page close.

### JSON Export/Import

- **Export**: `downloadProjectAsJson()` serializes the full project (including embedded
  base64 image data URIs), creates a Blob, and triggers a file download named
  `plan-the-space-YYYY-MM-DD.json`.
- **Import**: `importProjectFromFile()` reads a JSON file, validates the structure with
  `validateProjectData()`, migrates to v3 format if needed with `migrateProject()`,
  and returns the project data for loading.

### Serialization Format (v3)

```
SerializedProjectV3 {
  version: 3
  pixelsPerMeter: number | null
  backgroundImage: string | null          // base64 data URI
  savedAt: string                         // ISO 8601 timestamp
  objects: SerializedObject[]             // shapes, lines, masks, images
  metadata?: {                            // added in v3
    appVersion?: string
    exportedFrom?: string
  }
}
```

Each `SerializedObject` merges PlannerObject metadata with Fabric-level positional
properties (left, top, scaleX, scaleY, angle) plus type-specific fields:

- **Shape**: `widthM`, `heightM`, `color`, `baseWidthPx`, `baseHeightPx`, `width`, `height`
- **Line**: `x1`, `y1`, `x2`, `y2`, `lengthM`, `color`, `strokeWidth`
- **Mask**: `width`, `height` (pre-multiplied by scale)
- **Image**: `imageData` (base64), `originX`, `originY`

The format is backward-compatible with v2. `migrateProject()` adds the `metadata`
field and bumps the version number when loading older files.

## Mode System

The app operates in one of five modes, stored as `PlannerMode` in the Zustand store:

| Mode           | Purpose                               | Cursor      | Canvas Selection     |
| -------------- | ------------------------------------- | ----------- | -------------------- |
| `normal`       | Default: select, move, resize objects | `default`   | Enabled              |
| `calibrating`  | Drawing a calibration reference line  | `crosshair` | Disabled             |
| `drawing-line` | Drawing a measurement line            | `crosshair` | Disabled             |
| `drawing-mask` | Drawing a white mask rectangle        | `crosshair` | Disabled             |
| `cleanup`      | Manage masks and background images    | `default`   | Enabled (masks only) |

`useCanvasEvents` routes all Fabric mouse events through a switch on the current mode,
delegating to the appropriate hook handler. Object events (`object:modified`,
`object:scaling`, `object:moving`, `object:rotating`) always fire regardless of mode to
keep labels positioned and dimensions updated.

### Mode Transitions

```
normal ──startCalibration()──────▶ calibrating ──applyCalibration()──▶ normal
       ──startLineDrawing()──────▶ drawing-line ──finishDrawingLine()──▶ drawing-line
       │                                          (stays for continuous drawing)
       │                          ──cancelLineDrawing()──▶ normal
       ──enterCleanupMode()──────▶ cleanup ──startDrawingMask()──▶ drawing-mask
                                  │                                 ──finishMaskRect()──▶ cleanup
                                  ──exitCleanupMode()──▶ normal

Escape cancels the current mode-specific operation:
  calibrating  → normal
  drawing-line → normal
  drawing-mask → cleanup
```

When entering `calibrating` or `drawing-line` mode, all existing objects are made
non-selectable. When entering `cleanup` mode, normal objects are hidden and masks
become selectable. Exiting these modes restores the default visibility and
selectability.

## Key Patterns

### Typed Fabric Property Accessors

Fabric objects carry custom properties (`objectId`, `objectType`, `parentId`,
`baseWidthPx`, `shapeName`, `lineColor`, `imageData`, etc.) defined by
`FabricCustomProps` in `types.ts`. Two helper functions in `fabricHelpers.ts`
centralize the unsafe cast:

- `getFabricProp(obj, key)` -- reads a typed custom property from a Fabric object
- `setFabricProps(obj, props)` -- writes one or more custom properties via `Object.assign`

This keeps `as unknown as Record<string, unknown>` out of business logic.

### Factory Functions

All Fabric object creation goes through factory functions in `fabricHelpers.ts`:
`createShapeRect`, `createShapeLabel`, `createShapeDims`, `createCalibrationLine`,
`createCalibrationEndpoint`, `createDrawingLine`, `createLineLabel`, `createMaskRect`.
These use `as any` for custom Fabric properties intentionally, keeping the unsafe cast
isolated to a single file.

### Object Identity

Every tracked object has a numeric `id` generated by `store.nextObjectId()` (an
auto-incrementing counter). This ID appears in three places:

1. The Zustand `objects` Map key
2. The `allFabricRefsRef` Map key
3. The `objectId` custom property on the primary Fabric object

Child Fabric objects (labels, dimension text) carry a `parentId` custom property
linking back to their parent. This allows `useCanvasEvents` to look up related objects
when handling events on child elements.

### Canvas Orchestration Utilities

Complex multi-step canvas operations are extracted into `canvasOrchestration.ts`:

- `getFabricState(id, refsMap)` -- Reads Fabric-level properties from the refs map
  for a given object ID. Returns position, scale, angle, and type-specific fields.
- `clearCanvas(canvas, refsMap, backgroundRef)` -- Removes all tracked objects,
  clears the refs map, removes the background image, and clears the Zustand store.
- `reorderObjects(canvas, refsMap, backgroundRef)` -- Ensures z-order: background
  image at bottom, then masks, then background images, then everything else.
- `deleteObject(id, canvas, refsMap)` -- Removes a single object and all its child
  Fabric objects (labels, dims) from the canvas and the store.
- `loadProjectFromData(objects, canvas, refsMap, backgroundRef, hooks)` -- Iterates
  serialized objects, delegates to per-type loaders, then reorders and renders.

### Error Boundary

An `ErrorBoundary` class component wraps the entire `PlannerApp`. On an uncaught
rendering error, it displays the error message and a "Reload from last save" button.
Since auto-save continuously persists state to IndexedDB, users can typically recover
their work by reloading.

### Module Dependency Graph

```
lib/types.ts  <──────── lib/store.ts
    ^    ^                   ^
    |    |                   |
    |    |    lib/history.ts (HistoryManager, ImagePool, pure stack fns)
    |    |         ^
    |    |         |
    |    |    lib/storage/indexeddb.ts  <── lib/storage/json-export.ts
    |    |         ^                        ^
    |    |         |                        |
    |    +----+----+─────── canvas/utils/serialization.ts
    |         |
    |    canvas/utils/canvasOrchestration.ts
    |    canvas/utils/autoSave.ts
    |    canvas/utils/fabricHelpers.ts
    |    canvas/utils/geometry.ts
    |         ^
    |         | (all consumed by)
    |         |
    |    canvas/hooks/*  (10 hooks)
    |         ^
    |         |
    |    canvas/PlannerCanvas.tsx
    |         ^
    |         |
    |    PlannerApp.tsx  ────────▶  sidebar/Sidebar.tsx
    |                                   |
    |                                   ├──▶ sidebar/{Calibration,Shape,Line,Image,Cleanup,Storage}Panel.tsx
    |                                   └──▶ sidebar/ObjectList.tsx
    |
    └─── lib/constants.ts  (colors, theme, defaults, DB config, limits)
```

Arrows point from consumer to dependency (A ──> B means A imports B).

### Safe Parallel Modification Guidelines

- **Sidebar panels** are independent of each other and of canvas hooks.
- **Canvas hooks** can be modified independently as long as `fabricCanvasRef`,
  `allFabricRefsRef`, and their TypeScript interfaces remain stable.
- **Canvas utils** are stateless helpers; safe to modify if call signatures are preserved.
- **lib/history.ts** is self-contained; the pure stack functions have no side effects.
- **lib/store.ts** and **lib/types.ts** are high-fan-out; changes propagate widely
  and should be coordinated carefully.
