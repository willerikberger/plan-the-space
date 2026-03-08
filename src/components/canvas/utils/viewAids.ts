/**
 * @module viewAids
 * @description Pure math helpers for grid/ruler-guide rendering and snapping.
 */

import type { Guide } from "@/lib/types";

export interface AxisViewport {
  pixelsPerMeter: number;
  zoom: number;
  pan: number;
}

export interface AxisSnapResult {
  deltaM: number;
  provider: "guide" | "grid";
  targetM: number;
  matchedValueM: number;
}

/** Convert a world-axis coordinate (meters) to screen pixels. */
export function worldAxisToScreen(valueM: number, axis: AxisViewport): number {
  return valueM * axis.pixelsPerMeter * axis.zoom + axis.pan;
}

/** Convert a screen-axis coordinate (pixels) to world meters. */
export function screenAxisToWorld(
  screenPx: number,
  axis: AxisViewport,
): number {
  return (screenPx - axis.pan) / (axis.pixelsPerMeter * axis.zoom);
}

/** Screen-space snap tolerance converted to world meters. */
export function snapToleranceWorldM(
  tolerancePx: number,
  pixelsPerMeter: number,
  zoom: number,
): number {
  return tolerancePx / (pixelsPerMeter * zoom);
}

/** Resolve the best axis snap with provider priority: guides first, then grid. */
export function resolveAxisSnap(options: {
  candidateValuesM: number[];
  guides: Guide[];
  axis: "x" | "y";
  gridStepM: number;
  tolerancePx: number;
  pixelsPerMeter: number;
  zoom: number;
  snapEnabled: boolean;
}): AxisSnapResult | null {
  const {
    candidateValuesM,
    guides,
    axis,
    gridStepM,
    tolerancePx,
    pixelsPerMeter,
    zoom,
    snapEnabled,
  } = options;
  if (!snapEnabled || candidateValuesM.length === 0) return null;
  if (!Number.isFinite(pixelsPerMeter) || pixelsPerMeter <= 0) return null;
  if (!Number.isFinite(zoom) || zoom <= 0) return null;

  const toleranceM = snapToleranceWorldM(tolerancePx, pixelsPerMeter, zoom);

  // 1) Guide snap (priority)
  const axisGuides = guides.filter((guide) => guide.axis === axis);
  let bestGuide:
    | {
        targetM: number;
        matchedValueM: number;
        distanceM: number;
      }
    | undefined;

  for (const value of candidateValuesM) {
    for (const guide of axisGuides) {
      const dist = Math.abs(guide.valueM - value);
      if (dist <= toleranceM) {
        if (!bestGuide || dist < bestGuide.distanceM) {
          bestGuide = {
            targetM: guide.valueM,
            matchedValueM: value,
            distanceM: dist,
          };
        }
      }
    }
  }

  if (bestGuide) {
    return {
      provider: "guide",
      targetM: bestGuide.targetM,
      matchedValueM: bestGuide.matchedValueM,
      deltaM: bestGuide.targetM - bestGuide.matchedValueM,
    };
  }

  // 2) Grid snap fallback
  if (!Number.isFinite(gridStepM) || gridStepM <= 0) return null;
  let bestGrid:
    | {
        targetM: number;
        matchedValueM: number;
        distanceM: number;
      }
    | undefined;

  for (const value of candidateValuesM) {
    const target = Math.round(value / gridStepM) * gridStepM;
    const dist = Math.abs(target - value);
    if (dist <= toleranceM) {
      if (!bestGrid || dist < bestGrid.distanceM) {
        bestGrid = {
          targetM: target,
          matchedValueM: value,
          distanceM: dist,
        };
      }
    }
  }

  if (!bestGrid) return null;
  return {
    provider: "grid",
    targetM: bestGrid.targetM,
    matchedValueM: bestGrid.matchedValueM,
    deltaM: bestGrid.targetM - bestGrid.matchedValueM,
  };
}
