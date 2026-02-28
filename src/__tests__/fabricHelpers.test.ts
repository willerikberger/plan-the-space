import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  getFabricProp,
  setFabricProps,
  createMeasuredRect,
  createMeasuredLine,
  createCalibrationLine,
  createCalibrationEndpoint,
  createMaskRect,
} from "@/components/canvas/utils/fabricHelpers";
import { THEME } from "@/lib/constants";
import type { FabricObject } from "fabric";

beforeEach(() => {
  vi.restoreAllMocks();
});

// ============================================
// getFabricProp / setFabricProps
// ============================================

describe("getFabricProp", () => {
  it("reads a custom property from a Fabric object", () => {
    const obj = {
      objectId: 42,
      objectType: "shape",
    } as unknown as FabricObject;
    expect(getFabricProp(obj, "objectId")).toBe(42);
    expect(getFabricProp(obj, "objectType")).toBe("shape");
  });

  it("returns undefined for unset custom properties", () => {
    const obj = {} as unknown as FabricObject;
    expect(getFabricProp(obj, "objectId")).toBeUndefined();
    expect(getFabricProp(obj, "shapeName")).toBeUndefined();
  });

  it("reads all defined FabricCustomProps keys", () => {
    const obj = {
      objectId: 1,
      objectType: "line",
      parentId: 5,
      shapeName: "Table",
      shapeWidthM: 2.5,
      shapeHeightM: 1.5,
      shapeColor: "red",
      baseWidthPx: 100,
      baseHeightPx: 60,
      imageData: "data:test",
      imageDataRef: "hash123",
      lineName: "Wall",
      lineColor: "blue",
      lengthM: 3.0,
    } as unknown as FabricObject;

    expect(getFabricProp(obj, "objectId")).toBe(1);
    expect(getFabricProp(obj, "parentId")).toBe(5);
    expect(getFabricProp(obj, "shapeName")).toBe("Table");
    expect(getFabricProp(obj, "shapeWidthM")).toBe(2.5);
    expect(getFabricProp(obj, "shapeHeightM")).toBe(1.5);
    expect(getFabricProp(obj, "shapeColor")).toBe("red");
    expect(getFabricProp(obj, "baseWidthPx")).toBe(100);
    expect(getFabricProp(obj, "baseHeightPx")).toBe(60);
    expect(getFabricProp(obj, "imageData")).toBe("data:test");
    expect(getFabricProp(obj, "imageDataRef")).toBe("hash123");
    expect(getFabricProp(obj, "lineName")).toBe("Wall");
    expect(getFabricProp(obj, "lineColor")).toBe("blue");
    expect(getFabricProp(obj, "lengthM")).toBe(3.0);
  });
});

describe("setFabricProps", () => {
  it("writes custom properties onto a Fabric object", () => {
    const obj = {} as unknown as FabricObject;
    setFabricProps(obj, {
      objectId: 10,
      objectType: "shape",
      shapeName: "Chair",
    });

    expect(getFabricProp(obj, "objectId")).toBe(10);
    expect(getFabricProp(obj, "objectType")).toBe("shape");
    expect(getFabricProp(obj, "shapeName")).toBe("Chair");
  });

  it("overwrites existing custom properties", () => {
    const obj = { objectId: 1, shapeName: "Old" } as unknown as FabricObject;
    setFabricProps(obj, { objectId: 2, shapeName: "New" });

    expect(getFabricProp(obj, "objectId")).toBe(2);
    expect(getFabricProp(obj, "shapeName")).toBe("New");
  });

  it("does not remove properties not included in the update", () => {
    const obj = { objectId: 1, shapeName: "Desk" } as unknown as FabricObject;
    setFabricProps(obj, { objectId: 99 });

    expect(getFabricProp(obj, "objectId")).toBe(99);
    expect(getFabricProp(obj, "shapeName")).toBe("Desk");
  });

  it("can set multiple properties at once", () => {
    const obj = {} as unknown as FabricObject;
    setFabricProps(obj, {
      objectId: 5,
      baseWidthPx: 200,
      baseHeightPx: 150,
      shapeColor: "green",
    });

    expect(getFabricProp(obj, "objectId")).toBe(5);
    expect(getFabricProp(obj, "baseWidthPx")).toBe(200);
    expect(getFabricProp(obj, "baseHeightPx")).toBe(150);
    expect(getFabricProp(obj, "shapeColor")).toBe("green");
  });
});

// ============================================
// Self-labeling shape factory (MeasuredRect)
// ============================================

describe("createMeasuredRect", () => {
  it("creates a MeasuredRect with correct standard properties", () => {
    const rect = createMeasuredRect({
      left: 100,
      top: 200,
      width: 80,
      height: 60,
      fill: "rgba(76, 175, 80, 0.6)",
      stroke: "rgba(76, 175, 80, 1)",
      objectId: 1,
      shapeName: "Garden",
      shapeWidthM: 2,
      shapeHeightM: 3,
      baseWidthPx: 80,
      baseHeightPx: 60,
    });

    expect(rect.left).toBe(100);
    expect(rect.top).toBe(200);
    expect(rect.width).toBe(80);
    expect(rect.height).toBe(60);
    expect(rect.fill).toBe("rgba(76, 175, 80, 0.6)");
    expect(rect.stroke).toBe("rgba(76, 175, 80, 1)");
    expect(rect.strokeWidth).toBe(2);
    expect(rect.rx).toBe(4);
    expect(rect.ry).toBe(4);
  });

  it("stores custom properties on the rect", () => {
    const rect = createMeasuredRect({
      left: 0,
      top: 0,
      width: 50,
      height: 50,
      fill: "red",
      stroke: "red",
      objectId: 7,
      shapeName: "Patio",
      shapeWidthM: 4,
      shapeHeightM: 5,
      baseWidthPx: 50,
      baseHeightPx: 50,
    });

    expect(getFabricProp(rect as unknown as FabricObject, "objectId")).toBe(7);
    expect(getFabricProp(rect as unknown as FabricObject, "objectType")).toBe(
      "shape",
    );
    expect(getFabricProp(rect as unknown as FabricObject, "shapeName")).toBe(
      "Patio",
    );
    expect(getFabricProp(rect as unknown as FabricObject, "shapeWidthM")).toBe(
      4,
    );
    expect(getFabricProp(rect as unknown as FabricObject, "shapeHeightM")).toBe(
      5,
    );
    expect(getFabricProp(rect as unknown as FabricObject, "shapeColor")).toBe(
      "red",
    );
    expect(getFabricProp(rect as unknown as FabricObject, "baseWidthPx")).toBe(
      50,
    );
    expect(getFabricProp(rect as unknown as FabricObject, "baseHeightPx")).toBe(
      50,
    );
  });

  it("sets self-labeling properties (label, widthM, heightM)", () => {
    const rect = createMeasuredRect({
      left: 0,
      top: 0,
      width: 50,
      height: 50,
      fill: "blue",
      stroke: "blue",
      objectId: 0,
      shapeName: "Deck",
      shapeWidthM: 3,
      shapeHeightM: 4,
      baseWidthPx: 50,
      baseHeightPx: 50,
    });

    expect(rect.label).toBe("Deck");
    expect(rect.widthM).toBe(3);
    expect(rect.heightM).toBe(4);
  });

  it("defaults scaleX, scaleY to 1 and angle to 0", () => {
    const rect = createMeasuredRect({
      left: 0,
      top: 0,
      width: 50,
      height: 50,
      fill: "blue",
      stroke: "blue",
      objectId: 0,
      shapeName: "A",
      shapeWidthM: 1,
      shapeHeightM: 1,
      baseWidthPx: 50,
      baseHeightPx: 50,
    });

    expect(rect.scaleX).toBe(1);
    expect(rect.scaleY).toBe(1);
    expect(rect.angle).toBe(0);
  });

  it("applies explicit scaleX, scaleY, and angle", () => {
    const rect = createMeasuredRect({
      left: 10,
      top: 20,
      width: 50,
      height: 50,
      fill: "blue",
      stroke: "blue",
      scaleX: 2,
      scaleY: 3,
      angle: 45,
      objectId: 0,
      shapeName: "B",
      shapeWidthM: 1,
      shapeHeightM: 1,
      baseWidthPx: 50,
      baseHeightPx: 50,
    });

    expect(rect.scaleX).toBe(2);
    expect(rect.scaleY).toBe(3);
    expect(rect.angle).toBe(45);
  });
});

// ============================================
// Calibration factories
// ============================================

describe("createCalibrationLine", () => {
  it("creates a dashed calibration line", () => {
    const line = createCalibrationLine({ x1: 10, y1: 20, x2: 300, y2: 400 });

    expect(line.x1).toBe(10);
    expect(line.y1).toBe(20);
    expect(line.x2).toBe(300);
    expect(line.y2).toBe(400);
    expect(line.stroke).toBe(THEME.calibration);
    expect(line.strokeWidth).toBe(3);
    expect(line.selectable).toBe(false);
    expect(line.evented).toBe(false);
    expect(line.strokeDashArray).toEqual([5, 5]);
  });
});

describe("createCalibrationEndpoint", () => {
  it("creates a circle centered on the given point", () => {
    const circle = createCalibrationEndpoint(100, 200);

    // Circle is positioned with left = x - 5, top = y - 5
    expect(circle.left).toBe(95);
    expect(circle.top).toBe(195);
    expect(circle.radius).toBe(5);
    expect(circle.fill).toBe(THEME.calibration);
    expect(circle.selectable).toBe(false);
    expect(circle.evented).toBe(false);
  });

  it("handles origin (0, 0)", () => {
    const circle = createCalibrationEndpoint(0, 0);
    expect(circle.left).toBe(-5);
    expect(circle.top).toBe(-5);
  });

  it("handles negative coordinates", () => {
    const circle = createCalibrationEndpoint(-10, -20);
    expect(circle.left).toBe(-15);
    expect(circle.top).toBe(-25);
  });
});

// ============================================
// Self-labeling line factory (MeasuredLine)
// ============================================

describe("createMeasuredLine", () => {
  it("creates a line with given stroke properties", () => {
    const line = createMeasuredLine({
      x1: 0,
      y1: 0,
      x2: 200,
      y2: 150,
      stroke: "rgba(244, 67, 54, 1)",
      strokeWidth: 5,
      label: "5.2m",
      lengthM: 5.2,
    });

    expect(line.x1).toBe(0);
    expect(line.y1).toBe(0);
    expect(line.x2).toBe(200);
    expect(line.y2).toBe(150);
    expect(line.stroke).toBe("rgba(244, 67, 54, 1)");
    expect(line.strokeWidth).toBe(5);
    expect(line.selectable).toBe(false);
    expect(line.evented).toBe(false);
    expect(line.strokeLineCap).toBe("round");
  });

  it("sets self-labeling properties (label, lengthM, labelColor)", () => {
    const line = createMeasuredLine({
      x1: 0,
      y1: 0,
      x2: 100,
      y2: 0,
      stroke: "red",
      strokeWidth: 3,
      label: "3.0m",
      lengthM: 3.0,
    });

    expect(line.label).toBe("3.0m");
    expect(line.lengthM).toBe(3.0);
    expect(line.labelColor).toBe("red");
  });

  it("stores custom properties when objectId is provided", () => {
    const line = createMeasuredLine({
      x1: 0,
      y1: 0,
      x2: 100,
      y2: 0,
      stroke: "blue",
      strokeWidth: 3,
      label: "2.5m",
      lengthM: 2.5,
      objectId: 7,
      lineName: "Wall",
      lineColor: "blue",
    });

    expect(getFabricProp(line as unknown as FabricObject, "objectId")).toBe(7);
    expect(getFabricProp(line as unknown as FabricObject, "objectType")).toBe(
      "line",
    );
    expect(getFabricProp(line as unknown as FabricObject, "lineName")).toBe(
      "Wall",
    );
    expect(getFabricProp(line as unknown as FabricObject, "lineColor")).toBe(
      "blue",
    );
  });

  it("defaults scaleX, scaleY to 1 and angle to 0", () => {
    const line = createMeasuredLine({
      x1: 0,
      y1: 0,
      x2: 50,
      y2: 0,
      stroke: "red",
      strokeWidth: 3,
      label: "1m",
      lengthM: 1,
    });

    expect(line.scaleX).toBe(1);
    expect(line.scaleY).toBe(1);
    expect(line.angle).toBe(0);
  });
});

// ============================================
// Mask factories
// ============================================

describe("createMaskRect", () => {
  it("creates a white rect with default options", () => {
    const rect = createMaskRect({
      left: 10,
      top: 20,
      width: 200,
      height: 150,
    });

    expect(rect.left).toBe(10);
    expect(rect.top).toBe(20);
    expect(rect.width).toBe(200);
    expect(rect.height).toBe(150);
    expect(rect.fill).toBe("white");
    expect(rect.scaleX).toBe(1);
    expect(rect.scaleY).toBe(1);
    expect(rect.angle).toBe(0);
    expect(rect.selectable).toBe(false);
    expect(rect.evented).toBe(false);
  });

  it("shows stroke when showStroke is true", () => {
    const rect = createMaskRect({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      showStroke: true,
    });

    expect(rect.stroke).toBe(THEME.cleanup);
    expect(rect.strokeWidth).toBe(2);
    expect(rect.strokeDashArray).toEqual([5, 5]);
  });

  it("has no stroke when showStroke is false or omitted", () => {
    const rect = createMaskRect({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      showStroke: false,
    });

    expect(rect.stroke).toBeUndefined();
    expect(rect.strokeWidth).toBe(0);
    expect(rect.strokeDashArray).toBeUndefined();
  });

  it("applies explicit scaleX, scaleY, and angle", () => {
    const rect = createMaskRect({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      scaleX: 2,
      scaleY: 3,
      angle: 45,
    });

    expect(rect.scaleX).toBe(2);
    expect(rect.scaleY).toBe(3);
    expect(rect.angle).toBe(45);
  });

  it("sets selectable and evented when provided", () => {
    const rect = createMaskRect({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      selectable: true,
      evented: true,
    });

    expect(rect.selectable).toBe(true);
    expect(rect.evented).toBe(true);
  });

  it("stores objectId and objectType when objectId is provided", () => {
    const rect = createMaskRect({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      objectId: 42,
    });

    expect(getFabricProp(rect as unknown as FabricObject, "objectId")).toBe(42);
    expect(getFabricProp(rect as unknown as FabricObject, "objectType")).toBe(
      "mask",
    );
  });

  it("does not set objectId or objectType when objectId is omitted", () => {
    const rect = createMaskRect({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
    });

    expect(
      getFabricProp(rect as unknown as FabricObject, "objectId"),
    ).toBeUndefined();
    expect(
      getFabricProp(rect as unknown as FabricObject, "objectType"),
    ).toBeUndefined();
  });
});
