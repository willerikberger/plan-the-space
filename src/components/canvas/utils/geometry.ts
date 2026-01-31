/**
 * @module geometry
 * @description Pure geometric utility functions for distance, angle snapping, unit conversion,
 * midpoint calculation, and image-fit scaling. All functions are stateless and side-effect-free.
 * @dependencies types (Point, SnappedPoint)
 * @usage Consumed by useCalibration, useLines, useShapes, useImages, useCleanup, and serialization utilities.
 */
import type { Point, SnappedPoint } from "@/lib/types";

/** Euclidean distance between two points */
export function distance(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Snap an endpoint to the nearest 45-degree angle from the start point */
export function snapTo45Degrees(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): SnappedPoint {
  const dx = endX - startX;
  const dy = endY - startY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  const angle = Math.atan2(dy, dx);
  const snapAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);

  return {
    x: startX + dist * Math.cos(snapAngle),
    y: startY + dist * Math.sin(snapAngle),
    angle: snapAngle,
  };
}

/** Convert pixel length to meters given a scale */
export function pixelsToMeters(px: number, pixelsPerMeter: number): number {
  return px / pixelsPerMeter;
}

/** Convert meters to pixel length given a scale */
export function metersToPixels(meters: number, pixelsPerMeter: number): number {
  return meters * pixelsPerMeter;
}

/** Round to a given number of decimal places */
export function roundToDecimal(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/** Midpoint between two points */
export function midpoint(a: Point, b: Point): Point {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

/** Calculate scale to fit image within canvas with 90% padding */
export function fitImageScale(
  imageWidth: number,
  imageHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  padding = 0.9,
): number {
  return Math.min(
    (canvasWidth * padding) / imageWidth,
    (canvasHeight * padding) / imageHeight,
  );
}

/** Calculate scale for overlay image (max 50% of canvas, never upscale) */
export function overlayImageScale(
  imageWidth: number,
  imageHeight: number,
  canvasWidth: number,
  canvasHeight: number,
): number {
  const maxSize = Math.min(canvasWidth, canvasHeight) * 0.5;
  return Math.min(maxSize / imageWidth, maxSize / imageHeight, 1);
}
