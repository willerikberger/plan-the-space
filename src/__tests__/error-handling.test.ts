import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { usePlannerStore, selectObjectById } from "@/lib/store";
import {
  validateProjectData,
  deserializeProject,
  serializeProject,
  migrateProject,
} from "@/components/canvas/utils/serialization";
import { importProjectFromFile } from "@/lib/storage/json-export";
import {
  HistoryManager,
  ImagePool,
  EMPTY_STACK,
  pushSnapshot,
  undoStack,
  redoStack,
  getStackState,
  getCurrentSnapshot,
} from "@/lib/history";
import {
  saveProject,
  loadProject,
  checkProjectExists,
} from "@/lib/storage/indexeddb";
import type {
  ShapeObject,
  LineObject,
  HistorySnapshot,
  StoreSnapshot,
  FabricObjectSnapshot,
  SerializedProject,
} from "@/lib/types";

// ============================================
// Helper
// ============================================

function makeSnapshot(overrides?: {
  objects?: StoreSnapshot["objects"];
  backgroundImageRef?: string | null;
  fabricSnapshots?: FabricObjectSnapshot[];
}): HistorySnapshot {
  return {
    storeSnapshot: {
      pixelsPerMeter: 50,
      backgroundImageRef: overrides?.backgroundImageRef ?? null,
      objects: overrides?.objects ?? [],
      objectIdCounter: 0,
    },
    fabricSnapshots: overrides?.fabricSnapshots ?? [],
    timestamp: Date.now(),
  };
}

// ============================================
// Store error handling
// ============================================

describe("Store actions with invalid input", () => {
  beforeEach(() => {
    usePlannerStore.getState().reset();
  });

  it("removeObject on non-existent ID is a no-op", () => {
    const shape: ShapeObject = {
      id: 0,
      type: "shape",
      name: "Test",
      widthM: 2,
      heightM: 3,
      color: "red",
    };
    usePlannerStore.getState().addObject(shape);
    // Remove an ID that does not exist
    usePlannerStore.getState().removeObject(999);
    // The existing object should still be there
    expect(usePlannerStore.getState().objects.size).toBe(1);
    expect(usePlannerStore.getState().objects.get(0)).toEqual(shape);
  });

  it("updateObject on non-existent ID is a no-op (returns same state)", () => {
    const shape: ShapeObject = {
      id: 0,
      type: "shape",
      name: "Original",
      widthM: 2,
      heightM: 3,
      color: "red",
    };
    usePlannerStore.getState().addObject(shape);
    usePlannerStore.getState().updateObject(999, { name: "Should not exist" });
    // Original object untouched
    expect(usePlannerStore.getState().objects.get(0)?.name).toBe("Original");
    // Non-existent ID still does not exist
    expect(usePlannerStore.getState().objects.has(999)).toBe(false);
  });

  it("selectObjectById returns undefined for missing ID", () => {
    const result = selectObjectById(usePlannerStore.getState(), 42);
    expect(result).toBeUndefined();
  });

  it("loadProject with empty objects array creates empty map", () => {
    usePlannerStore.getState().loadProject({
      pixelsPerMeter: 100,
      backgroundImageData: "data:test",
      objects: [],
    });
    const state = usePlannerStore.getState();
    expect(state.objects.size).toBe(0);
    expect(state.objectIdCounter).toBe(0);
    expect(state.pixelsPerMeter).toBe(100);
  });

  it("loadProject with null pixelsPerMeter preserves null", () => {
    usePlannerStore.getState().loadProject({
      pixelsPerMeter: null,
      backgroundImageData: null,
      objects: [],
    });
    const state = usePlannerStore.getState();
    expect(state.pixelsPerMeter).toBeNull();
    expect(state.backgroundImageData).toBeNull();
  });

  it("clearObjects with empty type filter array is a no-op", () => {
    const shape: ShapeObject = {
      id: 0,
      type: "shape",
      name: "Test",
      widthM: 1,
      heightM: 1,
      color: "red",
    };
    usePlannerStore.getState().addObject(shape);
    usePlannerStore.getState().clearObjects([]);
    // Nothing should be removed because no types matched
    expect(usePlannerStore.getState().objects.size).toBe(1);
  });

  it("addObject with duplicate ID overwrites existing", () => {
    const shape1: ShapeObject = {
      id: 0,
      type: "shape",
      name: "First",
      widthM: 1,
      heightM: 1,
      color: "red",
    };
    const shape2: ShapeObject = {
      id: 0,
      type: "shape",
      name: "Second",
      widthM: 2,
      heightM: 2,
      color: "blue",
    };
    usePlannerStore.getState().addObject(shape1);
    usePlannerStore.getState().addObject(shape2);
    expect(usePlannerStore.getState().objects.size).toBe(1);
    expect(usePlannerStore.getState().objects.get(0)?.name).toBe("Second");
  });
});

// ============================================
// Serialization error handling
// ============================================

describe("validateProjectData with malformed input", () => {
  it("rejects undefined", () => {
    expect(validateProjectData(undefined)).toBe(false);
  });

  it("rejects a number", () => {
    expect(validateProjectData(42)).toBe(false);
  });

  it("rejects an array", () => {
    expect(validateProjectData([1, 2, 3])).toBe(false);
  });

  it("rejects empty object", () => {
    expect(validateProjectData({})).toBe(false);
  });

  it("rejects version as string", () => {
    expect(
      validateProjectData({ version: "2", objects: [], pixelsPerMeter: null }),
    ).toBe(false);
  });

  it("rejects objects as string", () => {
    expect(
      validateProjectData({
        version: 2,
        objects: "not-an-array",
        pixelsPerMeter: null,
      }),
    ).toBe(false);
  });

  it("rejects pixelsPerMeter as string", () => {
    expect(
      validateProjectData({
        version: 2,
        objects: [],
        pixelsPerMeter: "fifty",
      }),
    ).toBe(false);
  });

  it("accepts zero for pixelsPerMeter", () => {
    expect(
      validateProjectData({
        version: 2,
        objects: [],
        pixelsPerMeter: 0,
        backgroundImage: null,
        savedAt: "2024-01-01",
      }),
    ).toBe(true);
  });
});

describe("deserializeProject with edge cases", () => {
  it("skips objects with unknown type gracefully", () => {
    const project: SerializedProject = {
      version: 3,
      pixelsPerMeter: 50,
      backgroundImage: null,
      savedAt: "2024-01-01",
      objects: [
        {
          id: 0,
          type: "shape",
          name: "Valid Shape",
          left: 0,
          top: 0,
          scaleX: 1,
          scaleY: 1,
          angle: 0,
          widthM: 2,
          heightM: 3,
          color: "red",
          baseWidthPx: 100,
          baseHeightPx: 150,
          width: 100,
          height: 150,
        },
        // An object with an unknown type - the switch will skip it
        {
          id: 1,
          type: "unknownType" as never,
          name: "Unknown",
          left: 0,
          top: 0,
          scaleX: 1,
          scaleY: 1,
          angle: 0,
        } as never,
      ],
    };
    const result = deserializeProject(project);
    // Only the valid shape should be deserialized
    expect(result.objects).toHaveLength(1);
    expect(result.objects[0].type).toBe("shape");
    // Raw serialized objects still includes both
    expect(result.serializedObjects).toHaveLength(2);
  });

  it("handles project with null backgroundImage", () => {
    const project: SerializedProject = {
      version: 2,
      pixelsPerMeter: null,
      backgroundImage: null,
      savedAt: "2024-01-01",
      objects: [],
    };
    const result = deserializeProject(project);
    expect(result.backgroundImageData).toBeNull();
    expect(result.pixelsPerMeter).toBeNull();
    expect(result.objects).toHaveLength(0);
  });

  it("preserves all object types in a mixed project", () => {
    const project: SerializedProject = {
      version: 3,
      pixelsPerMeter: 50,
      backgroundImage: "data:test",
      savedAt: "2024-01-01",
      objects: [
        {
          id: 0,
          type: "shape",
          name: "Shape",
          left: 0,
          top: 0,
          scaleX: 1,
          scaleY: 1,
          angle: 0,
          widthM: 2,
          heightM: 3,
          color: "red",
          baseWidthPx: 100,
          baseHeightPx: 150,
          width: 100,
          height: 150,
        },
        {
          id: 1,
          type: "line",
          name: "Line",
          left: 0,
          top: 0,
          scaleX: 1,
          scaleY: 1,
          angle: 0,
          x1: 0,
          y1: 0,
          x2: 100,
          y2: 0,
          lengthM: 5,
          color: "blue",
          strokeWidth: 3,
        },
        {
          id: 2,
          type: "mask",
          name: "Mask",
          left: 0,
          top: 0,
          scaleX: 1,
          scaleY: 1,
          angle: 0,
          width: 50,
          height: 50,
        },
        {
          id: 3,
          type: "overlayImage",
          name: "Overlay",
          left: 0,
          top: 0,
          scaleX: 1,
          scaleY: 1,
          angle: 0,
          imageData: "data:overlay",
          originX: "left",
          originY: "top",
        },
        {
          id: 4,
          type: "backgroundImage",
          name: "BG Image",
          left: 0,
          top: 0,
          scaleX: 1,
          scaleY: 1,
          angle: 0,
          imageData: "data:bg",
          originX: "left",
          originY: "top",
        },
      ],
    };
    const result = deserializeProject(project);
    expect(result.objects).toHaveLength(5);
    const types = result.objects.map((o) => o.type);
    expect(types).toEqual([
      "shape",
      "line",
      "mask",
      "overlayImage",
      "backgroundImage",
    ]);
  });
});

describe("serializeProject with edge cases", () => {
  it("skips objects whose getFabricState returns null", () => {
    const shape: ShapeObject = {
      id: 0,
      type: "shape",
      name: "Test",
      widthM: 2,
      heightM: 3,
      color: "red",
    };
    const line: LineObject = {
      id: 1,
      type: "line",
      name: "Line",
      lengthM: 5,
      color: "blue",
    };
    const project = serializeProject(50, null, [shape, line], (id) => {
      // Only return fabric state for the shape, line returns null
      if (id === 0) {
        return {
          left: 100,
          top: 200,
          scaleX: 1,
          scaleY: 1,
          angle: 0,
          width: 100,
          height: 150,
          baseWidthPx: 100,
          baseHeightPx: 150,
        };
      }
      return null;
    });
    // Only the shape should be serialized
    expect(project.objects).toHaveLength(1);
    expect(project.objects[0].type).toBe("shape");
  });

  it("serializes project with empty objects array", () => {
    const project = serializeProject(null, null, [], () => null);
    expect(project.version).toBe(3);
    expect(project.objects).toHaveLength(0);
    expect(project.pixelsPerMeter).toBeNull();
    expect(project.backgroundImage).toBeNull();
  });
});

describe("migrateProject edge cases", () => {
  it("handles v2 project with no metadata gracefully", () => {
    const v2: SerializedProject = {
      version: 2,
      pixelsPerMeter: 50,
      backgroundImage: null,
      savedAt: "2024-01-01",
      objects: [],
    };
    const v3 = migrateProject(v2);
    expect(v3.version).toBe(3);
    expect(v3.metadata?.exportedFrom).toBe("plan-the-space");
  });

  it("handles version 1 data by treating as pre-v3", () => {
    const v1Data = {
      version: 1,
      pixelsPerMeter: 30,
      backgroundImage: null,
      savedAt: "2023-01-01",
      objects: [],
    } as SerializedProject;
    const v3 = migrateProject(v1Data);
    expect(v3.version).toBe(3);
    expect(v3.metadata?.exportedFrom).toBe("plan-the-space");
  });
});

// ============================================
// importProjectFromFile error handling
// ============================================

describe("importProjectFromFile error handling", () => {
  it("rejects invalid JSON", async () => {
    const file = new File(["not valid json {{{"], "bad.json", {
      type: "application/json",
    });
    await expect(importProjectFromFile(file)).rejects.toThrow();
  });

  it("rejects valid JSON that fails validation", async () => {
    const file = new File([JSON.stringify({ foo: "bar" })], "wrong.json", {
      type: "application/json",
    });
    await expect(importProjectFromFile(file)).rejects.toThrow(
      "Invalid project file format",
    );
  });

  it("rejects JSON with missing version", async () => {
    const file = new File(
      [JSON.stringify({ objects: [], pixelsPerMeter: 50 })],
      "no-version.json",
      { type: "application/json" },
    );
    await expect(importProjectFromFile(file)).rejects.toThrow(
      "Invalid project file format",
    );
  });

  it("rejects JSON with missing objects array", async () => {
    const file = new File(
      [JSON.stringify({ version: 2, pixelsPerMeter: 50 })],
      "no-objects.json",
      { type: "application/json" },
    );
    await expect(importProjectFromFile(file)).rejects.toThrow(
      "Invalid project file format",
    );
  });

  it("accepts and migrates valid v2 project file", async () => {
    const validProject = {
      version: 2,
      pixelsPerMeter: 50,
      backgroundImage: null,
      savedAt: "2024-01-01",
      objects: [],
    };
    const file = new File([JSON.stringify(validProject)], "valid.json", {
      type: "application/json",
    });
    const result = await importProjectFromFile(file);
    expect(result.version).toBe(3);
    expect(result.pixelsPerMeter).toBe(50);
  });
});

// ============================================
// History edge cases
// ============================================

describe("HistoryManager error edge cases", () => {
  let manager: HistoryManager;

  beforeEach(async () => {
    const databases = await indexedDB.databases();
    for (const db of databases) {
      if (db.name) indexedDB.deleteDatabase(db.name);
    }
    manager = new HistoryManager();
  });

  it("multiple consecutive undos past empty stack return null", () => {
    manager.push(makeSnapshot());
    manager.push(makeSnapshot());
    // Undo both
    expect(manager.undo()).toBeTruthy();
    // Already at the beginning
    expect(manager.undo()).toBeNull();
    // Further undos are still null
    expect(manager.undo()).toBeNull();
    expect(manager.undo()).toBeNull();
  });

  it("multiple consecutive redos past end of stack return null", () => {
    manager.push(makeSnapshot());
    manager.push(makeSnapshot());
    manager.undo();
    // Redo back
    expect(manager.redo()).toBeTruthy();
    // No more to redo
    expect(manager.redo()).toBeNull();
    expect(manager.redo()).toBeNull();
  });

  it("undo then push then redo returns null (redo branch truncated)", () => {
    manager.push(makeSnapshot());
    manager.push(makeSnapshot());
    manager.push(makeSnapshot());
    // Undo to first
    manager.undo();
    manager.undo();
    // Push new -- truncates redo branch
    manager.push(makeSnapshot());
    // Redo should return null
    expect(manager.redo()).toBeNull();
    expect(manager.getState().canRedo).toBe(false);
  });

  it("getCurrentSnapshot after reset returns null", async () => {
    manager.push(makeSnapshot());
    manager.push(makeSnapshot());
    await manager.reset();
    expect(manager.getCurrentSnapshot()).toBeNull();
    expect(manager.getState().canUndo).toBe(false);
    expect(manager.getState().canRedo).toBe(false);
  });

  it("getState after interleaved undo/redo is consistent", () => {
    manager.push(makeSnapshot());
    manager.push(makeSnapshot());
    manager.push(makeSnapshot());
    manager.push(makeSnapshot());

    // Undo 3 times (pointer at index 0)
    manager.undo();
    manager.undo();
    manager.undo();
    expect(manager.getState()).toEqual({
      canUndo: false,
      canRedo: true,
      undoCount: 0,
      redoCount: 3,
    });

    // Redo 2 times
    manager.redo();
    manager.redo();
    expect(manager.getState()).toEqual({
      canUndo: true,
      canRedo: true,
      undoCount: 2,
      redoCount: 1,
    });

    // Redo once more
    manager.redo();
    expect(manager.getState()).toEqual({
      canUndo: true,
      canRedo: false,
      undoCount: 3,
      redoCount: 0,
    });
  });
});

describe("ImagePool edge cases", () => {
  let pool: ImagePool;

  beforeEach(async () => {
    const databases = await indexedDB.databases();
    for (const db of databases) {
      if (db.name) indexedDB.deleteDatabase(db.name);
    }
    pool = new ImagePool();
  });

  it("resolveImage for non-existent ref returns empty string", async () => {
    const result = await pool.resolveImage("nonexistent-ref");
    expect(result).toBe("");
  });

  it("releaseImage for unregistered ref is safe (no throw)", async () => {
    // Releasing a ref that was never registered should not throw
    await expect(
      pool.releaseImage("never-registered"),
    ).resolves.toBeUndefined();
  });

  it("double register increases refcount, requires two releases", async () => {
    const data = "data:image/png;base64,doubleregister";
    const ref = await pool.registerImage(data);
    await pool.registerImage(data); // Second registration
    // First release
    await pool.releaseImage(ref);
    // Should still be resolvable (refcount was 2, now 1)
    const resolved = await pool.resolveImage(ref);
    expect(resolved).toBe(data);
    // Second release
    await pool.releaseImage(ref);
    // Clear LRU to force IDB lookup
    pool.clearLruCache();
    // After full release, IDB entry is deleted, so resolve returns empty string
    const afterRelease = await pool.resolveImage(ref);
    expect(afterRelease).toBe("");
  });

  it("clearLruCache forces IDB lookups on next resolve", async () => {
    const data = "data:image/png;base64,cleartest";
    const ref = await pool.registerImage(data);
    // Resolve to populate LRU
    await pool.resolveImage(ref);
    // Clear LRU
    pool.clearLruCache();
    // Should still resolve from IDB
    const resolved = await pool.resolveImage(ref);
    expect(resolved).toBe(data);
  });

  it("computeImageRef returns same ref for same data", () => {
    const data = "data:image/png;base64,consistency-test";
    const ref1 = pool.computeImageRef(data);
    const ref2 = pool.computeImageRef(data);
    expect(ref1).toBe(ref2);
  });

  it("computeImageRef returns different refs for different data", () => {
    const ref1 = pool.computeImageRef("data:image/png;base64,aaa");
    const ref2 = pool.computeImageRef("data:image/png;base64,bbb");
    expect(ref1).not.toBe(ref2);
  });
});

// ============================================
// Pure stack functions - edge case coverage
// ============================================

describe("Pure stack functions edge cases", () => {
  it("getCurrentSnapshot returns null for out-of-bounds pointer", () => {
    // Craft a stack with an invalid pointer
    const badStack = { entries: [], pointer: 5 };
    expect(getCurrentSnapshot(badStack)).toBeNull();
  });

  it("getStackState on empty stack returns all zeros and falses", () => {
    const state = getStackState(EMPTY_STACK);
    expect(state.canUndo).toBe(false);
    expect(state.canRedo).toBe(false);
    expect(state.undoCount).toBe(0);
    expect(state.redoCount).toBe(0);
  });

  it("undoStack on single-entry stack returns null snapshot and same stack", () => {
    const snap = makeSnapshot();
    const { next: stack } = pushSnapshot(EMPTY_STACK, snap);
    const result = undoStack(stack);
    expect(result.snapshot).toBeNull();
    expect(result.next).toBe(stack);
  });

  it("redoStack when at end returns null snapshot and same stack", () => {
    const snap = makeSnapshot();
    const { next: stack } = pushSnapshot(EMPTY_STACK, snap);
    const result = redoStack(stack);
    expect(result.snapshot).toBeNull();
    expect(result.next).toBe(stack);
  });

  it("pushSnapshot handles multiple evictions when adding many at once", () => {
    let stack = EMPTY_STACK;
    // Fill to exactly the limit (50)
    for (let i = 0; i < 50; i++) {
      ({ next: stack } = pushSnapshot(stack, makeSnapshot()));
    }
    expect(stack.entries.length).toBe(50);

    // Push 3 more, each should evict one
    const result1 = pushSnapshot(stack, makeSnapshot());
    expect(result1.evicted).toHaveLength(1);
    expect(result1.next.entries.length).toBe(50);

    const result2 = pushSnapshot(result1.next, makeSnapshot());
    expect(result2.evicted).toHaveLength(1);
    expect(result2.next.entries.length).toBe(50);
  });

  it("pushSnapshot after full undo discards all redo entries", () => {
    let stack = EMPTY_STACK;
    const snap1 = makeSnapshot();
    const snap2 = makeSnapshot();
    const snap3 = makeSnapshot();
    ({ next: stack } = pushSnapshot(EMPTY_STACK, snap1));
    ({ next: stack } = pushSnapshot(stack, snap2));
    ({ next: stack } = pushSnapshot(stack, snap3));

    // Undo all the way
    ({ next: stack } = undoStack(stack));
    ({ next: stack } = undoStack(stack));
    expect(stack.pointer).toBe(0);

    // Push new
    const newSnap = makeSnapshot();
    const result = pushSnapshot(stack, newSnap);
    expect(result.discarded).toHaveLength(2);
    expect(result.discarded[0]).toBe(snap2);
    expect(result.discarded[1]).toBe(snap3);
    expect(result.next.entries).toHaveLength(2); // snap1 + newSnap
  });
});

// ============================================
// IndexedDB error handling
// ============================================

describe("IndexedDB error edge cases", () => {
  beforeEach(async () => {
    const databases = await indexedDB.databases();
    for (const db of databases) {
      if (db.name) indexedDB.deleteDatabase(db.name);
    }
  });

  it("loadProject returns null when database is empty", async () => {
    const result = await loadProject();
    expect(result).toBeNull();
  });

  it("checkProjectExists returns null when no project saved", async () => {
    const result = await checkProjectExists();
    expect(result).toBeNull();
  });

  it("saveProject then loadProject round-trips with v3 migration", async () => {
    const project: SerializedProject = {
      version: 2,
      pixelsPerMeter: 75,
      backgroundImage: null,
      savedAt: "2024-06-01",
      objects: [],
    };
    await saveProject(project);
    const loaded = await loadProject();
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(3);
    expect(loaded!.pixelsPerMeter).toBe(75);
  });

  it("multiple saves overwrite correctly", async () => {
    const project1: SerializedProject = {
      version: 2,
      pixelsPerMeter: 50,
      backgroundImage: null,
      savedAt: "2024-01-01",
      objects: [],
    };
    const project2: SerializedProject = {
      version: 2,
      pixelsPerMeter: 100,
      backgroundImage: "data:updated",
      savedAt: "2024-02-01",
      objects: [],
    };
    await saveProject(project1);
    await saveProject(project2);
    const loaded = await loadProject();
    expect(loaded!.pixelsPerMeter).toBe(100);
    expect(loaded!.backgroundImage).toBe("data:updated");
  });
});

// ============================================
// HistoryManager with image ref cleanup
// ============================================

describe("HistoryManager releases images from discarded snapshots", () => {
  let manager: HistoryManager;

  beforeEach(async () => {
    const databases = await indexedDB.databases();
    for (const db of databases) {
      if (db.name) indexedDB.deleteDatabase(db.name);
    }
    manager = new HistoryManager();
  });

  it("push after undo triggers releaseSnapshotImages on discarded snapshots", async () => {
    const imgData = "data:image/png;base64,testimage12345678901234567890";
    const ref = await manager.registerImage(imgData);

    const snap1 = makeSnapshot();
    const snap2 = makeSnapshot({ backgroundImageRef: ref });
    const snap3 = makeSnapshot();

    manager.push(snap1);
    manager.push(snap2); // contains image ref
    manager.push(snap3);

    // Undo past the snapshot with the image ref
    manager.undo(); // back to snap2
    manager.undo(); // back to snap1

    // Push new snapshot -- snap2 and snap3 are discarded
    // snap2 had a backgroundImageRef, so releaseImage should be called
    manager.push(makeSnapshot());

    // The manager should have released the image ref.
    // We cannot directly observe the refcount, but we can verify the image is still
    // accessible (was registered once, released once -> refcount 0 -> deleted from IDB)
    manager.clearLruCache();
    const resolved = await manager.resolveImage(ref);
    expect(resolved).toBe("");
  });
});
