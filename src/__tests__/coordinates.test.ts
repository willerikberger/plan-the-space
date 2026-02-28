import { describe, it, expect } from "vitest";
import {
  worldToCanvas,
  canvasToWorld,
  worldLengthToCanvas,
  canvasLengthToWorld,
  worldRectToCanvas,
  createCamera,
  updateCameraViewport,
  cameraFromFabricViewport,
  cameraToFabricViewport,
} from "@/components/canvas/utils/coordinates";
import type { Camera } from "@/lib/types";

// Helper: a standard camera for testing (100 px/m, zoom 1, no pan)
const cam: Camera = {
  pixelsPerMeter: 100,
  zoom: 1,
  panX: 0,
  panY: 0,
  viewportWidth: 800,
  viewportHeight: 600,
};

describe("worldToCanvas", () => {
  it("converts world origin to canvas origin when pan is zero", () => {
    const result = worldToCanvas({ x: 0, y: 0 }, cam);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it("scales by pixelsPerMeter", () => {
    const result = worldToCanvas({ x: 2, y: 3 }, cam);
    expect(result.x).toBe(200);
    expect(result.y).toBe(300);
  });

  it("applies zoom", () => {
    const zoomed: Camera = { ...cam, zoom: 2 };
    const result = worldToCanvas({ x: 1, y: 1 }, zoomed);
    expect(result.x).toBe(200); // 1 * 100 * 2
    expect(result.y).toBe(200);
  });

  it("applies pan offset", () => {
    const panned: Camera = { ...cam, panX: 50, panY: -30 };
    const result = worldToCanvas({ x: 1, y: 1 }, panned);
    expect(result.x).toBe(150); // 1 * 100 + 50
    expect(result.y).toBe(70); // 1 * 100 - 30
  });

  it("handles zoom + pan together", () => {
    const c: Camera = { ...cam, zoom: 2, panX: 10, panY: 20 };
    const result = worldToCanvas({ x: 1.5, y: 2.5 }, c);
    expect(result.x).toBe(1.5 * 100 * 2 + 10); // 310
    expect(result.y).toBe(2.5 * 100 * 2 + 20); // 520
  });

  it("handles negative world coordinates", () => {
    const result = worldToCanvas({ x: -1, y: -2 }, cam);
    expect(result.x).toBe(-100);
    expect(result.y).toBe(-200);
  });
});

describe("canvasToWorld", () => {
  it("converts canvas origin to world origin", () => {
    const result = canvasToWorld(0, 0, cam);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it("divides by pixelsPerMeter", () => {
    const result = canvasToWorld(200, 300, cam);
    expect(result.x).toBe(2);
    expect(result.y).toBe(3);
  });

  it("accounts for zoom", () => {
    const zoomed: Camera = { ...cam, zoom: 2 };
    const result = canvasToWorld(200, 200, zoomed);
    expect(result.x).toBe(1); // 200 / (100 * 2)
    expect(result.y).toBe(1);
  });

  it("accounts for pan", () => {
    const panned: Camera = { ...cam, panX: 50, panY: -30 };
    const result = canvasToWorld(150, 70, panned);
    expect(result.x).toBe(1); // (150 - 50) / 100
    expect(result.y).toBe(1); // (70 + 30) / 100
  });

  it("round-trips with worldToCanvas", () => {
    const c: Camera = { ...cam, zoom: 1.5, panX: -42, panY: 77 };
    const world = { x: 3.7, y: -1.2 };
    const canvas = worldToCanvas(world, c);
    const back = canvasToWorld(canvas.x, canvas.y, c);
    expect(back.x).toBeCloseTo(world.x, 10);
    expect(back.y).toBeCloseTo(world.y, 10);
  });
});

describe("worldLengthToCanvas", () => {
  it("scales meters to pixels", () => {
    expect(worldLengthToCanvas(2, cam)).toBe(200);
  });

  it("applies zoom", () => {
    const zoomed: Camera = { ...cam, zoom: 3 };
    expect(worldLengthToCanvas(2, zoomed)).toBe(600);
  });
});

describe("canvasLengthToWorld", () => {
  it("converts pixels to meters", () => {
    expect(canvasLengthToWorld(200, cam)).toBe(2);
  });

  it("accounts for zoom", () => {
    const zoomed: Camera = { ...cam, zoom: 2 };
    expect(canvasLengthToWorld(400, zoomed)).toBe(2);
  });

  it("round-trips with worldLengthToCanvas", () => {
    const c: Camera = { ...cam, zoom: 2.5 };
    const meters = 4.2;
    const px = worldLengthToCanvas(meters, c);
    expect(canvasLengthToWorld(px, c)).toBeCloseTo(meters, 10);
  });
});

describe("worldRectToCanvas", () => {
  it("converts world rect to canvas rect", () => {
    const result = worldRectToCanvas(1, 2, 3, 4, cam);
    expect(result.left).toBe(100);
    expect(result.top).toBe(200);
    expect(result.width).toBe(300);
    expect(result.height).toBe(400);
  });

  it("applies zoom", () => {
    const zoomed: Camera = { ...cam, zoom: 2 };
    const result = worldRectToCanvas(1, 1, 2, 3, zoomed);
    expect(result.left).toBe(200);
    expect(result.top).toBe(200);
    expect(result.width).toBe(400);
    expect(result.height).toBe(600);
  });

  it("applies pan", () => {
    const panned: Camera = { ...cam, panX: 50, panY: 100 };
    const result = worldRectToCanvas(1, 1, 2, 2, panned);
    expect(result.left).toBe(150); // 1 * 100 + 50
    expect(result.top).toBe(200); // 1 * 100 + 100
  });
});

describe("createCamera", () => {
  it("creates a camera with default zoom and zero pan", () => {
    const c = createCamera(100, 800, 600);
    expect(c.pixelsPerMeter).toBe(100);
    expect(c.zoom).toBe(1);
    expect(c.panX).toBe(0);
    expect(c.panY).toBe(0);
    expect(c.viewportWidth).toBe(800);
    expect(c.viewportHeight).toBe(600);
  });
});

describe("updateCameraViewport", () => {
  it("updates viewport dimensions", () => {
    const c = createCamera(100, 800, 600);
    const updated = updateCameraViewport(c, 1024, 768);
    expect(updated.viewportWidth).toBe(1024);
    expect(updated.viewportHeight).toBe(768);
  });

  it("preserves zoom and pan", () => {
    const c: Camera = { ...cam, zoom: 2, panX: 50, panY: -30 };
    const updated = updateCameraViewport(c, 1024, 768);
    expect(updated.zoom).toBe(2);
    expect(updated.panX).toBe(50);
    expect(updated.panY).toBe(-30);
    expect(updated.pixelsPerMeter).toBe(100);
  });
});

describe("cameraFromFabricViewport", () => {
  it("extracts camera from Fabric viewport transform", () => {
    const vpt = [2, 0, 0, 2, 50, -30]; // zoom=2, panX=50, panY=-30
    const c = cameraFromFabricViewport(vpt, 100, 800, 600);
    expect(c.zoom).toBe(2);
    expect(c.panX).toBe(50);
    expect(c.panY).toBe(-30);
    expect(c.pixelsPerMeter).toBe(100);
    expect(c.viewportWidth).toBe(800);
    expect(c.viewportHeight).toBe(600);
  });

  it("handles identity viewport", () => {
    const vpt = [1, 0, 0, 1, 0, 0];
    const c = cameraFromFabricViewport(vpt, 50, 400, 300);
    expect(c.zoom).toBe(1);
    expect(c.panX).toBe(0);
    expect(c.panY).toBe(0);
  });
});

describe("cameraToFabricViewport", () => {
  it("converts camera to Fabric viewport transform", () => {
    const c: Camera = { ...cam, zoom: 2.5, panX: 100, panY: -50 };
    const vpt = cameraToFabricViewport(c);
    expect(vpt).toEqual([2.5, 0, 0, 2.5, 100, -50]);
  });

  it("round-trips with cameraFromFabricViewport", () => {
    const original: Camera = {
      pixelsPerMeter: 75,
      zoom: 1.8,
      panX: -42,
      panY: 77,
      viewportWidth: 1920,
      viewportHeight: 1080,
    };
    const vpt = cameraToFabricViewport(original);
    const back = cameraFromFabricViewport(
      vpt,
      original.pixelsPerMeter,
      original.viewportWidth,
      original.viewportHeight,
    );
    expect(back.zoom).toBeCloseTo(original.zoom, 10);
    expect(back.panX).toBeCloseTo(original.panX, 10);
    expect(back.panY).toBeCloseTo(original.panY, 10);
    expect(back.pixelsPerMeter).toBe(original.pixelsPerMeter);
    expect(back.viewportWidth).toBe(original.viewportWidth);
    expect(back.viewportHeight).toBe(original.viewportHeight);
  });
});
