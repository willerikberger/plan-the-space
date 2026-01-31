# CLAUDE.md

Plan the Space -- a canvas-based tool for designing spaces to scale. Built with Next.js 16 App Router, Fabric.js for the HTML5 canvas, and Zustand for state.

## Commands

```bash
npm run dev          # Next.js dev server (port 4000)
npm run build        # Production build
npm run lint         # ESLint
npm test             # Run tests (vitest 4, happy-dom, fake-indexeddb)
npm run test:coverage # Tests with coverage report
npm run typecheck    # Type-check (tsc --noEmit)
npm run validate     # lint + typecheck + test (all three)
```

Pre-commit hooks (husky + lint-staged) auto-run ESLint and Prettier on staged `.ts`/`.tsx` files.

## Tech Stack

- Next.js 16.1.6 (App Router), React 19, TypeScript 5
- Fabric.js 6.9.1 -- HTML5 canvas library
- Zustand 5 -- state management
- Tailwind CSS 4, Radix UI primitives, Lucide icons
- Vitest 4 + happy-dom + fake-indexeddb for tests
- Husky 9, lint-staged 15, Prettier 3 -- pre-commit formatting and linting

## Architecture

- **Client-only canvas**: `PlannerApp` is loaded via `ClientLoader` with `next/dynamic` (SSR disabled).
- **Zustand store** (`lib/store.ts`): serializable metadata (`Map<number, PlannerObject>`), mode, scale, colors, status.
- **FabricRefs pattern**: mutable Fabric objects live in a `Map<number, FabricRefs>` ref (`allFabricRefsRef`) inside `PlannerCanvas`, not in Zustand.
- **Mode system**: `PlannerMode = 'normal' | 'calibrating' | 'drawing-line' | 'drawing-mask' | 'cleanup'`. `useCanvasEvents` routes mouse events by mode.
- **Imperative handle**: `PlannerCanvas` exposes `PlannerCanvasHandle` via `forwardRef` + `useImperativeHandle`. Sidebar calls canvas methods through this ref.
- **Hooks compose in PlannerCanvas**: `useFabricCanvas`, `usePanZoom`, `useCalibration`, `useShapes`, `useLines`, `useImages`, `useCleanup`, `useCanvasEvents`, `useKeyboardShortcuts`, `useHistory`. All share `allFabricRefsRef`.
- **Undo/redo**: `HistoryManager` (`lib/history.ts`) composes immutable `HistoryStack` pure functions (`pushSnapshot`, `undoStack`, `redoStack`) with an `ImagePool` class for IDB-backed image deduplication + LRU cache. 50-entry snapshot limit.
- **Auto-save**: always-on, debounced (2s) auto-save to IndexedDB with undo/redo history. `beforeunload` handler for safety.
- **Serialization**: `SerializedProject` (version 3, backward-compatible with v2) combines store metadata + extracted Fabric state + optional `metadata` field.
- **StorageAdapter**: `StorageAdapter` interface (`lib/storage/storageAdapter.ts`) abstracts IndexedDB access. `createInMemoryAdapter()` provides an in-memory implementation for tests and SSR.
- **ErrorBoundary**: React class component wrapping `PlannerApp`. Catches render errors and offers a "Reload from last save" button.

## File Structure

```
src/
  app/                          # Next.js App Router entry
  components/
    PlannerApp.tsx              # Top-level layout (sidebar + canvas)
    ClientLoader.tsx            # Dynamic import wrapper (no SSR)
    ErrorBoundary.tsx           # React error boundary with reload button
    canvas/
      PlannerCanvas.tsx         # Canvas + imperative handle
      hooks/                    # 10 hooks (useFabricCanvas, usePanZoom, useHistory, etc.)
      utils/                    # serialization, geometry, fabricHelpers, canvasOrchestration, autoSave
    sidebar/                    # Sidebar panels (calibration, shapes, lines, etc.)
    ui/                         # Reusable UI (button, input, dialog, tabs, etc.)
  lib/
    types.ts                    # All TypeScript types (incl. FabricCustomProps, slice types)
    store.ts                    # Zustand store (4 slices + cross-slice actions)
    constants.ts                # Colors, theme, defaults, DB config
    history.ts                  # HistoryStack (pure fns), ImagePool, HistoryManager
    storage/
      storageAdapter.ts         # StorageAdapter interface, DBMigration, createInMemoryAdapter
      indexeddb.ts              # IndexedDB adapter (PlanTheSpaceDB v2)
      json-export.ts            # JSON download + import
  __tests__/                    # 361 tests across 20 files
  docs/                         # Detailed architecture and subsystem docs
```

## Important Patterns

- **Typed Fabric accessors**: Custom props (`objectId`, `objectType`, `parentId`, `baseWidthPx`, etc.) are defined in the `FabricCustomProps` interface (`types.ts`) and accessed via `getFabricProp(obj, key)` / `setFabricProps(obj, props)` from `fabricHelpers.ts`. The unsafe cast is centralized there.
- **Factory functions** in `fabricHelpers.ts` use `as any` for custom Fabric props -- this is intentional and isolated to that file.
- **Zustand slice pattern**: The store is composed from 4 slices (`createCanvasSlice`, `createObjectsSlice`, `createUISlice`, `createHistorySlice`) spread into a single `create<PlannerStore>()`. Cross-slice actions (`loadProject`, `reset`) access all slices.
- **Stable handler ref**: `useKeyboardShortcuts` registers a single `keydown` listener on mount. A `handlerRef.current` is updated synchronously each render so the listener always sees the latest closure -- no listener churn.
- All canvas hooks receive `fabricCanvasRef` and a typed cast of `allFabricRefsRef`.
- Selectors: `selectVisibleObjects` (shapes, lines, overlays), `selectObjectById`.
- Path alias: `@/*` maps to `./src/*`.

## Testing

- Vitest with `happy-dom` environment, `fake-indexeddb` for IndexedDB
- **361 tests** across **20 files** in `src/__tests__/`
- Unit tests: store, serialization, geometry, history, fabricHelpers, canvasOrchestration, autoSave, indexeddb
- Component tests: CalibrationPanel, ShapePanel, LinePanel, ImagePanel, CleanupPanel, ObjectList, StoragePanel
- Integration tests: workflow (end-to-end project lifecycle)
- Error handling: ErrorBoundary, error-handling edge cases
