import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCalibration } from "@/components/canvas/hooks/useCalibration";
import { usePlannerStore } from "@/lib/store";

type MockLine = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  set: (props: Partial<Pick<MockLine, "x2" | "y2">>) => void;
};

let createdLine: MockLine | null = null;

vi.mock("@/components/canvas/utils/fabricHelpers", () => ({
  createCalibrationLine: ({
    x1,
    y1,
    x2,
    y2,
  }: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }) => {
    const line: MockLine = {
      x1,
      y1,
      x2,
      y2,
      set: vi.fn((props) => {
        Object.assign(line, props);
      }),
    };
    createdLine = line;
    return line;
  },
  createCalibrationEndpoint: vi.fn(() => ({ kind: "endpoint" })),
  getFabricProp: vi.fn(),
}));

describe("useCalibration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createdLine = null;
    usePlannerStore.getState().reset();
  });

  it("stops dragging the calibration line after finish", () => {
    const canvas = {
      add: vi.fn(),
      remove: vi.fn(),
      renderAll: vi.fn(),
      getObjects: vi.fn(() => []),
      defaultCursor: "default",
      selection: true,
    };

    const fabricCanvasRef = {
      current: canvas,
    } as unknown as React.RefObject<import("fabric").Canvas | null>;

    const { result } = renderHook(() => useCalibration(fabricCanvasRef));

    act(() => {
      result.current.startCalibration();
      result.current.handleCalibrationClick({ x: 10, y: 10 });
      result.current.updateCalibrationLine({ x: 110, y: 10 });
    });

    expect(result.current.startPointRef.current).toEqual({ x: 10, y: 10 });
    expect(createdLine?.x2).toBe(110);

    act(() => {
      result.current.finishCalibrationLine();
    });

    expect(result.current.startPointRef.current).toBeNull();
    expect(usePlannerStore.getState().showCalibrationInput).toBe(true);

    act(() => {
      result.current.updateCalibrationLine({ x: 310, y: 10 });
    });

    expect(createdLine?.x2).toBe(110);
  });
});
