import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Sidebar } from "@/components/sidebar/Sidebar";
import {
  SidebarProvider,
  type SidebarCallbacks,
} from "@/components/sidebar/SidebarContext";
import { reorderObjects } from "@/components/canvas/utils/canvasOrchestration";
import { usePlannerStore, selectVisibleObjects } from "@/lib/store";
import type { FabricRefs } from "@/lib/types";

function makeSidebarCallbacks(
  overrides: Partial<SidebarCallbacks> = {},
): SidebarCallbacks {
  return {
    onLoadImage: vi.fn(),
    onStartCalibration: vi.fn(),
    onCancelCalibration: vi.fn(),
    onApplyCalibration: vi.fn(),
    onAddShape: vi.fn(),
    onStartDrawLine: vi.fn(),
    onCancelDrawLine: vi.fn(),
    onAddOverlayImage: vi.fn(),
    onEnterCleanupMode: vi.fn(),
    onExitCleanupMode: vi.fn(),
    onDrawMask: vi.fn(),
    onAddCleanupImage: vi.fn(),
    selectedObjectId: null,
    onSelectObject: vi.fn(),
    onDeleteObject: vi.fn(),
    onDeleteSelected: vi.fn(),
    onClearAll: vi.fn(),
    onMoveObjectUp: vi.fn(),
    onMoveObjectDown: vi.fn(),
    onSave: vi.fn(),
    onLoad: vi.fn(),
    onClear: vi.fn(),
    onExport: vi.fn(),
    onImport: vi.fn(),
    onToggleAutoSave: vi.fn(),
    ...overrides,
  };
}

describe("Sidebar layer controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePlannerStore.getState().reset();
  });

  it("reorders via up/down buttons without hiding shapes", () => {
    usePlannerStore.getState().addObject({
      id: 1,
      type: "shape",
      name: "Shape 1",
      widthM: 2,
      heightM: 3,
      color: "rgba(76, 175, 80, 0.6)",
    });
    usePlannerStore.getState().addObject({
      id: 2,
      type: "shape",
      name: "Shape 2",
      widthM: 2,
      heightM: 3,
      color: "rgba(156, 39, 176, 0.6)",
    });

    const rect1 = { id: "rect-1" };
    const rect2 = { id: "rect-2" };
    const allFabricRefsRef = {
      current: new Map<number, FabricRefs>([
        [1, { type: "shape", rect: rect1 as never }],
        [2, { type: "shape", rect: rect2 as never }],
      ]),
    } as unknown as React.RefObject<Map<number, FabricRefs>>;

    const canvas = {
      moveObjectTo: vi.fn(),
      renderAll: vi.fn(),
    } as unknown as import("fabric").Canvas;

    const callbacks = makeSidebarCallbacks({
      onMoveObjectUp: (id) => {
        usePlannerStore.getState().moveUpInLayer(id);
        reorderObjects(canvas, allFabricRefsRef as never);
      },
      onMoveObjectDown: (id) => {
        usePlannerStore.getState().moveDownInLayer(id);
        reorderObjects(canvas, allFabricRefsRef as never);
      },
    });

    render(
      <SidebarProvider value={callbacks}>
        <Sidebar />
      </SidebarProvider>,
    );

    expect(screen.getByText("Shape 1")).toBeInTheDocument();
    expect(screen.getByText("Shape 2")).toBeInTheDocument();
    expect(selectVisibleObjects(usePlannerStore.getState())).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Move Shape 1 up" }));

    expect(canvas.moveObjectTo).toHaveBeenNthCalledWith(1, rect2, 0);
    expect(canvas.moveObjectTo).toHaveBeenNthCalledWith(2, rect1, 1);
    expect(selectVisibleObjects(usePlannerStore.getState())).toHaveLength(2);
    expect(screen.getByText("Shape 1")).toBeInTheDocument();
    expect(screen.getByText("Shape 2")).toBeInTheDocument();

    (canvas.moveObjectTo as ReturnType<typeof vi.fn>).mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Move Shape 1 down" }));

    expect(canvas.moveObjectTo).toHaveBeenNthCalledWith(1, rect1, 0);
    expect(canvas.moveObjectTo).toHaveBeenNthCalledWith(2, rect2, 1);
    expect(selectVisibleObjects(usePlannerStore.getState())).toHaveLength(2);
    expect(screen.getByText("Shape 1")).toBeInTheDocument();
    expect(screen.getByText("Shape 2")).toBeInTheDocument();
  });
});
