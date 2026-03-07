import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ObjectList } from "@/components/sidebar/ObjectList";
import {
  usePlannerStore,
  selectVisibleObjects,
  selectRenderOrder,
} from "@/lib/store";
import type { ShapeObject, LineObject, OverlayImageObject } from "@/lib/types";

vi.mock("@/lib/store", () => ({
  usePlannerStore: vi.fn(),
  selectVisibleObjects: vi.fn(),
  selectRenderOrder: vi.fn(),
}));

const mockUsePlannerStore = usePlannerStore as unknown as ReturnType<
  typeof vi.fn
>;
const mockSelectVisibleObjects = selectVisibleObjects as unknown as ReturnType<
  typeof vi.fn
>;
const mockSelectRenderOrder = selectRenderOrder as unknown as ReturnType<
  typeof vi.fn
>;

function setupStoreMock(
  objects: (ShapeObject | LineObject | OverlayImageObject)[] = [],
) {
  mockSelectVisibleObjects.mockReturnValue(objects);
  mockSelectRenderOrder.mockReturnValue(objects.map((obj) => obj.id));
  const state = {
    objects: new Map(objects.map((obj) => [obj.id, obj])),
    layers: {
      background: [],
      masks: [],
      content: objects.map((obj, index) => ({
        objectId: obj.id,
        zIndex: index,
      })),
    },
    getRenderOrder: () => objects.map((obj) => obj.id),
  };
  mockUsePlannerStore.mockImplementation((selector?: unknown) => {
    if (typeof selector === "function") {
      return (selector as (s: typeof state) => unknown)(state);
    }
    return state;
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
    expect(
      screen.getByText(
        "No objects yet. Set the scale, then add shapes or lines above.",
      ),
    ).toBeInTheDocument();
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
    expect(
      screen.queryByText(
        "No objects yet. Set the scale, then add shapes or lines above.",
      ),
    ).not.toBeInTheDocument();
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
    const deleteBtn = screen.getByRole("button", {
      name: "Delete Garden Bed",
    });
    fireEvent.click(deleteBtn);
    expect(defaultProps.onDelete).toHaveBeenCalledWith(1);
  });

  it("calls onMoveUp with object id when up arrow clicked", () => {
    setupStoreMock([sampleShape, sampleLine]);
    render(<ObjectList {...defaultProps} />);
    const upBtn = screen.getByRole("button", {
      name: "Move Garden Bed up",
    });
    fireEvent.click(upBtn);
    expect(defaultProps.onMoveUp).toHaveBeenCalledWith(1);
  });

  it("calls onMoveDown with object id when down arrow clicked", () => {
    setupStoreMock([sampleShape, sampleLine]);
    render(<ObjectList {...defaultProps} />);
    const downBtn = screen.getByRole("button", {
      name: "Move Fence Line down",
    });
    fireEvent.click(downBtn);
    expect(defaultProps.onMoveDown).toHaveBeenCalledWith(2);
  });

  it("disables move-up for topmost item and move-down for bottom item", () => {
    setupStoreMock([sampleShape, sampleLine]);
    render(<ObjectList {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: "Move Fence Line up" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Move Garden Bed down" }),
    ).toBeDisabled();
  });

  it("does not render escaped unicode sequences in object cards", () => {
    setupStoreMock([sampleShape]);
    render(<ObjectList {...defaultProps} />);
    expect(screen.queryByText("\\u2b1c")).not.toBeInTheDocument();
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
    expect(defaultProps.onSelect).toHaveBeenCalledWith(2);

    fireEvent.click(selectButtons[1]);
    expect(defaultProps.onSelect).toHaveBeenCalledWith(1);
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
