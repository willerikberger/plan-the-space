import { describe, it, expect, beforeEach } from "vitest";
import { createInMemoryAdapter } from "@/lib/storage/storageAdapter";
import type { StorageAdapter } from "@/lib/storage/storageAdapter";
import { usePlannerStore } from "@/lib/store";
import {
  createProject,
  saveCurrentProject,
  openProject,
  duplicateProject,
  softDeleteProjectOp,
  permanentDeleteProjectOp,
  restoreProjectOp,
  renameProject,
  initializeApp,
  importJsonAsProject,
} from "@/lib/projectOperations";
import { createProjectRecord } from "@/lib/projectRecord";
import type { SerializedProject } from "@/lib/types";

const emptyProjectData: SerializedProject = {
  version: 4,
  pixelsPerMeter: null,
  backgroundImage: null,
  savedAt: new Date().toISOString(),
  objects: [],
};

let adapter: StorageAdapter;

beforeEach(() => {
  adapter = createInMemoryAdapter();
  usePlannerStore.getState().reset();
  usePlannerStore.setState({
    activeView: "picker",
    activeProjectId: null,
    projects: [],
  });
});

describe("createProject", () => {
  it("creates a record, saves to adapter, updates store, returns ID", async () => {
    const id = await createProject(adapter, { name: "My Garden" });

    expect(id).toBeTruthy();
    const record = await adapter.loadProjectRecord(id);
    expect(record).not.toBeNull();
    expect(record!.name).toBe("My Garden");
    expect(record!.projectData.version).toBe(4);
    expect(record!.projectData.objects).toEqual([]);

    const store = usePlannerStore.getState();
    expect(store.activeProjectId).toBe(id);
    expect(store.activeView).toBe("canvas");
    expect(store.projects).toHaveLength(1);
    expect(store.projects[0].name).toBe("My Garden");
  });
});

describe("saveCurrentProject", () => {
  it("updates record projectData and updatedAt", async () => {
    const id = await createProject(adapter, { name: "Test" });
    const projectData: SerializedProject = {
      ...emptyProjectData,
      pixelsPerMeter: 100,
      savedAt: new Date().toISOString(),
    };
    await saveCurrentProject(adapter, projectData);

    const record = await adapter.loadProjectRecord(id);
    expect(record!.projectData.pixelsPerMeter).toBe(100);
  });

  it("no-op when activeProjectId is null", async () => {
    usePlannerStore.getState().setActiveProjectId(null);
    await saveCurrentProject(adapter, emptyProjectData);
    const all = await adapter.loadAllProjectRecords();
    expect(all).toHaveLength(0);
  });
});

describe("openProject", () => {
  it("loads record into store and sets active project", async () => {
    const record = createProjectRecord({
      name: "Existing",
      projectData: {
        ...emptyProjectData,
        pixelsPerMeter: 75,
      },
    });
    await adapter.saveProjectRecord(record);
    usePlannerStore.getState().addProject({
      id: record.id,
      name: record.name,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: null,
      thumbnailDataUrl: null,
    });

    const result = await openProject(adapter, record.id);
    expect(result).not.toBeNull();

    const store = usePlannerStore.getState();
    expect(store.activeProjectId).toBe(record.id);
    expect(store.activeView).toBe("canvas");
    expect(store.pixelsPerMeter).toBe(75);

    // Should save lastOpenedProjectId
    const appState = await adapter.loadAppState();
    expect(appState!.lastOpenedProjectId).toBe(record.id);
  });

  it("returns null for nonexistent project", async () => {
    const result = await openProject(adapter, "nonexistent");
    expect(result).toBeNull();
  });
});

describe("duplicateProject", () => {
  it("creates an independent copy with (Copy) suffix", async () => {
    const id = await createProject(adapter, { name: "Original" });
    const copyId = await duplicateProject(adapter, id);

    expect(copyId).not.toBeNull();
    expect(copyId).not.toBe(id);

    const copy = await adapter.loadProjectRecord(copyId!);
    expect(copy!.name).toBe("Original (Copy)");

    const store = usePlannerStore.getState();
    expect(store.projects).toHaveLength(2);
  });
});

describe("softDeleteProjectOp / permanentDeleteProjectOp / restoreProjectOp", () => {
  it("soft delete marks deletedAt in adapter and store", async () => {
    const id = await createProject(adapter, { name: "Doomed" });
    await softDeleteProjectOp(adapter, id);

    const record = await adapter.loadProjectRecord(id);
    expect(record!.deletedAt).toBeTruthy();
    expect(usePlannerStore.getState().projects[0].deletedAt).toBeTruthy();
  });

  it("permanent delete removes from both", async () => {
    const id = await createProject(adapter, { name: "Gone" });
    await permanentDeleteProjectOp(adapter, id);

    const record = await adapter.loadProjectRecord(id);
    expect(record).toBeNull();
    expect(usePlannerStore.getState().projects).toHaveLength(0);
  });

  it("restore clears deletedAt", async () => {
    const id = await createProject(adapter, { name: "Saved" });
    await softDeleteProjectOp(adapter, id);
    await restoreProjectOp(adapter, id);

    const record = await adapter.loadProjectRecord(id);
    expect(record!.deletedAt).toBeNull();
    expect(usePlannerStore.getState().projects[0].deletedAt).toBeNull();
  });
});

describe("renameProject", () => {
  it("updates name and updatedAt in adapter and store", async () => {
    const id = await createProject(adapter, { name: "Old Name" });
    const result = await renameProject(adapter, id, "New Name");

    expect(result).not.toBeNull();
    expect(result!.name).toBe("New Name");

    const record = await adapter.loadProjectRecord(id);
    expect(record!.name).toBe("New Name");

    expect(usePlannerStore.getState().projects[0].name).toBe("New Name");
  });

  it("returns null for nonexistent", async () => {
    const result = await renameProject(adapter, "nonexistent", "X");
    expect(result).toBeNull();
  });
});

describe("initializeApp", () => {
  it("loads all records into store and returns them", async () => {
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
    await adapter.saveAppState({ lastOpenedProjectId: r2.id });

    const result = await initializeApp(adapter);

    expect(result.projects).toHaveLength(2);
    expect(result.lastOpenedProjectId).toBe(r2.id);
    expect(usePlannerStore.getState().projects).toHaveLength(2);
    expect(usePlannerStore.getState().activeView).toBe("picker");
  });
});

describe("importJsonAsProject", () => {
  it("creates a project record from serialized data with (Imported) suffix", async () => {
    const data: SerializedProject = {
      version: 2,
      pixelsPerMeter: 50,
      backgroundImage: null,
      savedAt: "2024-01-01",
      objects: [],
    };
    const id = await importJsonAsProject(adapter, data, "my-floor-plan.json");

    const record = await adapter.loadProjectRecord(id);
    expect(record!.name).toBe("my-floor-plan (Imported)");
    expect(record!.projectData.version).toBe(4); // migrated

    expect(usePlannerStore.getState().projects).toHaveLength(1);
  });

  it("uses default name when no filename provided", async () => {
    const id = await importJsonAsProject(adapter, emptyProjectData);
    const record = await adapter.loadProjectRecord(id);
    expect(record!.name).toBe("Imported Project (Imported)");
  });
});
