import { describe, it, expect, beforeEach, vi } from "vitest";
import { usePlannerStore } from "@/lib/store";
import {
  getFabricState,
  clearCanvas,
  deleteObject,
  reorderObjects,
  loadProjectFromData,
} from "@/components/canvas/utils/canvasOrchestration";
import type {
  ShapeFabricRefs,
  LineFabricRefs,
  MaskFabricRefs,
  ImageFabricRefs,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers: lightweight mocks for Fabric objects and Canvas
// `as any` is used extensively below because we need lightweight mock objects
// that satisfy Fabric type shapes without importing the full Fabric library.
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */

type AnyFabricRefs =
  | ShapeFabricRefs
  | LineFabricRefs
  | MaskFabricRefs
  | ImageFabricRefs;

function makeRefsRef(entries: [number, AnyFabricRefs][] = []) {
  return { current: new Map<number, AnyFabricRefs>(entries) };
}

function makeBgRef(value: unknown = null) {
  return { current: value } as React.MutableRefObject<any>;
}

/** Minimal mock of a Fabric Canvas with the methods used by the orchestration functions. */
function mockCanvas() {
  return {
    remove: vi.fn(),
    moveObjectTo: vi.fn(),
    renderAll: vi.fn(),
  } as unknown as import("fabric").Canvas;
}

/** Minimal shape fabric refs (rect + label + dims). */
function mockShapeRefs(
  overrides: Record<string, unknown> = {},
): ShapeFabricRefs {
  return {
    rect: {
      left: 100,
      top: 200,
      scaleX: 1,
      scaleY: 1,
      angle: 0,
      width: 80,
      height: 60,
      baseWidthPx: 80,
      baseHeightPx: 60,
      ...overrides,
    } as any,
    label: { text: "Label" } as any,
    dims: { text: "2m x 3m" } as any,
  };
}

/** Minimal line fabric refs (line + label). */
function mockLineRefs(overrides: Record<string, unknown> = {}): LineFabricRefs {
  return {
    line: {
      left: 50,
      top: 50,
      scaleX: 1,
      scaleY: 1,
      angle: 0,
      x1: 0,
      y1: 0,
      x2: 200,
      y2: 0,
      strokeWidth: 3,
      ...overrides,
    } as any,
    label: { text: "5m" } as any,
  };
}

/** Minimal mask fabric refs (rect only, no label). */
function mockMaskRefs(overrides: Record<string, unknown> = {}): MaskFabricRefs {
  return {
    rect: {
      left: 10,
      top: 20,
      scaleX: 1,
      scaleY: 1,
      angle: 0,
      width: 120,
      height: 90,
      ...overrides,
    } as any,
  };
}

/** Minimal image fabric refs. */
function mockImageRefs(
  overrides: Record<string, unknown> = {},
): ImageFabricRefs {
  return {
    image: {
      left: 0,
      top: 0,
      scaleX: 1,
      scaleY: 1,
      angle: 0,
      originX: "left",
      originY: "top",
      ...overrides,
    } as any,
  };
}

// ---------------------------------------------------------------------------
// Reset the Zustand store between tests
// ---------------------------------------------------------------------------
beforeEach(() => {
  usePlannerStore.getState().reset();
});

// ---------------------------------------------------------------------------
// getFabricState
// ---------------------------------------------------------------------------
describe("getFabricState", () => {
  it("returns null when id is not in the refs map", () => {
    const refsRef = makeRefsRef();
    expect(getFabricState(999, refsRef)).toBeNull();
  });

  it("serializes a shape (rect + label + dims)", () => {
    const shapeRefs = mockShapeRefs({
      left: 150,
      top: 250,
      scaleX: 1.5,
      scaleY: 2,
      angle: 45,
      width: 100,
      height: 80,
    });
    // Attach baseWidthPx/baseHeightPx as custom props on the rect
    (shapeRefs.rect as any).baseWidthPx = 100;
    (shapeRefs.rect as any).baseHeightPx = 80;

    const refsRef = makeRefsRef([[1, shapeRefs]]);
    const result = getFabricState(1, refsRef);

    expect(result).not.toBeNull();
    expect(result!.left).toBe(150);
    expect(result!.top).toBe(250);
    expect(result!.scaleX).toBe(1.5);
    expect(result!.scaleY).toBe(2);
    expect(result!.angle).toBe(45);
    expect(result!.width).toBe(100);
    expect(result!.height).toBe(80);
    expect(result!.baseWidthPx).toBe(100);
    expect(result!.baseHeightPx).toBe(80);
  });

  it("serializes a mask (rect without label)", () => {
    const maskRefs = mockMaskRefs({
      left: 30,
      top: 40,
      width: 200,
      height: 150,
    });
    const refsRef = makeRefsRef([[2, maskRefs]]);
    const result = getFabricState(2, refsRef);

    expect(result).not.toBeNull();
    expect(result!.left).toBe(30);
    expect(result!.top).toBe(40);
    expect(result!.width).toBe(200);
    expect(result!.height).toBe(150);
    // mask should not have baseWidthPx / baseHeightPx
    expect(result!.baseWidthPx).toBeUndefined();
    expect(result!.baseHeightPx).toBeUndefined();
  });

  it("serializes a line", () => {
    const lineRefs = mockLineRefs({
      left: 10,
      top: 20,
      x1: 0,
      y1: 0,
      x2: 300,
      y2: 150,
      strokeWidth: 5,
    });
    const refsRef = makeRefsRef([[3, lineRefs]]);
    const result = getFabricState(3, refsRef);

    expect(result).not.toBeNull();
    expect(result!.left).toBe(10);
    expect(result!.top).toBe(20);
    expect(result!.x1).toBe(0);
    expect(result!.y1).toBe(0);
    expect(result!.x2).toBe(300);
    expect(result!.y2).toBe(150);
    expect(result!.strokeWidth).toBe(5);
  });

  it("serializes an image", () => {
    const imgRefs = mockImageRefs({
      left: 5,
      top: 10,
      scaleX: 0.5,
      scaleY: 0.5,
      angle: 90,
      originX: "center",
      originY: "center",
    });
    const refsRef = makeRefsRef([[4, imgRefs]]);
    const result = getFabricState(4, refsRef);

    expect(result).not.toBeNull();
    expect(result!.left).toBe(5);
    expect(result!.top).toBe(10);
    expect(result!.scaleX).toBe(0.5);
    expect(result!.scaleY).toBe(0.5);
    expect(result!.angle).toBe(90);
    expect(result!.originX).toBe("center");
    expect(result!.originY).toBe("center");
  });

  it("defaults left/top to 0 and scaleX/scaleY to 1 when undefined", () => {
    const shapeRefs = mockShapeRefs();
    (shapeRefs.rect as any).left = undefined;
    (shapeRefs.rect as any).top = undefined;
    (shapeRefs.rect as any).scaleX = undefined;
    (shapeRefs.rect as any).scaleY = undefined;
    (shapeRefs.rect as any).angle = undefined;

    const refsRef = makeRefsRef([[5, shapeRefs]]);
    const result = getFabricState(5, refsRef);

    expect(result).not.toBeNull();
    expect(result!.left).toBe(0);
    expect(result!.top).toBe(0);
    expect(result!.scaleX).toBe(1);
    expect(result!.scaleY).toBe(1);
    expect(result!.angle).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// clearCanvas
// ---------------------------------------------------------------------------
describe("clearCanvas", () => {
  it("removes all tracked objects from canvas and clears refs", () => {
    const canvas = mockCanvas();
    const shapeRefs = mockShapeRefs();
    const lineRefs = mockLineRefs();
    const refsRef = makeRefsRef([
      [1, shapeRefs],
      [2, lineRefs],
    ]);
    const bgRef = makeBgRef(null);

    // Seed the store with objects so clearObjects has something to clear
    usePlannerStore
      .getState()
      .addObject({
        id: 1,
        type: "shape",
        name: "S",
        widthM: 1,
        heightM: 1,
        color: "r",
      });
    usePlannerStore
      .getState()
      .addObject({ id: 2, type: "line", name: "L", lengthM: 3, color: "b" });

    clearCanvas(canvas, refsRef, bgRef);

    // All fabric objects should have been removed
    expect(canvas.remove).toHaveBeenCalled();
    // refs map should be empty
    expect(refsRef.current.size).toBe(0);
    // store should be cleared
    expect(usePlannerStore.getState().objects.size).toBe(0);
  });

  it("removes background image when present", () => {
    const canvas = mockCanvas();
    const refsRef = makeRefsRef();
    const bgImage = { type: "image" } as any;
    const bgRef = makeBgRef(bgImage);

    clearCanvas(canvas, refsRef, bgRef);

    expect(canvas.remove).toHaveBeenCalledWith(bgImage);
    expect(bgRef.current).toBeNull();
  });

  it("handles empty refs gracefully", () => {
    const canvas = mockCanvas();
    const refsRef = makeRefsRef();
    const bgRef = makeBgRef(null);

    clearCanvas(canvas, refsRef, bgRef);

    expect(refsRef.current.size).toBe(0);
  });

  it("removes rect, label, and dims for shapes", () => {
    const canvas = mockCanvas();
    const shapeRefs = mockShapeRefs();
    const refsRef = makeRefsRef([[1, shapeRefs]]);
    const bgRef = makeBgRef(null);

    clearCanvas(canvas, refsRef, bgRef);

    expect(canvas.remove).toHaveBeenCalledWith(shapeRefs.rect);
    expect(canvas.remove).toHaveBeenCalledWith(shapeRefs.label);
    expect(canvas.remove).toHaveBeenCalledWith(shapeRefs.dims);
  });

  it("removes line and label for line refs", () => {
    const canvas = mockCanvas();
    const lineRefs = mockLineRefs();
    const refsRef = makeRefsRef([[2, lineRefs]]);
    const bgRef = makeBgRef(null);

    clearCanvas(canvas, refsRef, bgRef);

    expect(canvas.remove).toHaveBeenCalledWith(lineRefs.line);
    expect(canvas.remove).toHaveBeenCalledWith(lineRefs.label);
  });

  it("removes image for image refs", () => {
    const canvas = mockCanvas();
    const imgRefs = mockImageRefs();
    const refsRef = makeRefsRef([[3, imgRefs]]);
    const bgRef = makeBgRef(null);

    clearCanvas(canvas, refsRef, bgRef);

    expect(canvas.remove).toHaveBeenCalledWith(imgRefs.image);
  });
});

// ---------------------------------------------------------------------------
// deleteObject
// ---------------------------------------------------------------------------
describe("deleteObject", () => {
  it("removes a shape and all its sub-objects from canvas", () => {
    const canvas = mockCanvas();
    const shapeRefs = mockShapeRefs();
    const refsRef = makeRefsRef([[1, shapeRefs]]);

    usePlannerStore
      .getState()
      .addObject({
        id: 1,
        type: "shape",
        name: "S",
        widthM: 1,
        heightM: 1,
        color: "r",
      });

    deleteObject(1, canvas, refsRef);

    expect(canvas.remove).toHaveBeenCalledWith(shapeRefs.rect);
    expect(canvas.remove).toHaveBeenCalledWith(shapeRefs.label);
    expect(canvas.remove).toHaveBeenCalledWith(shapeRefs.dims);
    expect(refsRef.current.has(1)).toBe(false);
    expect(usePlannerStore.getState().objects.has(1)).toBe(false);
    expect(canvas.renderAll).toHaveBeenCalled();
  });

  it("removes a line and its label from canvas", () => {
    const canvas = mockCanvas();
    const lineRefs = mockLineRefs();
    const refsRef = makeRefsRef([[2, lineRefs]]);

    usePlannerStore
      .getState()
      .addObject({ id: 2, type: "line", name: "L", lengthM: 3, color: "b" });

    deleteObject(2, canvas, refsRef);

    expect(canvas.remove).toHaveBeenCalledWith(lineRefs.line);
    expect(canvas.remove).toHaveBeenCalledWith(lineRefs.label);
    expect(refsRef.current.has(2)).toBe(false);
    expect(usePlannerStore.getState().objects.has(2)).toBe(false);
  });

  it("removes a mask from canvas", () => {
    const canvas = mockCanvas();
    const maskRefs = mockMaskRefs();
    const refsRef = makeRefsRef([[3, maskRefs]]);

    usePlannerStore.getState().addObject({ id: 3, type: "mask", name: "M" });

    deleteObject(3, canvas, refsRef);

    expect(canvas.remove).toHaveBeenCalledWith(maskRefs.rect);
    expect(refsRef.current.has(3)).toBe(false);
    expect(usePlannerStore.getState().objects.has(3)).toBe(false);
  });

  it("removes an image from canvas", () => {
    const canvas = mockCanvas();
    const imgRefs = mockImageRefs();
    const refsRef = makeRefsRef([[4, imgRefs]]);

    usePlannerStore
      .getState()
      .addObject({
        id: 4,
        type: "overlayImage",
        name: "OI",
        imageData: "data:test",
      });

    deleteObject(4, canvas, refsRef);

    expect(canvas.remove).toHaveBeenCalledWith(imgRefs.image);
    expect(refsRef.current.has(4)).toBe(false);
    expect(usePlannerStore.getState().objects.has(4)).toBe(false);
  });

  it("handles deleting non-existent id gracefully", () => {
    const canvas = mockCanvas();
    const refsRef = makeRefsRef();

    // Should not throw
    deleteObject(999, canvas, refsRef);

    // removeObject on the store is still called (it is a no-op if not present)
    expect(canvas.renderAll).toHaveBeenCalled();
  });

  it("does not remove other objects from the refs map", () => {
    const canvas = mockCanvas();
    const shapeRefs = mockShapeRefs();
    const lineRefs = mockLineRefs();
    const refsRef = makeRefsRef([
      [1, shapeRefs],
      [2, lineRefs],
    ]);

    usePlannerStore
      .getState()
      .addObject({
        id: 1,
        type: "shape",
        name: "S",
        widthM: 1,
        heightM: 1,
        color: "r",
      });
    usePlannerStore
      .getState()
      .addObject({ id: 2, type: "line", name: "L", lengthM: 3, color: "b" });

    deleteObject(1, canvas, refsRef);

    expect(refsRef.current.has(1)).toBe(false);
    expect(refsRef.current.has(2)).toBe(true);
    expect(usePlannerStore.getState().objects.has(2)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// reorderObjects
// ---------------------------------------------------------------------------
describe("reorderObjects", () => {
  it("moves background image to index 0", () => {
    const canvas = mockCanvas();
    const refsRef = makeRefsRef();
    const bgImage = { type: "image" } as any;
    const bgRef = makeBgRef(bgImage);

    reorderObjects(canvas, refsRef, bgRef);

    expect(canvas.moveObjectTo).toHaveBeenCalledWith(bgImage, 0);
    expect(canvas.renderAll).toHaveBeenCalled();
  });

  it("moves masks after background, then background images", () => {
    const canvas = mockCanvas();
    const maskRefs = mockMaskRefs();
    const imgRefs = mockImageRefs();
    const refsRef = makeRefsRef([
      [1, maskRefs],
      [2, imgRefs],
    ]);
    const bgRef = makeBgRef(null);

    // Add to store
    usePlannerStore.getState().addObject({ id: 1, type: "mask", name: "M" });
    usePlannerStore
      .getState()
      .addObject({
        id: 2,
        type: "backgroundImage",
        name: "BG",
        imageData: "data:bg",
      });

    reorderObjects(canvas, refsRef, bgRef);

    // Mask should be moved to index 0 (no background image present)
    expect(canvas.moveObjectTo).toHaveBeenCalledWith(maskRefs.rect, 0);
    // Background image object to index 1
    expect(canvas.moveObjectTo).toHaveBeenCalledWith(imgRefs.image, 1);
    expect(canvas.renderAll).toHaveBeenCalled();
  });

  it("orders: bg image (0), masks (1+), bg objects (after masks)", () => {
    const canvas = mockCanvas();
    const bgImage = { type: "image" } as any;
    const maskRefs = mockMaskRefs();
    const imgRefs = mockImageRefs();
    const refsRef = makeRefsRef([
      [1, maskRefs],
      [2, imgRefs],
    ]);
    const bgRef = makeBgRef(bgImage);

    usePlannerStore.getState().addObject({ id: 1, type: "mask", name: "M" });
    usePlannerStore
      .getState()
      .addObject({
        id: 2,
        type: "backgroundImage",
        name: "BG",
        imageData: "data:bg",
      });

    reorderObjects(canvas, refsRef, bgRef);

    const calls = (canvas.moveObjectTo as ReturnType<typeof vi.fn>).mock.calls;
    // bg image at 0
    expect(calls[0]).toEqual([bgImage, 0]);
    // mask at 1
    expect(calls[1]).toEqual([maskRefs.rect, 1]);
    // backgroundImage object at 2
    expect(calls[2]).toEqual([imgRefs.image, 2]);
  });

  it("handles no background and no masks gracefully", () => {
    const canvas = mockCanvas();
    const refsRef = makeRefsRef();
    const bgRef = makeBgRef(null);

    reorderObjects(canvas, refsRef, bgRef);

    expect(canvas.moveObjectTo).not.toHaveBeenCalled();
    expect(canvas.renderAll).toHaveBeenCalled();
  });

  it("does not reorder shapes or lines", () => {
    const canvas = mockCanvas();
    const shapeRefs = mockShapeRefs();
    const lineRefs = mockLineRefs();
    const refsRef = makeRefsRef([
      [1, shapeRefs],
      [2, lineRefs],
    ]);
    const bgRef = makeBgRef(null);

    usePlannerStore
      .getState()
      .addObject({
        id: 1,
        type: "shape",
        name: "S",
        widthM: 1,
        heightM: 1,
        color: "r",
      });
    usePlannerStore
      .getState()
      .addObject({ id: 2, type: "line", name: "L", lengthM: 3, color: "b" });

    reorderObjects(canvas, refsRef, bgRef);

    // moveObjectTo should not be called for shapes or lines
    expect(canvas.moveObjectTo).not.toHaveBeenCalled();
    expect(canvas.renderAll).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// loadProjectFromData
// ---------------------------------------------------------------------------
describe("loadProjectFromData", () => {
  it("dispatches each object to the correct loader hook", async () => {
    const canvas = mockCanvas();
    const refsRef = makeRefsRef();
    const bgRef = makeBgRef(null);

    const hooks = {
      loadShape: vi.fn(),
      loadLine: vi.fn(),
      loadMask: vi.fn(),
      loadImageObject: vi.fn().mockResolvedValue(undefined),
    };

    const objects = [
      {
        id: 0,
        type: "shape" as const,
        name: "S",
        left: 0,
        top: 0,
        scaleX: 1,
        scaleY: 1,
        angle: 0,
        widthM: 1,
        heightM: 1,
        color: "r",
        baseWidthPx: 50,
        baseHeightPx: 50,
        width: 50,
        height: 50,
      },
      {
        id: 1,
        type: "line" as const,
        name: "L",
        left: 0,
        top: 0,
        scaleX: 1,
        scaleY: 1,
        angle: 0,
        x1: 0,
        y1: 0,
        x2: 100,
        y2: 0,
        lengthM: 3,
        color: "b",
        strokeWidth: 3,
      },
      {
        id: 2,
        type: "mask" as const,
        name: "M",
        left: 0,
        top: 0,
        scaleX: 1,
        scaleY: 1,
        angle: 0,
        width: 100,
        height: 80,
      },
      {
        id: 3,
        type: "backgroundImage" as const,
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
        type: "overlayImage" as const,
        name: "OI",
        left: 0,
        top: 0,
        scaleX: 1,
        scaleY: 1,
        angle: 0,
        imageData: "data:oi",
        originX: "left",
        originY: "top",
      },
    ];

    await loadProjectFromData(objects, canvas, refsRef, bgRef, hooks);

    expect(hooks.loadShape).toHaveBeenCalledTimes(1);
    expect(hooks.loadLine).toHaveBeenCalledTimes(1);
    expect(hooks.loadMask).toHaveBeenCalledTimes(1);
    // backgroundImage + overlayImage both go through loadImageObject
    expect(hooks.loadImageObject).toHaveBeenCalledTimes(2);
    expect(canvas.renderAll).toHaveBeenCalled();
  });

  it("calls reorder and renderAll after loading", async () => {
    const canvas = mockCanvas();
    const refsRef = makeRefsRef();
    const bgRef = makeBgRef(null);
    const hooks = {
      loadShape: vi.fn(),
      loadLine: vi.fn(),
      loadMask: vi.fn(),
      loadImageObject: vi.fn().mockResolvedValue(undefined),
    };

    await loadProjectFromData([], canvas, refsRef, bgRef, hooks);

    // renderAll is called by both reorderObjects and loadProjectFromData itself
    expect(canvas.renderAll).toHaveBeenCalled();
  });
});
