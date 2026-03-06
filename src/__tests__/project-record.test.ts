import { describe, it, expect } from "vitest";
import {
  createProjectRecord,
  duplicateProjectRecord,
  migrateV2RecordToProjectRecord,
} from "@/lib/projectRecord";
import type { SerializedProject } from "@/lib/types";

const emptyProjectData: SerializedProject = {
  version: 4,
  pixelsPerMeter: null,
  backgroundImage: null,
  savedAt: new Date().toISOString(),
  objects: [],
};

describe("createProjectRecord", () => {
  it("returns a valid record with UUID, timestamps, and null defaults", () => {
    const record = createProjectRecord({
      name: "Test Project",
      projectData: emptyProjectData,
    });

    expect(record.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(record.name).toBe("Test Project");
    expect(record.createdAt).toBeTruthy();
    expect(record.updatedAt).toBeTruthy();
    expect(record.deletedAt).toBeNull();
    expect(record.thumbnailDataUrl).toBeNull();
    expect(record.projectData).toEqual(emptyProjectData);
  });

  it("two calls produce different IDs", () => {
    const a = createProjectRecord({
      name: "A",
      projectData: emptyProjectData,
    });
    const b = createProjectRecord({
      name: "B",
      projectData: emptyProjectData,
    });
    expect(a.id).not.toBe(b.id);
  });

  it("stores optional description", () => {
    const record = createProjectRecord({
      name: "With Desc",
      description: "A backyard plan",
      projectData: emptyProjectData,
    });
    expect(record.description).toBe("A backyard plan");
  });
});

describe("duplicateProjectRecord", () => {
  it("returns a fresh UUID with (Copy) suffix", () => {
    const original = createProjectRecord({
      name: "Garden",
      projectData: emptyProjectData,
    });
    const copy = duplicateProjectRecord(original);

    expect(copy.id).not.toBe(original.id);
    expect(copy.name).toBe("Garden (Copy)");
    expect(copy.thumbnailDataUrl).toBeNull();
    expect(copy.deletedAt).toBeNull();
  });

  it("deep-clones projectData", () => {
    const original = createProjectRecord({
      name: "Test",
      projectData: {
        ...emptyProjectData,
        objects: [
          {
            id: 0,
            type: "shape",
            name: "S",
            left: 0,
            top: 0,
            scaleX: 1,
            scaleY: 1,
            angle: 0,
            widthM: 1,
            heightM: 1,
            color: "red",
            baseWidthPx: 50,
            baseHeightPx: 50,
            width: 50,
            height: 50,
          },
        ],
      },
    });
    const copy = duplicateProjectRecord(original);

    // Modify copy's data — original should be unaffected
    copy.projectData.objects[0].name = "Modified";
    expect(original.projectData.objects[0].name).toBe("S");
  });
});

describe("migrateV2RecordToProjectRecord", () => {
  it("wraps SerializedProject with name 'My Project' and timestamps from savedAt", () => {
    const data: SerializedProject = {
      version: 2,
      pixelsPerMeter: 50,
      backgroundImage: "data:image/png;base64,abc",
      savedAt: "2024-06-15T10:30:00.000Z",
      objects: [],
    };

    const record = migrateV2RecordToProjectRecord(data);

    expect(record.name).toBe("My Project");
    expect(record.createdAt).toBe("2024-06-15T10:30:00.000Z");
    expect(record.updatedAt).toBe("2024-06-15T10:30:00.000Z");
    expect(record.deletedAt).toBeNull();
    expect(record.thumbnailDataUrl).toBeNull();
    expect(record.projectData).toBe(data);
    expect(record.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});
