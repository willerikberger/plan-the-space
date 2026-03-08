import { describe, it, expect, beforeEach } from "vitest";
import { createInMemoryAdapter } from "@/lib/storage/storageAdapter";
import type { StorageAdapter } from "@/lib/storage/storageAdapter";
import { usePlannerStore } from "@/lib/store";
import {
  initializeApp,
  createProject,
  saveCurrentProject,
  openProject,
  duplicateProject,
  renameProject,
  softDeleteProject,
  restoreProject,
  permanentDeleteProject,
  importJsonAsProject,
} from "@/lib/projectOperations";
import type { SerializedProject } from "@/lib/types";

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

describe("Multi-project end-to-end workflow", () => {
  it("full lifecycle: create, save, switch, duplicate, rename, delete, import", async () => {
    // 1. Initialize empty app
    const initResult = await initializeApp(adapter);
    expect(initResult.projects).toHaveLength(0);
    expect(usePlannerStore.getState().activeView).toBe("picker");

    // 2. Create first project
    const id1 = await createProject(adapter, { name: "Project A" });
    expect(usePlannerStore.getState().activeView).toBe("picker");
    expect(usePlannerStore.getState().activeProjectId).toBe(id1);

    // 3. "Add objects" via store and save
    usePlannerStore.getState().addObject({
      id: 0,
      type: "shape",
      name: "Shape 1",
      widthM: 2,
      heightM: 3,
      color: "red",
    });
    const projectData: SerializedProject = {
      version: 4,
      pixelsPerMeter: 100,
      backgroundImage: null,
      savedAt: new Date().toISOString(),
      objects: [
        {
          id: 0,
          type: "shape",
          name: "Shape 1",
          left: 50,
          top: 50,
          scaleX: 1,
          scaleY: 1,
          angle: 0,
          widthM: 2,
          heightM: 3,
          color: "red",
          baseWidthPx: 200,
          baseHeightPx: 300,
          width: 200,
          height: 300,
        },
      ],
    };
    await saveCurrentProject(adapter, projectData);

    // 4. Create second project
    const id2 = await createProject(adapter, { name: "Project B" });
    expect(usePlannerStore.getState().activeProjectId).toBe(id2);
    expect(usePlannerStore.getState().projects).toHaveLength(2);

    // 5. Switch back to first project — verify isolation
    await openProject(adapter, id1);
    expect(usePlannerStore.getState().activeProjectId).toBe(id1);
    expect(usePlannerStore.getState().pixelsPerMeter).toBe(100);
    // Objects loaded from store
    const objects = Array.from(usePlannerStore.getState().objects.values());
    expect(objects).toHaveLength(1);
    expect(objects[0].name).toBe("Shape 1");

    // 6. Duplicate project
    const copyId = await duplicateProject(adapter, id1);
    expect(copyId).not.toBeNull();
    expect(usePlannerStore.getState().projects).toHaveLength(3);
    const copy = usePlannerStore
      .getState()
      .projects.find((p) => p.id === copyId);
    expect(copy!.name).toBe("Project A (Copy)");

    // 7. Rename project
    await renameProject(adapter, id1, "Renamed A");
    expect(
      usePlannerStore.getState().projects.find((p) => p.id === id1)!.name,
    ).toBe("Renamed A");

    // 8. Soft delete
    await softDeleteProject(adapter, id2);
    const deletedProject = usePlannerStore
      .getState()
      .projects.find((p) => p.id === id2);
    expect(deletedProject!.deletedAt).toBeTruthy();

    // 9. Restore
    await restoreProject(adapter, id2);
    const restoredProject = usePlannerStore
      .getState()
      .projects.find((p) => p.id === id2);
    expect(restoredProject!.deletedAt).toBeNull();

    // 10. Permanent delete
    await permanentDeleteProject(adapter, id2);
    expect(
      usePlannerStore.getState().projects.find((p) => p.id === id2),
    ).toBeUndefined();
    expect(await adapter.loadProjectRecord(id2)).toBeNull();

    // 11. Import JSON as project
    const importData: SerializedProject = {
      version: 2,
      pixelsPerMeter: 50,
      backgroundImage: null,
      savedAt: "2024-01-01",
      objects: [],
    };
    const importId = await importJsonAsProject(
      adapter,
      importData,
      "legacy-plan.json",
    );
    const importedRecord = await adapter.loadProjectRecord(importId);
    expect(importedRecord!.name).toBe("legacy-plan (Imported)");
    expect(importedRecord!.projectData.version).toBe(5); // migrated
    expect(
      usePlannerStore.getState().projects.find((p) => p.id === importId),
    ).toBeDefined();

    // Final state: 3 projects (Renamed A, Copy, imported)
    expect(usePlannerStore.getState().projects).toHaveLength(3);
  });
});
