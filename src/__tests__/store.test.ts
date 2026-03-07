import { describe, it, expect, beforeEach } from "vitest";
import { usePlannerStore, selectVisibleObjects } from "@/lib/store";
import type { ShapeObject, LineObject, MaskObject } from "@/lib/types";

beforeEach(() => {
  usePlannerStore.getState().reset();
});

describe("usePlannerStore", () => {
  it("has correct initial state", () => {
    const state = usePlannerStore.getState();
    expect(state.mode).toBe("normal");
    expect(state.pixelsPerMeter).toBeNull();
    expect(state.objects.size).toBe(0);
    expect(state.objectIdCounter).toBe(0);
  });

  it("setMode changes mode", () => {
    usePlannerStore.getState().setMode("calibrating");
    expect(usePlannerStore.getState().mode).toBe("calibrating");
  });

  it("setPixelsPerMeter updates scale", () => {
    usePlannerStore.getState().setPixelsPerMeter(50);
    expect(usePlannerStore.getState().pixelsPerMeter).toBe(50);
  });

  it("nextObjectId increments counter", () => {
    const id1 = usePlannerStore.getState().nextObjectId();
    const id2 = usePlannerStore.getState().nextObjectId();
    expect(id1).toBe(0);
    expect(id2).toBe(1);
    expect(usePlannerStore.getState().objectIdCounter).toBe(2);
  });

  it("addObject inserts into Map", () => {
    const obj: ShapeObject = {
      id: 0,
      type: "shape",
      name: "Test",
      widthM: 2,
      heightM: 3,
      color: "rgba(76, 175, 80, 0.6)",
    };
    usePlannerStore.getState().addObject(obj);
    expect(usePlannerStore.getState().objects.size).toBe(1);
    expect(usePlannerStore.getState().objects.get(0)).toEqual(obj);
  });

  it("removeObject deletes from Map", () => {
    const obj: ShapeObject = {
      id: 0,
      type: "shape",
      name: "Test",
      widthM: 2,
      heightM: 3,
      color: "red",
    };
    usePlannerStore.getState().addObject(obj);
    usePlannerStore.getState().removeObject(0);
    expect(usePlannerStore.getState().objects.size).toBe(0);
  });

  it("updateObject merges partial", () => {
    const obj: ShapeObject = {
      id: 0,
      type: "shape",
      name: "Old",
      widthM: 2,
      heightM: 3,
      color: "red",
    };
    usePlannerStore.getState().addObject(obj);
    usePlannerStore.getState().updateObject(0, { name: "New" });
    expect(usePlannerStore.getState().objects.get(0)?.name).toBe("New");
  });

  it("clearObjects with type filter", () => {
    const shape: ShapeObject = {
      id: 0,
      type: "shape",
      name: "S",
      widthM: 1,
      heightM: 1,
      color: "r",
    };
    const mask: MaskObject = { id: 1, type: "mask", name: "M" };
    usePlannerStore.getState().addObject(shape);
    usePlannerStore.getState().addObject(mask);
    usePlannerStore.getState().clearObjects(["shape"]);
    expect(usePlannerStore.getState().objects.size).toBe(1);
    expect(usePlannerStore.getState().objects.has(1)).toBe(true);
  });

  it("clearObjects without filter clears all", () => {
    const shape: ShapeObject = {
      id: 0,
      type: "shape",
      name: "S",
      widthM: 1,
      heightM: 1,
      color: "r",
    };
    usePlannerStore.getState().addObject(shape);
    usePlannerStore.getState().clearObjects();
    expect(usePlannerStore.getState().objects.size).toBe(0);
  });

  it("loadProject sets state from data", () => {
    const objects = [
      {
        id: 5,
        type: "shape" as const,
        name: "S",
        widthM: 1,
        heightM: 1,
        color: "r",
      },
      { id: 8, type: "line" as const, name: "L", lengthM: 3, color: "b" },
    ];
    usePlannerStore.getState().loadProject({
      pixelsPerMeter: 100,
      objects,
    });
    const state = usePlannerStore.getState();
    expect(state.pixelsPerMeter).toBe(100);
    expect(state.objects.size).toBe(2);
    expect(state.objectIdCounter).toBe(9);
  });

  it("reset returns to initial state", () => {
    usePlannerStore.getState().setMode("calibrating");
    usePlannerStore.getState().setPixelsPerMeter(50);
    usePlannerStore.getState().reset();
    const state = usePlannerStore.getState();
    expect(state.mode).toBe("normal");
    expect(state.pixelsPerMeter).toBeNull();
    expect(state.objects.size).toBe(0);
  });

  it("has historyState in initial state", () => {
    const state = usePlannerStore.getState();
    expect(state.historyState).toEqual({
      canUndo: false,
      canRedo: false,
      undoCount: 0,
      redoCount: 0,
    });
  });

  it("setHistoryState updates history state", () => {
    usePlannerStore.getState().setHistoryState({
      canUndo: true,
      canRedo: false,
      undoCount: 3,
      redoCount: 0,
    });
    const state = usePlannerStore.getState();
    expect(state.historyState.canUndo).toBe(true);
    expect(state.historyState.undoCount).toBe(3);
  });

  it("autoSaveEnabled defaults to true", () => {
    const state = usePlannerStore.getState();
    expect(state.autoSaveEnabled).toBe(true);
  });
});

describe("layerVisibility", () => {
  it("defaults to all layers visible", () => {
    const state = usePlannerStore.getState();
    expect(state.layerVisibility).toEqual({
      background: true,
      masks: true,
      content: true,
    });
  });

  it("setLayerVisibility updates partial visibility", () => {
    usePlannerStore.getState().setLayerVisibility({ content: false });
    const state = usePlannerStore.getState();
    expect(state.layerVisibility).toEqual({
      background: true,
      masks: true,
      content: false,
    });
  });

  it("reset restores all layers visible", () => {
    usePlannerStore.getState().setLayerVisibility({ content: false });
    usePlannerStore.getState().reset();
    expect(usePlannerStore.getState().layerVisibility).toEqual({
      background: true,
      masks: true,
      content: true,
    });
  });
});

describe("layer ordering", () => {
  it("moves content objects up and down in render order", () => {
    usePlannerStore.getState().addObject({
      id: 1,
      type: "shape",
      name: "A",
      widthM: 1,
      heightM: 1,
      color: "r",
    });
    usePlannerStore
      .getState()
      .addObject({ id: 2, type: "line", name: "B", lengthM: 1, color: "b" });
    usePlannerStore.getState().addObject({
      id: 3,
      type: "shape",
      name: "C",
      widthM: 1,
      heightM: 1,
      color: "g",
    });

    usePlannerStore.getState().moveUpInLayer(2);
    expect(usePlannerStore.getState().getRenderOrder()).toEqual([1, 3, 2]);

    usePlannerStore.getState().moveDownInLayer(3);
    expect(usePlannerStore.getState().getRenderOrder()).toEqual([3, 1, 2]);
  });

  it("ignores stale layer entries that do not match object type group", () => {
    usePlannerStore.getState().addObject({
      id: 9,
      type: "shape",
      name: "Shape",
      widthM: 1,
      heightM: 1,
      color: "r",
    });

    usePlannerStore.setState((state) => ({
      layers: {
        ...state.layers,
        background: [{ objectId: 9, zIndex: 0 }],
        content: [{ objectId: 9, zIndex: 1 }],
      },
    }));

    expect(usePlannerStore.getState().getRenderOrder()).toEqual([9]);
  });

  it("heals wrong-group entries when moving a shape", () => {
    usePlannerStore.getState().addObject({
      id: 10,
      type: "shape",
      name: "S1",
      widthM: 1,
      heightM: 1,
      color: "r",
    });
    usePlannerStore.getState().addObject({
      id: 11,
      type: "shape",
      name: "S2",
      widthM: 1,
      heightM: 1,
      color: "g",
    });

    usePlannerStore.setState((state) => ({
      layers: {
        ...state.layers,
        background: [{ objectId: 10, zIndex: 0 }],
        content: [{ objectId: 11, zIndex: 0 }],
      },
    }));

    usePlannerStore.getState().moveUpInLayer(10);
    expect(usePlannerStore.getState().getRenderOrder()).toEqual([11, 10]);
  });
});

describe("selectVisibleObjects", () => {
  it("returns only shapes, lines, overlayImages", () => {
    const shape: ShapeObject = {
      id: 0,
      type: "shape",
      name: "S",
      widthM: 1,
      heightM: 1,
      color: "r",
    };
    const line: LineObject = {
      id: 1,
      type: "line",
      name: "L",
      lengthM: 3,
      color: "b",
    };
    const mask: MaskObject = { id: 2, type: "mask", name: "M" };
    usePlannerStore.getState().addObject(shape);
    usePlannerStore.getState().addObject(line);
    usePlannerStore.getState().addObject(mask);

    const visible = selectVisibleObjects(usePlannerStore.getState());
    expect(visible).toHaveLength(2);
    expect(visible.map((o) => o.type)).toEqual(["shape", "line"]);
  });
});
