# Multi-Project Support — Design Document

## Overview

Introduce multi-project support to Plan the Space, allowing users to manage 5-20+ independent projects within a single browser. Each project represents either a distinct physical space (backyard, office, kitchen) or a design iteration of the same space. All data remains local-first (IndexedDB), with the data model architected for future cloud sync.

---

## Goals

1. Users can create, open, duplicate, and soft-delete projects
2. A visual project picker (card grid with thumbnails) is the app entry point
3. Switching projects is seamless — auto-save ensures no data loss
4. New project creation follows a guided wizard (name → image → calibrate)
5. Existing single-project users are silently migrated
6. The data model supports future tags, version linking, and cloud sync without schema rewrites

## Non-Goals (Phase 1)

- Persistent undo/redo history per project (deferred to phase 2)
- Bulk export/import of all projects
- Tags, folders, or project grouping
- Cloud sync or multi-device support
- Linked project versions (e.g., "Garden v1" ↔ "Garden v2")

---

## User Flows

### 1. First Launch (New User)

```
App opens → Project Picker (empty state)
  → "Create Your First Project" CTA
  → New Project Wizard
    Step 1: Name (required) + optional description
    Step 2: Upload floor plan image [Skip]
    Step 3: Calibrate scale [Skip — only if image uploaded]
  → Canvas opens with new project
```

### 2. First Launch (Existing User — Migration)

```
App opens → Detects existing single-project data in IndexedDB
  → Auto-migrates to multi-project store:
    - Existing project becomes first project
    - Name: "My Project" (or extracted from metadata if available)
    - Created/modified timestamps from savedAt field
    - Thumbnail generated on first view
  → Project Picker shows the migrated project
```

### 3. Returning User

```
App opens → Project Picker (card grid)
  → User clicks a project card
  → Auto-loads project into canvas
  → Full sidebar + toolbar + canvas experience
```

### 4. Switching Projects

```
User is in canvas → clicks project name / home button in toolbar
  → Current project auto-saved (debounced save fires immediately)
  → History stack cleared (in-memory only, phase 1)
  → Canvas cleared
  → Project Picker displayed
  → User selects another project
  → New project loaded into canvas
```

### 5. Creating a New Project (From Picker)

```
Project Picker → "New Project" button
  → Wizard dialog:
    Step 1: Name (required), Description (optional)
    Step 2: Upload floor plan [Skip button]
    Step 3: Set scale / calibrate [Skip button, only if image uploaded]
  → Project created in IndexedDB
  → Canvas opens
```

### 6. Duplicating a Project

```
Project Picker → Project card "..." menu → Duplicate
  → New project created with:
    - Name: "{Original Name} (Copy)"
    - Full deep copy of all canvas data (objects, images, calibration)
    - Fresh ID, new timestamps
    - Independent image pool entries (refcounted copies)
  → Project Picker refreshes, showing the duplicate
```

### 7. Deleting a Project (Soft Delete)

```
Project Picker → Project card "..." menu → Delete
  → Confirmation dialog: "Move '{name}' to trash?"
  → Project marked as deleted (soft delete), hidden from main grid
  → "Trash" section accessible from picker (collapsed by default)
  → Trash items show "Restore" and "Delete Forever" actions
  → Permanent deletion cleans up all associated images from pool
```

---

## Project Picker UI

### Layout

Card grid (responsive columns) with each card showing:

- **Canvas thumbnail** (auto-generated, cached)
- **Project name** (truncated if long)
- **Last modified** (relative time: "2 hours ago", "3 days ago")
- **"..." menu** (Duplicate, Delete, Rename)

### Empty State

When no projects exist:

- Centered illustration/icon
- "No projects yet" heading
- "Create Your First Project" primary button
- "Import from JSON" secondary link

### Sorting

Projects sorted by **last modified** (most recent first). No manual sort controls in phase 1.

### Trash Section

Collapsed section at the bottom of the picker:

- "Trash (N)" header — expands on click
- Trashed project cards shown in muted/grayed style
- Each card: "Restore" button, "Delete Forever" button
- No auto-purge in phase 1 (manual permanent delete only)

---

## New Project Wizard

A multi-step dialog (modal) with progress indicators:

### Step 1: Project Info (Required)

- **Name** text input (required, placeholder: "e.g., Backyard Redesign")
- **Description** textarea (optional, placeholder: "Notes about this space...")
- [Next] button (disabled until name entered)

### Step 2: Upload Floor Plan (Skippable)

- Drag-and-drop zone or file picker for image
- Preview of uploaded image
- [Skip] link / [Next] button
- Help text: "Upload a photo, screenshot, or blueprint of your space"

### Step 3: Set Scale (Skippable, conditional)

- Only shown if an image was uploaded in Step 2
- Inline calibration mini-flow (draw line + enter meters)
- [Skip — I'll calibrate later] link / [Done] button

All skipped steps remain accessible from the sidebar once the project is open (existing Step 1/Step 2 sidebar sections).

---

## Data Model

### Project Record

```typescript
interface ProjectRecord {
  // Identity
  id: string; // UUID v4
  name: string; // User-defined name
  description: string; // Optional description (empty string default)

  // Timestamps
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601 (updated on every save)

  // Display
  thumbnailDataUrl: string | null; // Canvas screenshot (PNG data URL, ~50-100KB)

  // Soft delete
  deletedAt: string | null; // ISO 8601 if trashed, null if active

  // Canvas data (the existing SerializedProject, embedded)
  projectData: SerializedProject;

  // Future extensibility
  tags?: string[]; // Reserved for future tag support
  parentId?: string; // Reserved for future version linking
  metadata?: Record<string, unknown>; // Open-ended extension point
}
```

### Why Embed `SerializedProject` Inside `ProjectRecord`?

The existing `SerializedProject` format (v3) contains the canvas state: pixelsPerMeter, backgroundImage, objects array. Rather than flattening these fields into `ProjectRecord`, we keep `SerializedProject` as a nested field (`projectData`). This:

1. Preserves backward compatibility with JSON export/import (export `projectData` directly)
2. Keeps the serialization/deserialization code unchanged
3. Makes the boundary clear: `ProjectRecord` = project metadata + `SerializedProject` = canvas state

### Image Pool

The existing `image-pool` IndexedDB store continues to work as-is. Images are keyed by content hash, so identical images across projects are naturally deduplicated. The reference counting in `ImagePool` needs no changes for phase 1 (in-memory history only — images are only ref-counted within a session).

**Phase 2 consideration:** When persistent history is added, the image pool will need project-scoped reference counting to properly clean up images when a project (and its history) is deleted.

---

## IndexedDB Schema Changes

### Current Schema (v2)

```
PlanTheSpaceDB v2
├── projects (keyPath: "id")     → single project with key "plan-the-space-project"
└── image-pool                   → content-hash keyed image blobs
```

### New Schema (v3)

```
PlanTheSpaceDB v3
├── projects (keyPath: "id")     → multiple ProjectRecord entries, keyed by UUID
├── app-state (keyPath: "key")   → app-level state (last opened project ID, preferences)
└── image-pool                   → unchanged, content-hash keyed image blobs
```

### Migration (v2 → v3)

Runs during `onupgradeneeded`:

1. Read the existing project from `projects` store (key: `"plan-the-space-project"`)
2. If found:
   - Generate a UUID for it
   - Wrap in `ProjectRecord` with:
     - `name`: "My Project" (or parse from metadata if available)
     - `description`: ""
     - `createdAt`: existing `savedAt` timestamp
     - `updatedAt`: existing `savedAt` timestamp
     - `thumbnailDataUrl`: null (generated on first picker view)
     - `deletedAt`: null
     - `projectData`: the existing `SerializedProject` data
   - Write the new `ProjectRecord` to the store
   - Delete the old `"plan-the-space-project"` key
3. Create the `app-state` store
4. Set `lastOpenedProjectId` to the migrated project's UUID

### App State Store

```typescript
interface AppState {
  key: "app-state"; // Single record
  lastOpenedProjectId: string | null;
  // Future: theme preference, default units, etc.
}
```

---

## Routing Strategy

### Recommendation: Single Page, State-Driven

Given the app is already fully client-side (SSR disabled, dynamic import), URL-based routing adds complexity without proportional benefit:

- The entire app is one `<canvas>` + sidebar — there's no meaningful "page" distinction
- Deep linking to a project by ID would require loading the project picker first anyway (no SSR)
- Browser back/forward within a canvas app is confusing (users expect canvas undo, not page navigation)

**Approach:**

- Single `/` route (unchanged)
- App-level state determines view: `"picker" | "canvas"`
- A new Zustand slice (`ProjectSlice`) manages the active project ID and view state
- The "home" / project-name button in the toolbar returns to the picker view
- Browser refresh → loads picker → auto-opens last project (via `app-state` store)

**Future cloud consideration:** If routes are needed later (e.g., shareable URLs), they can be added as a thin layer on top without restructuring the state management.

---

## Zustand Store Changes

### New Slice: `ProjectSlice`

```typescript
interface ProjectSliceState {
  activeView: "picker" | "canvas" | "wizard";
  activeProjectId: string | null;
  projects: ProjectRecord[]; // All non-deleted projects (loaded from IDB on init)
}

interface ProjectSliceActions {
  setActiveView: (view: "picker" | "canvas" | "wizard") => void;
  setActiveProjectId: (id: string | null) => void;
  setProjects: (projects: ProjectRecord[]) => void;
  addProject: (project: ProjectRecord) => void;
  updateProjectMeta: (id: string, updates: Partial<ProjectRecord>) => void;
  softDeleteProject: (id: string) => void;
  restoreProject: (id: string) => void;
  permanentlyDeleteProject: (id: string) => void;
}
```

### Modified Store Composition

```typescript
PlannerStore =
  CanvasSlice & ObjectsSlice & UISlice & HistorySlice & ProjectSlice;
```

### Cross-Slice Actions (Updated)

- **`loadProject(id)`**: Load a project from IDB → populate canvas/objects slices → set `activeProjectId` → switch to `"canvas"` view
- **`saveCurrentProject()`**: Serialize canvas state → update `ProjectRecord.projectData` → write to IDB → update `updatedAt`
- **`createProject(name, description)`**: Generate UUID → create `ProjectRecord` → write to IDB → add to `projects` list
- **`reset()`**: Clears canvas state (unchanged), does NOT clear project list

---

## Component Changes

### New Components

| Component              | Purpose                                               |
| ---------------------- | ----------------------------------------------------- |
| `ProjectPicker.tsx`    | Card grid of projects, empty state, trash section     |
| `ProjectCard.tsx`      | Individual project card (thumbnail, name, date, menu) |
| `NewProjectWizard.tsx` | Multi-step dialog for project creation                |
| `ProjectMenu.tsx`      | "..." dropdown (Rename, Duplicate, Delete)            |

### Modified Components

| Component          | Changes                                                                                |
| ------------------ | -------------------------------------------------------------------------------------- |
| `PlannerApp.tsx`   | Conditionally render ProjectPicker vs. canvas based on `activeView`                    |
| `Toolbar.tsx`      | Add project name + home button on the left                                             |
| `Sidebar.tsx`      | No changes (panels already scoped to active project)                                   |
| `StoragePanel.tsx` | Remove "Clear Storage" (replaced by project delete). Export/Import remain per-project. |
| `ClientLoader.tsx` | No changes (still wraps everything with SSR disabled)                                  |

### View Flow

```
PlannerApp
  ├── activeView === "picker"  → <ProjectPicker />
  ├── activeView === "wizard"  → <NewProjectWizard />
  └── activeView === "canvas"  → <Toolbar /> + <Sidebar /> + <PlannerCanvas /> + <StatusBar />
```

---

## Thumbnail Generation

### Strategy: On-Demand + Cache on Close

- **On project close** (switching away or closing tab): Capture a canvas screenshot via `fabricCanvas.toDataURL({ format: 'png', quality: 0.7, multiplier: 0.25 })` and save to `ProjectRecord.thumbnailDataUrl`
- **On picker display**: If `thumbnailDataUrl` is null (e.g., migrated project, never opened), show a placeholder icon
- **Size budget**: ~50-100KB per thumbnail at 0.25x scale with 0.7 quality

### Placeholder

When no thumbnail exists:

- Show the project's dominant color (first shape color, or default theme color)
- Overlay with a generic canvas/blueprint icon
- Text: "No preview"

---

## Storage Adapter Changes

### New Methods on `StorageAdapter`

```typescript
interface StorageAdapter {
  // Existing
  save(project: SerializedProject): Promise<void>;
  load(): Promise<SerializedProject | null>;
  clear(): Promise<void>;
  saveImage(ref: string, data: string): Promise<void>;
  loadImage(ref: string): Promise<string | null>;
  deleteImage(ref: string): Promise<void>;
  clearImages(): Promise<void>;

  // New for multi-project
  saveProjectRecord(record: ProjectRecord): Promise<void>;
  loadProjectRecord(id: string): Promise<ProjectRecord | null>;
  loadAllProjectRecords(): Promise<ProjectRecord[]>;
  deleteProjectRecord(id: string): Promise<void>;
  saveAppState(state: AppState): Promise<void>;
  loadAppState(): Promise<AppState | null>;
}
```

The existing `save()`/`load()`/`clear()` methods are deprecated but kept for backward compatibility during migration.

---

## Auto-Save Changes

### Current Behavior

- Debounced 2s, writes to IDB with fixed key `"plan-the-space-project"`

### New Behavior

- Debounced 2s, writes to `ProjectRecord` keyed by active project UUID
- `saveCurrentProject()` updates both `projectData` and `updatedAt` timestamp
- `beforeunload` handler saves to the active project's record
- No auto-save when on the picker view (no active project)

---

## JSON Export/Import Changes

### Export

- Exports `projectData` (the `SerializedProject` portion) — same format as today
- Filename: `{project-name}-YYYY-MM-DD.json` (slugified project name)

### Import

- Creates a new project with the imported data
- Name extracted from filename or metadata, with "(Imported)" suffix
- Opens the imported project in the canvas

### Backward Compatibility

- Existing exported JSON files (v2/v3 `SerializedProject`) import correctly
- The `migrateProject()` function handles v2→v3 upgrade as before

---

## Migration & Compatibility

### IndexedDB Migration Path

```
DB v2 (single project)
  ↓ onupgradeneeded (v2 → v3)
DB v3 (multi-project)
  - Existing project wrapped in ProjectRecord
  - app-state store created
  - Old key deleted
```

### First-Time Experience After Upgrade

1. User opens the app
2. IndexedDB upgrade runs silently
3. Project Picker loads, showing "My Project" card
4. User clicks it → canvas loads with all their existing work preserved
5. No data loss, no user action required

### JSON Export Compatibility

- Old exports (v2/v3 `SerializedProject`) still importable
- New exports are identical format (just `projectData` extracted from `ProjectRecord`)
- No breaking changes to the export format

---

## Phasing

### Phase 1: Multi-Project Foundation (This Document)

- Project picker (card grid, empty state)
- New project wizard (name → image → calibrate, skippable steps)
- Project CRUD (create, open, rename, duplicate, soft-delete, restore, permanent delete)
- IndexedDB v3 schema + migration
- Auto-save scoped to active project
- Thumbnail capture + display
- Toolbar project name + home button
- In-memory undo/redo per session (current behavior)

### Phase 2: Persistent History

- Save/restore undo/redo stack per project in IndexedDB
- Project-scoped image pool reference counting
- History survives project switch and browser close

### Phase 3: Organization & Polish

- Tags / labels for projects
- Search / filter in project picker
- Sort options (name, date, size)
- Bulk export/import
- Project templates (pre-configured spaces)

### Phase 4: Cloud Sync (Future)

- User accounts / auth
- Cloud storage backend
- Sync protocol (conflict resolution)
- Shareable project URLs
- Real-time collaboration (stretch)

---

## Open Questions (Resolved)

| Question                 | Decision                                         |
| ------------------------ | ------------------------------------------------ |
| Entry point on app open? | Project picker                                   |
| Auto-save on switch?     | Yes, always                                      |
| History persistence?     | Deferred to phase 2 (in-memory only for phase 1) |
| Project organization?    | Flat list for phase 1, tags in phase 3           |
| Version linking?         | Independent projects, no formal linking          |
| Migration strategy?      | Silent auto-migration                            |
| Export/import scope?     | Single project at a time                         |
| Routing approach?        | Single page, state-driven (no URL routes)        |
| Wizard flexibility?      | Guided but skippable steps                       |
| Thumbnail timing?        | On-demand + cached on project close              |
| Card content?            | Name + last modified (minimal)                   |
| Deletion model?          | Soft delete with trash section                   |

---

## Testing Strategy

### New Test Coverage Needed

- **ProjectRecord CRUD**: Create, read, update, soft-delete, restore, permanent delete
- **IDB v2→v3 migration**: Verify existing project is wrapped correctly
- **Project switching**: Auto-save fires, canvas clears, new project loads
- **Duplication**: Deep copy of all data, independent from original
- **Wizard flow**: Name validation, image upload, calibration, skip behavior
- **Thumbnail generation**: Canvas snapshot capture and storage
- **Import into multi-project**: Existing JSON files create new projects
- **Empty state**: No projects, first-time user experience
- **Trash lifecycle**: Delete → trash → restore or permanent delete

### Existing Tests (No Changes Expected)

- Store slices (canvas, objects, UI, history)
- Serialization/deserialization (operates on `SerializedProject`, unchanged)
- History/undo-redo (in-memory, unchanged)
- Geometry utilities
- Fabric helpers and canvas orchestration
