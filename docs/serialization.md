# Serialization

Defined in `src/components/canvas/utils/serialization.ts` and `src/lib/storage/`.

## SerializedProject Format (v3)

```typescript
{
  version: 3,                          // Format version (backward-compatible with v2)
  pixelsPerMeter: number | null,       // Scale (null if uncalibrated)
  backgroundImage: string | null,      // Base64 data URL
  savedAt: string,                     // ISO 8601 timestamp
  objects: SerializedObject[],         // All objects
  id?: string,                         // IndexedDB key (only when stored)
  metadata?: {                         // New in v3
    appVersion?: string,               // e.g. '1.0.0'
    exportedFrom?: string              // e.g. 'plan-the-space'
  }
}
```

## SerializedObject Variants

### SerializedShape

```typescript
{
  id: number, type: 'shape', name: string,
  left: number, top: number, scaleX: number, scaleY: number, angle: number,
  widthM: number,          // Real-world width in meters
  heightM: number,         // Real-world height in meters
  color: string,           // Fill color (RGBA)
  baseWidthPx: number,     // Original pixel width before scaling
  baseHeightPx: number,    // Original pixel height before scaling
  width: number,           // Current Fabric rect width
  height: number           // Current Fabric rect height
}
```

### SerializedLine

```typescript
{
  id: number, type: 'line', name: string,
  left: number, top: number, scaleX: number, scaleY: number, angle: number,
  x1: number, y1: number,  // Start point
  x2: number, y2: number,  // End point
  lengthM: number,          // Length in meters
  color: string,            // Stroke color
  strokeWidth: number       // Stroke width in pixels
}
```

### SerializedMask

```typescript
{
  id: number, type: 'mask', name: string,
  left: number, top: number, scaleX: number, scaleY: number, angle: number,
  width: number,            // Computed: fabricWidth * scaleX
  height: number            // Computed: fabricHeight * scaleY
}
```

### SerializedImage

```typescript
{
  id: number, type: 'backgroundImage' | 'overlayImage', name: string,
  left: number, top: number, scaleX: number, scaleY: number, angle: number,
  imageData: string,        // Base64 data URL
  originX: string,          // 'left' | 'center' | 'right'
  originY: string           // 'top' | 'center' | 'bottom'
}
```

## Backward Compatibility

The current format is version 3. V2 projects (from the vanilla JavaScript app) are transparently migrated on load/import via `migrateProject()`:

```typescript
function migrateProject(data: SerializedProject): SerializedProjectV3
```

- If the data is already v3 with `metadata`, it is returned as-is.
- Otherwise, `version` is set to `3` and `metadata: { exportedFrom: 'plan-the-space' }` is added.

All load paths (IndexedDB, JSON import) return v3 data after migration. Exported JSON files are always v3.

## Export Flow

```
User clicks Save or Export
  --> PlannerCanvas.save() / exportJson()
    --> usePlannerStore.getState() -- get all metadata
    --> Array.from(objects.values()) -- collect objects
    --> serializeProject(pixelsPerMeter, backgroundImageData, objects, getFabricState)
      --> For each object:
        --> getFabricState(id) -- extracts left/top/scaleX/scaleY/angle + type-specific fields
        --> serializeObject(obj, fabricState) -- merges metadata + Fabric state
      --> Returns SerializedProject { version: 3, metadata, ... }
    --> saveToIDB(data) -- IndexedDB write
       OR downloadProjectAsJson(data) -- triggers browser download
```

## Import Flow

```
User clicks Load or Import
  --> PlannerCanvas.load() / importJson(file)
    --> loadFromIDB() / importProjectFromFile(file)
    --> validateProjectData(data) -- structural validation
    --> Clear current state:
      --> Delete all Fabric objects from canvas
      --> Clear allFabricRefsRef Map
      --> clearObjects() on store
    --> deserializeProject(data)
      --> Returns { pixelsPerMeter, backgroundImageData, objects[], serializedObjects[] }
    --> setPixelsPerMeter(pixelsPerMeter)
    --> If backgroundImageData: loadBackgroundFromData(data, onComplete)
    --> loadProjectFromData(serializedObjects)
      --> For each serialized object, dispatch to hook loader:
        --> 'shape' -> shapes.loadShape(sObj)
        --> 'line' -> lines.loadLine(sObj)
        --> 'mask' -> cleanup.loadMask(sObj)
        --> 'backgroundImage'/'overlayImage' -> images.loadImageObject(sObj)
    --> reorderObjects() -- enforce z-order
    --> canvas.renderAll()
```

## Storage

### IndexedDB (`lib/storage/indexeddb.ts`)

Database: `PlanTheSpaceDB`, `DB_VERSION = 2`.

**Object stores:**

| Store | Purpose |
|---|---|
| `projects` | Saved project data (key: `'plan-the-space-project'`) |
| `image-pool` | Deduplicated image data for undo/redo history |

**Project functions:**

| Function | Description |
|---|---|
| `openDatabase()` | Opens DB v2, creates `projects` and `image-pool` stores on upgrade |
| `saveProject(data)` | Stores project with key `'plan-the-space-project'` |
| `loadProject()` | Retrieves saved project, applies `migrateProject()`, or returns `null` |
| `clearProject()` | Deletes saved project |
| `checkProjectExists()` | Returns project data or `null` (with error handling) |

**Image pool functions:**

| Function | Description |
|---|---|
| `saveImageData(ref, data)` | Stores image data in `image-pool` by fingerprint key |
| `loadImageData(ref)` | Retrieves image data by fingerprint, or `null` |
| `deleteImageData(ref)` | Removes image data by fingerprint |
| `clearImagePool()` | Clears entire `image-pool` store |

### JSON Export (`lib/storage/json-export.ts`)

| Function | Description |
|---|---|
| `downloadProjectAsJson(data)` | Triggers browser download as `plan-the-space-YYYY-MM-DD.json` |
| `importProjectFromFile(file)` | Reads JSON file, validates, returns `SerializedProject` |

### Auto-Save

- Always on (`autoSaveEnabled` defaults to `true`, no toggle in UI)
- Triggered after object create/modify/delete events
- Debounced with `AUTOSAVE_DEBOUNCE_MS` (2000ms)
- Wrapped in try/catch; sets status message on success or failure
- `beforeunload` handler warns if unsaved changes exist
- Writes to IndexedDB using the same `saveProject()` function

### History Image Pool

The undo/redo system stores image-heavy snapshots efficiently:

- **Deduplication**: each unique image is stored once in the IDB `image-pool` store, referenced by a fingerprint (`img_${length}_${first64}_${last64}`).
- **Reference counting**: `HistoryManager` tracks how many snapshots reference each image. When a snapshot is evicted (stack exceeds 50 entries) or the redo branch is truncated, images with zero references are deleted from IDB.
- **LRU cache**: the 3 most recently accessed images are kept in memory (`IMAGE_LRU_SIZE = 3`) to avoid IDB reads during rapid undo/redo.
