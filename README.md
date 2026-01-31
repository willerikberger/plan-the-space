# Outdoor Planner

Design your garden and driveway layout to scale using a canvas-based planning tool.

<!-- Screenshot placeholder: add a screenshot of the app here -->

## Features

- **Canvas drawing** -- place scaled rectangles (shapes) and distance lines on a background image
- **Calibration** -- set a real-world scale by drawing a reference line and entering its length in meters
- **Shapes** -- named rectangles with configurable dimensions (meters), colors, and labels
- **Distance lines** -- draw lines snapped to 45-degree increments with auto-calculated meter lengths
- **Cleanup mode** -- draw mask rectangles over areas, then layer additional background images for compositing
- **Undo / Redo** -- Ctrl+Z / Ctrl+Shift+Z (or Ctrl+Y) with 50-entry history stack
- **Save / Load** -- persist projects in IndexedDB with always-on auto-save
- **JSON import / export** -- download and restore projects as `.json` files (v3 format, backward-compatible with v2)
- **Pan and zoom** -- alt-drag or click empty space to pan; scroll wheel to zoom (0.1x--10x)
- **Overlay images** -- add extra images on top of the background, scaled and repositionable
- **Keyboard shortcuts** -- Delete/Backspace to remove, Escape to cancel, Ctrl+Z/Ctrl+Shift+Z for undo/redo

## Tech Stack

| Layer | Library | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.1.6 |
| UI | React | 19.2.3 |
| Canvas | Fabric.js | 6.9.1 |
| State | Zustand | 5.0.10 |
| Styling | Tailwind CSS | 4 |
| UI primitives | Radix UI | various |
| Icons | Lucide React | 0.563.0 |
| Testing | Vitest + happy-dom | 4.0.18 |
| Language | TypeScript | 5 |

## Getting Started

### Prerequisites

- Node.js 18+
- npm (or yarn/pnpm)

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Build

```bash
npm run build
npm run start
```

### Test

```bash
npx vitest        # run once
npx vitest --watch # watch mode
```

### Lint

```bash
npm run lint
```

### Type Check

```bash
npx tsc --noEmit
```

## Project Structure

```
src/
  app/                          # Next.js App Router (layout, page, error, loading)
  components/
    PlannerApp.tsx              # Top-level orchestrator
    ClientLoader.tsx            # Dynamic import (no SSR)
    canvas/
      PlannerCanvas.tsx         # Fabric.js canvas + imperative API
      hooks/                    # 10 canvas hooks
      utils/                    # Serialization, geometry, Fabric helpers
    sidebar/                    # Feature panels (calibration, shapes, lines, cleanup, storage)
    ui/                         # Shared UI components (button, input, dialog, tabs, etc.)
  lib/
    types.ts                    # All TypeScript types
    store.ts                    # Zustand store + selectors
    constants.ts                # Colors, theme, defaults
    storage/                    # IndexedDB and JSON export utilities
  __tests__/                    # Vitest test files
```

See [`docs/`](./docs/) for detailed documentation:

- [Architecture](./docs/architecture.md) -- component hierarchy, data flow, mode system
- [Canvas Hooks](./docs/canvas-hooks.md) -- all 10 hooks and the imperative handle
- [State Management](./docs/state-management.md) -- Zustand store, FabricRefs pattern
- [Serialization](./docs/serialization.md) -- project format, import/export, backward compatibility
- [Types](./docs/types.md) -- all exported TypeScript types

## Deploy

Deploy on [Vercel](https://vercel.com) or any platform that supports Next.js:

```bash
npm run build
```

## License

<!-- License placeholder -->
