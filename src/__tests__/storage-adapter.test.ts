import { describe, it, expect, beforeEach } from "vitest";
import { createInMemoryAdapter } from "@/lib/storage/storageAdapter";
import type { StorageAdapter } from "@/lib/storage/storageAdapter";
import { createProjectRecord } from "@/lib/projectRecord";
import type { SerializedProject } from "@/lib/types";

const emptyProjectData: SerializedProject = {
  version: 4,
  pixelsPerMeter: null,
  backgroundImage: null,
  savedAt: new Date().toISOString(),
  objects: [],
};

describe("In-memory StorageAdapter — multi-project methods", () => {
  let adapter: StorageAdapter;

  beforeEach(() => {
    adapter = createInMemoryAdapter();
  });

  describe("saveProjectRecord / loadProjectRecord", () => {
    it("round-trips a project record by UUID", async () => {
      const record = createProjectRecord({
        name: "Test",
        projectData: emptyProjectData,
      });
      await adapter.saveProjectRecord(record);
      const loaded = await adapter.loadProjectRecord(record.id);
      expect(loaded).toEqual(record);
    });

    it("returns null for nonexistent ID", async () => {
      const loaded = await adapter.loadProjectRecord("nonexistent");
      expect(loaded).toBeNull();
    });

    it("upserts on same ID", async () => {
      const record = createProjectRecord({
        name: "Original",
        projectData: emptyProjectData,
      });
      await adapter.saveProjectRecord(record);
      await adapter.saveProjectRecord({ ...record, name: "Updated" });
      const loaded = await adapter.loadProjectRecord(record.id);
      expect(loaded!.name).toBe("Updated");
    });
  });

  describe("loadAllProjectRecords / deleteProjectRecord", () => {
    it("returns all saved records", async () => {
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

    it("delete removes by ID", async () => {
      const record = createProjectRecord({
        name: "Doomed",
        projectData: emptyProjectData,
      });
      await adapter.saveProjectRecord(record);
      await adapter.deleteProjectRecord(record.id);
      const loaded = await adapter.loadProjectRecord(record.id);
      expect(loaded).toBeNull();
    });

    it("delete nonexistent is a no-op", async () => {
      await expect(
        adapter.deleteProjectRecord("nonexistent"),
      ).resolves.toBeUndefined();
    });
  });

  describe("saveAppState / loadAppState", () => {
    it("returns null initially", async () => {
      const state = await adapter.loadAppState();
      expect(state).toBeNull();
    });

    it("round-trips app state", async () => {
      await adapter.saveAppState({ lastOpenedProjectId: "abc-123" });
      const state = await adapter.loadAppState();
      expect(state).toEqual({ lastOpenedProjectId: "abc-123" });
    });

    it("overwrite works", async () => {
      await adapter.saveAppState({ lastOpenedProjectId: "first" });
      await adapter.saveAppState({ lastOpenedProjectId: "second" });
      const state = await adapter.loadAppState();
      expect(state!.lastOpenedProjectId).toBe("second");
    });
  });
});
