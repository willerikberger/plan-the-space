import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Toolbar } from "@/components/ui/Toolbar";
import { usePlannerStore } from "@/lib/store";

describe("Toolbar grid menu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePlannerStore.getState().reset();
  });

  it("opens grid menu and toggles grid visibility", () => {
    render(<Toolbar onUndo={vi.fn()} onRedo={vi.fn()} />);

    fireEvent.click(screen.getByTestId("grid-menu-btn"));
    expect(screen.getByTestId("grid-menu")).toBeInTheDocument();

    const before = usePlannerStore.getState().viewAids.showGrid;
    fireEvent.click(screen.getByTestId("toggle-grid-btn"));
    expect(usePlannerStore.getState().viewAids.showGrid).toBe(!before);
  });

  it("clears guides from the menu", () => {
    usePlannerStore.getState().addGuide("x", 1, "g1");
    usePlannerStore.getState().addGuide("y", 2, "g2");

    render(<Toolbar onUndo={vi.fn()} onRedo={vi.fn()} />);
    fireEvent.click(screen.getByTestId("grid-menu-btn"));
    fireEvent.click(screen.getByTestId("clear-guides-btn"));

    expect(usePlannerStore.getState().viewAids.guides).toHaveLength(0);
  });
});
