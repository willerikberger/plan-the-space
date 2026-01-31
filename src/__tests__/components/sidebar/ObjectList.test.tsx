import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ObjectList } from "@/components/sidebar/ObjectList";
import { usePlannerStore, selectVisibleObjects } from "@/lib/store";
import type { ShapeObject, LineObject, OverlayImageObject } from "@/lib/types";

vi.mock("@/lib/store", () => ({
  usePlannerStore: vi.fn(),
  selectVisibleObjects: vi.fn(),
}));

// Also mock zustand/react/shallow used by ObjectList
vi.mock("zustand/react/shallow", () => ({
  useShallow: (fn: unknown) => fn,
}));

const mockUsePlannerStore = usePlannerStore as unknown as ReturnType<
  typeof vi.fn
>;
const mockSelectVisibleObjects = selectVisibleObjects as unknown as ReturnType<
  typeof vi.fn
>;

function setupStoreMock(
  objects: (ShapeObject | LineObject | OverlayImageObject)[] = [],
) {
  // usePlannerStore is called with useShallow(selectVisibleObjects), which
  // after our mock becomes selectVisibleObjects itself.
  // So the store mock receives selectVisibleObjects as the selector.
  mockSelectVisibleObjects.mockReturnValue(objects);
  mockUsePlannerStore.mockImplementation((selector?: unknown) => {
    if (typeof selector === "function") {
      // If the selector is selectVisibleObjects, return the objects directly
      return objects;
    }
    return objects;
  });
}

describe("ObjectList", () => {
  const defaultProps = {
    selectedObjectId: null as number | null,
    onSelect: vi.fn(),
    onDelete: vi.fn(),
    onMoveUp: vi.fn(),
    onMoveDown: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setupStoreMock([]);
  });

  // --------------------------------------------------
  // Empty state
  // --------------------------------------------------
  it("renders Objects heading", () => {
    render(<ObjectList {...defaultProps} />);
    expect(screen.getByText("Objects")).toBeInTheDocument();
  });

  it("shows count badge with 0", () => {
    render(<ObjectList {...defaultProps} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("shows empty message when no objects", () => {
    render(<ObjectList {...defaultProps} />);
    expect(screen.getByText("No objects added yet")).toBeInTheDocument();
  });

  // --------------------------------------------------
  // With objects
  // --------------------------------------------------
  const sampleShape: ShapeObject = {
    id: 1,
    type: "shape",
    name: "Garden Bed",
    widthM: 2,
    heightM: 3,
    color: "rgba(76, 175, 80, 0.6)",
  };

  const sampleLine: LineObject = {
    id: 2,
    type: "line",
    name: "Fence Line",
    lengthM: 5,
    color: "rgba(244, 67, 54, 1)",
  };

  const sampleOverlay: OverlayImageObject = {
    id: 3,
    type: "overlayImage",
    name: "Photo Overlay",
    imageData: "data:image/png;base64,abc",
  };

  it("renders object names", () => {
    setupStoreMock([sampleShape, sampleLine]);
    render(<ObjectList {...defaultProps} />);
    expect(screen.getByText("Garden Bed")).toBeInTheDocument();
    expect(screen.getByText("Fence Line")).toBeInTheDocument();
  });

  it("shows correct count badge for multiple objects", () => {
    setupStoreMock([sampleShape, sampleLine, sampleOverlay]);
    render(<ObjectList {...defaultProps} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("does not show empty message when objects exist", () => {
    setupStoreMock([sampleShape]);
    render(<ObjectList {...defaultProps} />);
    expect(screen.queryByText("No objects added yet")).not.toBeInTheDocument();
  });

  // --------------------------------------------------
  // Object dimensions display
  // --------------------------------------------------
  it("shows shape dimensions in meters", () => {
    setupStoreMock([sampleShape]);
    render(<ObjectList {...defaultProps} />);
    expect(screen.getByText(/2m/)).toBeInTheDocument();
    expect(screen.getByText(/3m/)).toBeInTheDocument();
  });

  it("shows line length in meters", () => {
    setupStoreMock([sampleLine]);
    render(<ObjectList {...defaultProps} />);
    expect(screen.getByText(/5m/)).toBeInTheDocument();
  });

  it('shows "Image" for overlay objects', () => {
    setupStoreMock([sampleOverlay]);
    render(<ObjectList {...defaultProps} />);
    expect(screen.getByText("Image")).toBeInTheDocument();
  });

  // --------------------------------------------------
  // Button interactions
  // --------------------------------------------------
  it("calls onSelect with object id when Select button clicked", () => {
    setupStoreMock([sampleShape]);
    render(<ObjectList {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    expect(defaultProps.onSelect).toHaveBeenCalledWith(1);
  });

  it("calls onDelete with object id when delete button clicked", () => {
    setupStoreMock([sampleShape]);
    render(<ObjectList {...defaultProps} />);
    // The delete button uses &times; character
    const deleteBtn = screen.getByRole("button", { name: "\u00d7" });
    fireEvent.click(deleteBtn);
    expect(defaultProps.onDelete).toHaveBeenCalledWith(1);
  });

  it("calls onMoveUp with object id when up arrow clicked", () => {
    setupStoreMock([sampleShape]);
    render(<ObjectList {...defaultProps} />);
    // The up arrow button uses &uarr; character
    const upBtn = screen.getByRole("button", { name: "\u2191" });
    fireEvent.click(upBtn);
    expect(defaultProps.onMoveUp).toHaveBeenCalledWith(1);
  });

  it("calls onMoveDown with object id when down arrow clicked", () => {
    setupStoreMock([sampleShape]);
    render(<ObjectList {...defaultProps} />);
    // The down arrow button uses &darr; character
    const downBtn = screen.getByRole("button", { name: "\u2193" });
    fireEvent.click(downBtn);
    expect(defaultProps.onMoveDown).toHaveBeenCalledWith(1);
  });

  // --------------------------------------------------
  // Multiple objects: correct id passed per row
  // --------------------------------------------------
  it("passes correct id for each row button", () => {
    setupStoreMock([sampleShape, sampleLine]);
    render(<ObjectList {...defaultProps} />);
    const selectButtons = screen.getAllByRole("button", { name: "Select" });
    expect(selectButtons).toHaveLength(2);

    fireEvent.click(selectButtons[0]);
    expect(defaultProps.onSelect).toHaveBeenCalledWith(1);

    fireEvent.click(selectButtons[1]);
    expect(defaultProps.onSelect).toHaveBeenCalledWith(2);
  });

  // --------------------------------------------------
  // Selected state
  // --------------------------------------------------
  it("does not add selected border class when object is not selected", () => {
    setupStoreMock([sampleShape]);
    const { container } = render(
      <ObjectList {...defaultProps} selectedObjectId={null} />,
    );
    const row = container.querySelector(".border-2");
    expect(row).toBeNull();
  });

  it("adds selected border class when object is selected", () => {
    setupStoreMock([sampleShape]);
    const { container } = render(
      <ObjectList {...defaultProps} selectedObjectId={1} />,
    );
    const row = container.querySelector(".border-2");
    expect(row).not.toBeNull();
  });
});
