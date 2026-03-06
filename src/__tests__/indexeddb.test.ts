import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import {
  saveProject,
  loadProject,
  clearProject,
  checkProjectExists,
  saveImageData,
  loadImageData,
  deleteImageData,
  clearImagePool,
  createIndexedDBAdapter,
} from "@/lib/storage/indexeddb";
import { createProjectRecord } from "@/lib/projectRecord";
import type { SerializedProject } from "@/lib/types";
import { createEmptyProjectData } from "./helpers/fixtures";

const testProject: SerializedProject = {
  version: 2,
  pixelsPerMeter: 50,
  backgroundImage: "data:image/png;base64,abc",
  savedAt: new Date().toISOString(),
  objects: [
    {
      id: 0,
      type: "shape",
      name: "Test",
      left: 100,
      top: 200,
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
  ],
};

beforeEach(async () => {
  // Clear all databases between tests
  const databases = await indexedDB.databases();
  for (const db of databases) {
    if (db.name) indexedDB.deleteDatabase(db.name);
  }
});

describe("IndexedDB storage", () => {
  it("saves and loads a project (migrated to v4)", async () => {
    await saveProject(testProject);
    const loaded = await loadProject();
    expect(loaded).not.toBeNull();
    expect(loaded?.version).toBe(4); // v2 input is migrated to v4 on load
    expect(loaded?.pixelsPerMeter).toBe(50);
    expect(loaded?.objects).toHaveLength(1);
  });

  it("returns null when no project saved", async () => {
    const loaded = await loadProject();
    expect(loaded).toBeNull();
  });

  it("clears a saved project", async () => {
    await saveProject(testProject);
    await clearProject();
    const loaded = await loadProject();
    expect(loaded).toBeNull();
  });

  it("checkProjectExists returns project when saved", async () => {
    await saveProject(testProject);
    const exists = await checkProjectExists();
    expect(exists).not.toBeNull();
  });

  it("checkProjectExists returns null when empty", async () => {
    const exists = await checkProjectExists();
    expect(exists).toBeNull();
  });

  it("overwrites existing project on save", async () => {
    await saveProject(testProject);
    const updated = { ...testProject, pixelsPerMeter: 100 };
    await saveProject(updated);
    const loaded = await loadProject();
    expect(loaded?.pixelsPerMeter).toBe(100);
  });

  it("loads v2 project as v4 after migration", async () => {
    await saveProject(testProject); // v2
    const loaded = await loadProject();
    expect(loaded).not.toBeNull();
    expect(loaded?.version).toBe(4);
    if (loaded && "metadata" in loaded) {
      expect((loaded as Record<string, unknown>).metadata).toBeDefined();
    }
  });
});

describe("Image pool operations", () => {
  it("saves and loads image data", async () => {
    await saveImageData("ref-1", "data:image/png;base64,abc123");
    const loaded = await loadImageData("ref-1");
    expect(loaded).toBe("data:image/png;base64,abc123");
  });

  it("returns null for non-existent image", async () => {
    const loaded = await loadImageData("nonexistent");
    expect(loaded).toBeNull();
  });

  it("deletes image data", async () => {
    await saveImageData("ref-2", "test-data");
    await deleteImageData("ref-2");
    const loaded = await loadImageData("ref-2");
    expect(loaded).toBeNull();
  });

  it("clears all image data", async () => {
    await saveImageData("a", "data-a");
    await saveImageData("b", "data-b");
    await clearImagePool();
    expect(await loadImageData("a")).toBeNull();
    expect(await loadImageData("b")).toBeNull();
  });
});

const emptyProjectData = createEmptyProjectData();

describe("IndexedDB adapter — multi-project methods", () => {
  it("saveProjectRecord + loadProjectRecord round-trip", async () => {
    const adapter = createIndexedDBAdapter();
    const record = createProjectRecord({
      name: "Test",
      projectData: emptyProjectData,
    });
    await adapter.saveProjectRecord(record);
    const loaded = await adapter.loadProjectRecord(record.id);
    expect(loaded).toEqual(record);
  });

  it("loadProjectRecord returns null for nonexistent", async () => {
    const adapter = createIndexedDBAdapter();
    const loaded = await adapter.loadProjectRecord("nonexistent");
    expect(loaded).toBeNull();
  });

  it("loadAllProjectRecords returns all saved records", async () => {
    const adapter = createIndexedDBAdapter();
    const r1 = createProjectRecord({
      name: "A",
      projectData: emptyProjectData,
    });
    const r2 = createProjectRecord({
      name: "B",
      projectData: emptyProjectData,
    });
    await adapter.saveProjectRecord(r1);
    await adapter.saveProjectRecord(r2);
    const all = await adapter.loadAllProjectRecords();
    expect(all).toHaveLength(2);
  });

  it("deleteProjectRecord removes by ID", async () => {
    const adapter = createIndexedDBAdapter();
    const record = createProjectRecord({
      name: "Doomed",
      projectData: emptyProjectData,
    });
    await adapter.saveProjectRecord(record);
    await adapter.deleteProjectRecord(record.id);
    const loaded = await adapter.loadProjectRecord(record.id);
    expect(loaded).toBeNull();
  });

  it("saveAppState + loadAppState round-trip", async () => {
    const adapter = createIndexedDBAdapter();
    await adapter.saveAppState({ lastOpenedProjectId: "abc-123" });
    const state = await adapter.loadAppState();
    expect(state).toEqual({ lastOpenedProjectId: "abc-123" });
  });

  it("loadAppState returns null when empty", async () => {
    const adapter = createIndexedDBAdapter();
    const state = await adapter.loadAppState();
    expect(state).toBeNull();
  });
});

describe("IndexedDB v2→v3 data migration", () => {
  it("migrates legacy single-project to ProjectRecord on upgrade", async () => {
    const DB_NAME = "PlanTheSpaceDB";
    const STORE = "projects";
    const KEY = "plan-the-space-project";

    // Manually create a v2 DB and populate it
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 2);
      req.onerror = () => reject(req.error);
      req.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("image-pool")) {
          db.createObjectStore("image-pool");
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(STORE, "readwrite");
        const store = tx.objectStore(STORE);
        store.put({ ...testProject, id: KEY });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
      };
    });

    // Now open via the adapter at v3 — triggers migration
    const adapter = createIndexedDBAdapter();
    const all = await adapter.loadAllProjectRecords();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe("My Project");
    expect(all[0].projectData).toBeDefined();

    // App state should have lastOpenedProjectId set
    const appState = await adapter.loadAppState();
    expect(appState).not.toBeNull();
    expect(appState!.lastOpenedProjectId).toBe(all[0].id);
  });
});
