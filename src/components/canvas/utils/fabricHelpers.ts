/**
 * @module fabricHelpers
 * @description Factory functions for creating Fabric.js objects (shapes, labels, calibration lines, masks)
 * and typed accessors for reading/writing custom properties on Fabric objects.
 * @dependencies fabric (Rect, FabricText, Line, Circle), constants (DEFAULTS, THEME), types (FabricCustomProps)
 * @usage Consumed by useShapes, useLines, useCalibration, useCleanup, useImages, useCanvasEvents, and canvasOrchestration.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- Factory functions pass custom props to Fabric constructors which don't type them */
import { Rect, FabricText, Line, Circle } from "fabric";
import type { FabricObject } from "fabric";
import { DEFAULTS, THEME } from "@/lib/constants";
import type { FabricCustomProps } from "@/lib/types";

// ============================================
// Typed Fabric custom property accessors
// ============================================

/**
 * Read a custom property from a Fabric object.
 * Centralizes the unsafe cast so consumers don't need `as unknown as Record<string, unknown>`.
 */
export function getFabricProp<K extends keyof FabricCustomProps>(
  obj: FabricObject,
  key: K,
): FabricCustomProps[K] {
  return (obj as unknown as FabricCustomProps)[key];
}

/**
 * Write one or more custom properties onto a Fabric object.
 * Centralizes the unsafe cast so consumers don't need `as unknown as Record<string, unknown>`.
 */
export function setFabricProps(
  obj: FabricObject,
  props: Partial<FabricCustomProps>,
): void {
  Object.assign(obj as unknown as FabricCustomProps, props);
}

// ============================================
// Shape factories
// ============================================

export function createShapeRect(options: {
  left: number;
  top: number;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  scaleX?: number;
  scaleY?: number;
  angle?: number;
  objectId: number;
  shapeName: string;
  shapeWidthM: number;
  shapeHeightM: number;
  baseWidthPx: number;
  baseHeightPx: number;
}): Rect {
  return new Rect({
    left: options.left,
    top: options.top,
    width: options.width,
    height: options.height,
    fill: options.fill,
    stroke: options.stroke,
    strokeWidth: 2,
    rx: 4,
    ry: 4,
    scaleX: options.scaleX ?? 1,
    scaleY: options.scaleY ?? 1,
    angle: options.angle ?? 0,
    // Custom properties stored on the Fabric object
    objectId: options.objectId,
    objectType: "shape",
    shapeName: options.shapeName,
    shapeWidthM: options.shapeWidthM,
    shapeHeightM: options.shapeHeightM,
    shapeColor: options.fill,
    baseWidthPx: options.baseWidthPx,
    baseHeightPx: options.baseHeightPx,
  } as any);
}

export function createShapeLabel(options: {
  text: string;
  left: number;
  top: number;
  angle?: number;
  parentId: number;
}): FabricText {
  return new FabricText(options.text, {
    left: options.left,
    top: options.top,
    fontSize: DEFAULTS.labelFontSize,
    fill: "white",
    fontFamily: "Arial",
    originX: "center",
    originY: "center",
    angle: options.angle ?? 0,
    selectable: false,
    evented: false,
    objectType: "shapeLabel",
    parentId: options.parentId,
  } as any);
}

export function createShapeDims(options: {
  text: string;
  left: number;
  top: number;
  angle?: number;
  parentId: number;
}): FabricText {
  return new FabricText(options.text, {
    left: options.left,
    top: options.top,
    fontSize: DEFAULTS.dimsFontSize,
    fill: "rgba(255,255,255,0.7)",
    fontFamily: "Arial",
    originX: "center",
    originY: "center",
    angle: options.angle ?? 0,
    selectable: false,
    evented: false,
    objectType: "shapeDims",
    parentId: options.parentId,
  } as any);
}

// ============================================
// Calibration factories
// ============================================

export function createCalibrationLine(options: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}): Line {
  return new Line([options.x1, options.y1, options.x2, options.y2], {
    stroke: THEME.calibration,
    strokeWidth: 3,
    selectable: false,
    evented: false,
    strokeDashArray: [5, 5],
  });
}

export function createCalibrationEndpoint(x: number, y: number): Circle {
  return new Circle({
    left: x - 5,
    top: y - 5,
    radius: 5,
    fill: THEME.calibration,
    selectable: false,
    evented: false,
  });
}

// ============================================
// Line factories
// ============================================

export function createDrawingLine(options: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
  strokeWidth: number;
}): Line {
  return new Line([options.x1, options.y1, options.x2, options.y2], {
    stroke: options.stroke,
    strokeWidth: options.strokeWidth,
    selectable: false,
    evented: false,
    strokeLineCap: "round",
  });
}

export function createLineLabel(options: {
  text: string;
  left: number;
  top: number;
  fill: string;
  parentId?: number;
}): FabricText {
  return new FabricText(options.text, {
    left: options.left,
    top: options.top,
    fontSize: DEFAULTS.lineLabelFontSize,
    fill: options.fill,
    fontFamily: "Arial",
    originX: "center",
    originY: "center",
    selectable: false,
    evented: false,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 3,
    objectType: "lineLabel",
    ...(options.parentId != null && { parentId: options.parentId }),
  } as any);
}

// ============================================
// Mask factories
// ============================================

export function createMaskRect(options: {
  left: number;
  top: number;
  width: number;
  height: number;
  scaleX?: number;
  scaleY?: number;
  angle?: number;
  selectable?: boolean;
  evented?: boolean;
  showStroke?: boolean;
  objectId?: number;
}): Rect {
  return new Rect({
    left: options.left,
    top: options.top,
    width: options.width,
    height: options.height,
    fill: "white",
    stroke: options.showStroke ? THEME.cleanup : undefined,
    strokeWidth: options.showStroke ? 2 : 0,
    strokeDashArray: options.showStroke ? [5, 5] : undefined,
    scaleX: options.scaleX ?? 1,
    scaleY: options.scaleY ?? 1,
    angle: options.angle ?? 0,
    selectable: options.selectable ?? false,
    evented: options.evented ?? false,
    ...(options.objectId != null && {
      objectId: options.objectId,
      objectType: "mask",
    }),
  } as any);
}
