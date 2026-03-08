import { describe, expect, it } from "vitest";
import {
  resolveAxisSnap,
  screenAxisToWorld,
  snapToleranceWorldM,
  worldAxisToScreen,
} from "@/components/canvas/utils/viewAids";

describe("viewAids utils", () => {
  it("round-trips axis world/screen conversion", () => {
    const axis = { pixelsPerMeter: 50, zoom: 2, pan: 30 };
    const screen = worldAxisToScreen(10, axis);
    expect(screenAxisToWorld(screen, axis)).toBeCloseTo(10, 10);
  });

  it("converts snap tolerance to world units", () => {
    expect(snapToleranceWorldM(10, 50, 2)).toBeCloseTo(0.1, 10);
  });

  it("prioritizes guide snap over grid snap", () => {
    const result = resolveAxisSnap({
      candidateValuesM: [2.49],
      guides: [{ id: "g1", axis: "x", valueM: 2.5 }],
      axis: "x",
      gridStepM: 0.5,
      tolerancePx: 10,
      pixelsPerMeter: 50,
      zoom: 1,
      snapEnabled: true,
    });
    expect(result?.provider).toBe("guide");
    expect(result?.targetM).toBe(2.5);
  });

  it("falls back to grid snap when no guide is near", () => {
    const result = resolveAxisSnap({
      candidateValuesM: [2.46],
      guides: [],
      axis: "x",
      gridStepM: 0.5,
      tolerancePx: 10,
      pixelsPerMeter: 50,
      zoom: 1,
      snapEnabled: true,
    });
    expect(result?.provider).toBe("grid");
    expect(result?.targetM).toBe(2.5);
  });

  it("returns null when snap is disabled", () => {
    const result = resolveAxisSnap({
      candidateValuesM: [2.46],
      guides: [{ id: "g1", axis: "x", valueM: 2.5 }],
      axis: "x",
      gridStepM: 0.5,
      tolerancePx: 10,
      pixelsPerMeter: 50,
      zoom: 1,
      snapEnabled: false,
    });
    expect(result).toBeNull();
  });
});
