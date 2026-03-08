# Shape Import Feature Plan

## Goal

Import shape-only bundles into an existing project while preserving real-world dimensions and layer ordering fidelity.

## Source Format

Use a dedicated shape bundle format (`plan-the-space-shapes` v1), independent from full project export/import.

Required top-level fields:

- `format`: `"plan-the-space-shapes"`
- `version`: `1`
- `source.pixelsPerMeter`: `number | null`
- `units.distance`: `"meters"`
- `shapes`: array of shape records

Required per-shape fields:

- `name`: string
- `widthM`, `heightM`: number (meters)
- `color`: rgba string

Preferred per-shape fields (for higher fidelity):

- `worldX`, `worldY`: center in world meters
- `angle`: degrees
- `layer.zIndex`: integer
- `fabric.*`: optional fallback coordinates/scales

## Import Behavior

1. Parse and validate shape bundle schema.
2. Reject invalid/unsafe records:
   - non-positive dimensions
   - NaN/Infinity
   - unsupported color strings
3. Normalize each shape:
   - clamp dimensions to app-safe bounds
   - default name/color/angle if missing
4. Placement strategy:
   - If `worldX/worldY` + camera + `pixelsPerMeter` available: place by world coords.
   - Else if only meter dimensions available: place near viewport center with deterministic stagger.
5. Scale consistency:
   - If project has no scale set and bundle has `source.pixelsPerMeter`, prompt to adopt it.
   - If scale mismatch exists, keep dimensions in meters and convert to pixels using current project scale.
6. Layering:
   - Insert shapes into content layer using `layer.zIndex` when present.
   - Reindex layer entries to avoid collisions/holes.
7. History/autosave:
   - Import as a single undoable operation (one snapshot).

## UX Plan

Add to Sidebar > Actions or Storage:

- `Import Shapes` button with `.json` file picker.
- Preview dialog:
  - shape count
  - scale compatibility note
  - placement mode summary
- Confirm/cancel actions.

Failure states:

- malformed JSON
- unsupported format/version
- zero valid shapes after validation

## Implementation Plan

1. Add shape-bundle types to `src/lib/types.ts`.
2. Add parser/validator in `src/lib/storage/json-export.ts` or new `shape-import.ts`.
3. Add canvas method on `PlannerCanvasHandle`:
   - `importShapesFromJson(file: File): Promise<void>`
4. Add importer logic in `PlannerCanvas.tsx`:
   - parse + validate + normalize
   - create shapes through `useShapes.addShape`-compatible path
   - apply layer order
   - capture snapshot + autosave
5. Add sidebar UI wiring in `SidebarContext` + `StoragePanel` (or Actions section).
6. Add tests:
   - unit: schema validation + normalization
   - integration: import with/without world coords
   - e2e: import shape bundle and verify dimensions/order in canvas + object list

## Data File Produced

Extracted bundle from the legacy export:

- `/Users/willberger/plan-the-space/migrations/plan-the-space-2026-02-01-shapes-v1.json`

Contains 14 shapes with meter dimensions and world coordinates for fidelity-preserving import.
