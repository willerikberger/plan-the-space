import { describe, it, expect } from "vitest";
import {
  serializeObject,
  serializeProject,
  deserializeProject,
  validateProjectData,
  migrateProject,
} from "@/components/canvas/utils/serialization";
import type {
  BackgroundImageObject,
  OverlayImageObject,
  MaskObject,
  LineObject,
  ShapeObject,
  SerializedProject,
} from "@/lib/types";

// ============================================
// validateProjectData — additional edge cases
// ============================================

describe("validateProjectData (extended)", () => {
  it("rejects undefined", () => {
    expect(validateProjectData(undefined)).toBe(false);
  });

  it("rejects a number", () => {
    expect(validateProjectData(42)).toBe(false);
  });

  it("rejects an array", () => {
    expect(validateProjectData([1, 2, 3])).toBe(false);
  });

  it("rejects when pixelsPerMeter is a string", () => {
    expect(
      validateProjectData({
        version: 3,
        pixelsPerMeter: "fifty",
        backgroundImage: null,
        savedAt: "2024-01-01",
        objects: [],
      }),
    ).toBe(false);
  });

  it("rejects when version is a string", () => {
    expect(
      validateProjectData({
        version: "3",
        pixelsPerMeter: 50,
        backgroundImage: null,
        savedAt: "2024-01-01",
        objects: [],
      }),
    ).toBe(false);
  });

  it("rejects when objects is an object instead of array", () => {
    expect(
      validateProjectData({
        version: 3,
        pixelsPerMeter: 50,
        backgroundImage: null,
        savedAt: "2024-01-01",
        objects: {},
      }),
    ).toBe(false);
  });

  it("accepts pixelsPerMeter of 0", () => {
    expect(
      validateProjectData({
        version: 3,
        pixelsPerMeter: 0,
        backgroundImage: null,
        savedAt: "2024-01-01",
        objects: [],
      }),
    ).toBe(true);
  });
});

// ============================================
// serializeObject — image types
// ============================================

describe("serializeObject (images)", () => {
  it("serializes a backgroundImage", () => {
    const bgObj: BackgroundImageObject = {
      id: 10,
      type: "backgroundImage",
      name: "Floor Plan",
      imageData: "data:image/png;base64,abc123",
    };
    const result = serializeObject(bgObj, {
      left: 0,
      top: 0,
      scaleX: 0.5,
      scaleY: 0.5,
      angle: 0,
      originX: "center",
      originY: "center",
    });

    expect(result.type).toBe("backgroundImage");
    expect(result.id).toBe(10);
    expect(result.name).toBe("Floor Plan");
    expect(result.left).toBe(0);
    expect(result.scaleX).toBe(0.5);
    if (result.type === "backgroundImage") {
      expect(result.imageData).toBe("data:image/png;base64,abc123");
      expect(result.originX).toBe("center");
      expect(result.originY).toBe("center");
    }
  });

  it("serializes an overlayImage", () => {
    const overlayObj: OverlayImageObject = {
      id: 20,
      type: "overlayImage",
      name: "Furniture Layout",
      imageData: "data:image/jpeg;base64,xyz789",
    };
    const result = serializeObject(overlayObj, {
      left: 50,
      top: 100,
      scaleX: 1,
      scaleY: 1,
      angle: 90,
      originX: "left",
      originY: "top",
    });

    expect(result.type).toBe("overlayImage");
    expect(result.angle).toBe(90);
    if (result.type === "overlayImage") {
      expect(result.imageData).toBe("data:image/jpeg;base64,xyz789");
      expect(result.originX).toBe("left");
      expect(result.originY).toBe("top");
    }
  });

  it("defaults originX to left and originY to top when not provided", () => {
    const bgObj: BackgroundImageObject = {
      id: 11,
      type: "backgroundImage",
      name: "BG",
      imageData: "data:test",
    };
    const result = serializeObject(bgObj, {
      left: 0,
      top: 0,
      scaleX: 1,
      scaleY: 1,
      angle: 0,
      // originX and originY intentionally omitted
    });

    if (result.type === "backgroundImage") {
      expect(result.originX).toBe("left");
      expect(result.originY).toBe("top");
    }
  });
});

// ============================================
// serializeObject — edge cases for existing types
// ============================================

describe("serializeObject (edge cases)", () => {
  it("defaults fabricState values for shape when undefined", () => {
    const shape: ShapeObject = {
      id: 0,
      type: "shape",
      name: "S",
      widthM: 1,
      heightM: 1,
      color: "red",
    };
    const result = serializeObject(shape, {
      left: 10,
      top: 20,
      scaleX: 1,
      scaleY: 1,
      angle: 0,
      // width, height, baseWidthPx, baseHeightPx intentionally omitted
    });

    if (result.type === "shape") {
      expect(result.width).toBe(0);
      expect(result.height).toBe(0);
      expect(result.baseWidthPx).toBe(0);
      expect(result.baseHeightPx).toBe(0);
    }
  });

  it("defaults fabricState values for line when undefined", () => {
    const line: LineObject = {
      id: 1,
      type: "line",
      name: "L",
      lengthM: 5,
      color: "blue",
    };
    const result = serializeObject(line, {
      left: 0,
      top: 0,
      scaleX: 1,
      scaleY: 1,
      angle: 0,
      // x1, y1, x2, y2, strokeWidth intentionally omitted
    });

    if (result.type === "line") {
      expect(result.x1).toBe(0);
      expect(result.y1).toBe(0);
      expect(result.x2).toBe(0);
      expect(result.y2).toBe(0);
      expect(result.strokeWidth).toBe(3);
    }
  });

  it("mask width/height are multiplied by scale", () => {
    const mask: MaskObject = { id: 2, type: "mask", name: "M" };
    const result = serializeObject(mask, {
      left: 0,
      top: 0,
      scaleX: 1.5,
      scaleY: 2.0,
      angle: 0,
      width: 100,
      height: 80,
    });

    if (result.type === "mask") {
      expect(result.width).toBe(150); // 100 * 1.5
      expect(result.height).toBe(160); // 80 * 2.0
    }
  });

  it("mask defaults width/height to 0 when undefined in fabricState", () => {
    const mask: MaskObject = { id: 3, type: "mask", name: "M2" };
    const result = serializeObject(mask, {
      left: 0,
      top: 0,
      scaleX: 2,
      scaleY: 3,
      angle: 0,
      // width/height intentionally omitted
    });

    if (result.type === "mask") {
      expect(result.width).toBe(0); // 0 * 2
      expect(result.height).toBe(0); // 0 * 3
    }
  });
});

// ============================================
// serializeProject — edge cases
// ============================================

describe("serializeProject (extended)", () => {
  it("skips objects whose getFabricState returns null", () => {
    const shape: ShapeObject = {
      id: 0,
      type: "shape",
      name: "S",
      widthM: 1,
      heightM: 1,
      color: "red",
    };
    const line: LineObject = {
      id: 1,
      type: "line",
      name: "L",
      lengthM: 3,
      color: "blue",
    };

    const project = serializeProject(50, null, [shape, line], (id) => {
      // Only shape has fabric state; line returns null
      if (id === 0) {
        return {
          left: 0,
          top: 0,
          scaleX: 1,
          scaleY: 1,
          angle: 0,
          width: 50,
          height: 50,
          baseWidthPx: 50,
          baseHeightPx: 50,
        };
      }
      return null;
    });

    expect(project.objects).toHaveLength(1);
    expect(project.objects[0].type).toBe("shape");
  });

  it("returns empty objects array when all getFabricState return null", () => {
    const shape: ShapeObject = {
      id: 0,
      type: "shape",
      name: "S",
      widthM: 1,
      heightM: 1,
      color: "red",
    };

    const project = serializeProject(100, null, [shape], () => null);

    expect(project.objects).toHaveLength(0);
  });

  it("serializes with null pixelsPerMeter and null backgroundImage", () => {
    const project = serializeProject(null, null, [], () => null);

    expect(project.version).toBe(3);
    expect(project.pixelsPerMeter).toBeNull();
    expect(project.backgroundImage).toBeNull();
    expect(project.objects).toHaveLength(0);
    expect(project.savedAt).toBeTruthy();
  });

  it("includes metadata in v3 format", () => {
    const project = serializeProject(50, null, [], () => null);

    // Cast to check v3 metadata
    const v3 = project as {
      metadata?: { appVersion?: string; exportedFrom?: string };
    };
    expect(v3.metadata).toBeDefined();
    expect(v3.metadata?.appVersion).toBe("1.0.0");
    expect(v3.metadata?.exportedFrom).toBe("plan-the-space");
  });

  it("includes a valid ISO savedAt timestamp", () => {
    const before = new Date().toISOString();
    const project = serializeProject(50, null, [], () => null);
    const after = new Date().toISOString();

    expect(project.savedAt >= before).toBe(true);
    expect(project.savedAt <= after).toBe(true);
  });
});

// ============================================
// deserializeProject — image types
// ============================================

describe("deserializeProject (images)", () => {
  it("deserializes backgroundImage objects", () => {
    const data: SerializedProject = {
      version: 3,
      pixelsPerMeter: 50,
      backgroundImage: null,
      savedAt: "2024-01-01",
      objects: [
        {
          id: 10,
          type: "backgroundImage",
          name: "Floor Plan",
          left: 0,
          top: 0,
          scaleX: 0.5,
          scaleY: 0.5,
          angle: 0,
          imageData: "data:image/png;base64,abc",
          originX: "center",
          originY: "center",
        },
      ],
    };

    const result = deserializeProject(data);
    expect(result.objects).toHaveLength(1);

    const obj = result.objects[0];
    expect(obj.type).toBe("backgroundImage");
    if (obj.type === "backgroundImage") {
      expect(obj.name).toBe("Floor Plan");
      expect(obj.imageData).toBe("data:image/png;base64,abc");
    }
  });

  it("deserializes overlayImage objects", () => {
    const data: SerializedProject = {
      version: 3,
      pixelsPerMeter: 50,
      backgroundImage: null,
      savedAt: "2024-01-01",
      objects: [
        {
          id: 20,
          type: "overlayImage",
          name: "Overlay",
          left: 50,
          top: 100,
          scaleX: 1,
          scaleY: 1,
          angle: 0,
          imageData: "data:image/jpeg;base64,xyz",
          originX: "left",
          originY: "top",
        },
      ],
    };

    const result = deserializeProject(data);
    expect(result.objects).toHaveLength(1);

    const obj = result.objects[0];
    expect(obj.type).toBe("overlayImage");
    if (obj.type === "overlayImage") {
      expect(obj.name).toBe("Overlay");
      expect(obj.imageData).toBe("data:image/jpeg;base64,xyz");
    }
  });

  it("round-trips image objects through serialize/deserialize", () => {
    const bgObj: BackgroundImageObject = {
      id: 10,
      type: "backgroundImage",
      name: "BG",
      imageData: "data:image/png;base64,roundtrip",
    };
    const overlayObj: OverlayImageObject = {
      id: 11,
      type: "overlayImage",
      name: "OL",
      imageData: "data:image/jpeg;base64,roundtrip2",
    };

    const project = serializeProject(
      75,
      "data:bg-main",
      [bgObj, overlayObj],
      (id) => {
        if (id === 10)
          return {
            left: 0,
            top: 0,
            scaleX: 0.5,
            scaleY: 0.5,
            angle: 0,
            originX: "center",
            originY: "center",
          };
        if (id === 11)
          return {
            left: 50,
            top: 50,
            scaleX: 1,
            scaleY: 1,
            angle: 45,
            originX: "left",
            originY: "top",
          };
        return null;
      },
    );

    const deserialized = deserializeProject(project);
    expect(deserialized.objects).toHaveLength(2);

    const dBg = deserialized.objects[0];
    expect(dBg.type).toBe("backgroundImage");
    if (dBg.type === "backgroundImage") {
      expect(dBg.imageData).toBe("data:image/png;base64,roundtrip");
    }

    const dOverlay = deserialized.objects[1];
    expect(dOverlay.type).toBe("overlayImage");
    if (dOverlay.type === "overlayImage") {
      expect(dOverlay.imageData).toBe("data:image/jpeg;base64,roundtrip2");
    }

    // serializedObjects preserved for canvas reconstruction
    expect(deserialized.serializedObjects).toHaveLength(2);
    expect(deserialized.serializedObjects[0].left).toBe(0);
    expect(deserialized.serializedObjects[1].angle).toBe(45);
  });
});

// ============================================
// deserializeProject — mixed types
// ============================================

describe("deserializeProject (mixed)", () => {
  it("deserializes a project with all object types", () => {
    const data: SerializedProject = {
      version: 3,
      pixelsPerMeter: 100,
      backgroundImage: "data:image/png;base64,main",
      savedAt: "2024-06-01",
      objects: [
        {
          id: 0,
          type: "shape",
          name: "Room",
          left: 10,
          top: 20,
          scaleX: 1,
          scaleY: 1,
          angle: 0,
          widthM: 5,
          heightM: 4,
          color: "green",
          baseWidthPx: 500,
          baseHeightPx: 400,
          width: 500,
          height: 400,
        },
        {
          id: 1,
          type: "line",
          name: "Wall",
          left: 0,
          top: 0,
          scaleX: 1,
          scaleY: 1,
          angle: 0,
          x1: 0,
          y1: 0,
          x2: 500,
          y2: 0,
          lengthM: 5,
          color: "red",
          strokeWidth: 3,
        },
        {
          id: 2,
          type: "mask",
          name: "Mask",
          left: 50,
          top: 50,
          scaleX: 1,
          scaleY: 1,
          angle: 0,
          width: 200,
          height: 150,
        },
        {
          id: 3,
          type: "backgroundImage",
          name: "BG",
          left: 0,
          top: 0,
          scaleX: 1,
          scaleY: 1,
          angle: 0,
          imageData: "data:bg",
          originX: "left",
          originY: "top",
        },
        {
          id: 4,
          type: "overlayImage",
          name: "OL",
          left: 100,
          top: 100,
          scaleX: 0.5,
          scaleY: 0.5,
          angle: 30,
          imageData: "data:ol",
          originX: "center",
          originY: "center",
        },
      ],
    };

    const result = deserializeProject(data);
    expect(result.objects).toHaveLength(5);
    expect(result.pixelsPerMeter).toBe(100);
    expect(result.backgroundImageData).toBe("data:image/png;base64,main");

    expect(result.objects[0].type).toBe("shape");
    expect(result.objects[1].type).toBe("line");
    expect(result.objects[2].type).toBe("mask");
    expect(result.objects[3].type).toBe("backgroundImage");
    expect(result.objects[4].type).toBe("overlayImage");

    // serializedObjects have the same count and preserve fabric-level data
    expect(result.serializedObjects).toHaveLength(5);
  });

  it("deserializes empty project", () => {
    const data: SerializedProject = {
      version: 3,
      pixelsPerMeter: null,
      backgroundImage: null,
      savedAt: "2024-01-01",
      objects: [],
    };

    const result = deserializeProject(data);
    expect(result.objects).toHaveLength(0);
    expect(result.serializedObjects).toHaveLength(0);
    expect(result.pixelsPerMeter).toBeNull();
    expect(result.backgroundImageData).toBeNull();
  });
});

// ============================================
// migrateProject — additional edge cases
// ============================================

describe("migrateProject (extended)", () => {
  it("strips the id property during migration and re-adds it", () => {
    const v2WithId: SerializedProject = {
      version: 2,
      pixelsPerMeter: 50,
      backgroundImage: "data:test",
      savedAt: "2024-01-01",
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
      id: "my-project-key",
    };

    const v3 = migrateProject(v2WithId);
    expect(v3.version).toBe(3);
    expect(v3.id).toBe("my-project-key");
    expect(v3.objects).toHaveLength(1);
    expect(v3.backgroundImage).toBe("data:test");
    expect(v3.metadata?.exportedFrom).toBe("plan-the-space");
  });

  it("does not add id when not present in v2 data", () => {
    const v2NoId: SerializedProject = {
      version: 2,
      pixelsPerMeter: null,
      backgroundImage: null,
      savedAt: "2024-01-01",
      objects: [],
    };

    const v3 = migrateProject(v2NoId);
    expect(v3.version).toBe(3);
    expect(v3.id).toBeUndefined();
  });

  it("preserves savedAt and pixelsPerMeter during migration", () => {
    const v2: SerializedProject = {
      version: 2,
      pixelsPerMeter: 123.5,
      backgroundImage: null,
      savedAt: "2024-12-25T00:00:00.000Z",
      objects: [],
    };

    const v3 = migrateProject(v2);
    expect(v3.savedAt).toBe("2024-12-25T00:00:00.000Z");
    expect(v3.pixelsPerMeter).toBe(123.5);
  });
});
