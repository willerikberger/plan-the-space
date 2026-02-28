/**
 * @module fabricHelpers
 * @description Factory functions for creating Fabric.js objects (shapes, labels, calibration lines, masks)
 * and typed accessors for reading/writing custom properties on Fabric objects.
 * @dependencies fabric (Rect, Line, Circle), constants (THEME), types (FabricCustomProps)
 * @usage Consumed by useShapes, useLines, useCalibration, useCleanup, useImages, useCanvasEvents, and canvasOrchestration.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- Factory functions pass custom props to Fabric constructors which don't type them */
import { Rect, Line, Circle } from "fabric";
import type { FabricObject } from "fabric";
import { THEME } from "@/lib/constants";
import type { FabricCustomProps } from "@/lib/types";
import { MeasuredRect } from "@/components/canvas/fabricClasses/MeasuredRect";
import { MeasuredLine } from "@/components/canvas/fabricClasses/MeasuredLine";

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
// Shape & line factories (self-labeling via MeasuredRect / MeasuredLine)
// ============================================

export function createMeasuredRect(options: {
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
}): MeasuredRect {
  return new MeasuredRect({
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
    // Custom properties
    objectId: options.objectId,
    objectType: "shape",
    shapeName: options.shapeName,
    shapeWidthM: options.shapeWidthM,
    shapeHeightM: options.shapeHeightM,
    shapeColor: options.fill,
    baseWidthPx: options.baseWidthPx,
    baseHeightPx: options.baseHeightPx,
    // MeasuredRect-specific
    label: options.shapeName,
    widthM: options.shapeWidthM,
    heightM: options.shapeHeightM,
  } as any);
}

export function createMeasuredLine(options: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
  strokeWidth: number;
  label: string;
  lengthM: number;
  objectId?: number;
  lineName?: string;
  lineColor?: string;
  selectable?: boolean;
  evented?: boolean;
  scaleX?: number;
  scaleY?: number;
  angle?: number;
  left?: number;
  top?: number;
}): MeasuredLine {
  return new MeasuredLine([options.x1, options.y1, options.x2, options.y2], {
    left: options.left,
    top: options.top,
    stroke: options.stroke,
    strokeWidth: options.strokeWidth,
    strokeLineCap: "round",
    selectable: options.selectable ?? false,
    evented: options.evented ?? false,
    scaleX: options.scaleX ?? 1,
    scaleY: options.scaleY ?? 1,
    angle: options.angle ?? 0,
    // Custom properties
    ...(options.objectId != null && {
      objectId: options.objectId,
      objectType: "line",
      lineName: options.lineName,
      lineColor: options.lineColor,
      lengthM: options.lengthM,
    }),
    // MeasuredLine-specific
    label: options.label,
    lengthM: options.lengthM,
    labelColor: options.stroke,
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
