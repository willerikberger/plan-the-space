import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ShapePanel } from "@/components/sidebar/ShapePanel";
import { usePlannerStore } from "@/lib/store";
import { SHAPE_COLORS, DEFAULTS } from "@/lib/constants";

vi.mock("@/lib/store", () => ({
  usePlannerStore: Object.assign(vi.fn(), {
    getState: vi.fn(),
  }),
}));

const mockUsePlannerStore = usePlannerStore as unknown as ReturnType<
  typeof vi.fn
> & {
  getState: ReturnType<typeof vi.fn>;
};

function setupStoreMock(overrides: Record<string, unknown> = {}) {
  const state: Record<string, unknown> = {
    selectedColor: SHAPE_COLORS[0],
    setSelectedColor: vi.fn(),
    pixelsPerMeter: 100,
    objectIdCounter: 0,
    ...overrides,
  };
  mockUsePlannerStore.mockImplementation(
    (selector?: (s: Record<string, unknown>) => unknown) =>
      selector ? selector(state) : state,
  );
  mockUsePlannerStore.getState.mockReturnValue(state);
}

describe("ShapePanel", () => {
  const defaultProps = {
    onAddShape: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setupStoreMock();
  });

  // --------------------------------------------------
  // Rendering
  // --------------------------------------------------
  it("renders name, width, and height inputs", () => {
    render(<ShapePanel {...defaultProps} />);
    expect(
      screen.getByPlaceholderText("e.g. Garden Bed, Patio"),
    ).toBeInTheDocument();
    expect(screen.getByText("Width (m)")).toBeInTheDocument();
    expect(screen.getByText("Height (m)")).toBeInTheDocument();
  });

  it("renders color picker section", () => {
    render(<ShapePanel {...defaultProps} />);
    expect(screen.getByText("Color")).toBeInTheDocument();
  });

  it("renders Add Shape button", () => {
    render(<ShapePanel {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: "Add Shape" }),
    ).toBeInTheDocument();
  });

  // --------------------------------------------------
  // Default form values
  // --------------------------------------------------
  it("pre-fills width with default value", () => {
    render(<ShapePanel {...defaultProps} />);
    const widthInputs = screen.getAllByRole("spinbutton");
    // Width is first number input, height is second
    expect(widthInputs[0]).toHaveValue(DEFAULTS.shapeWidthM);
  });

  it("pre-fills height with default value", () => {
    render(<ShapePanel {...defaultProps} />);
    const heightInputs = screen.getAllByRole("spinbutton");
    expect(heightInputs[1]).toHaveValue(DEFAULTS.shapeHeightM);
  });

  // --------------------------------------------------
  // Disabled state when no pixelsPerMeter
  // --------------------------------------------------
  it("disables Add Shape when pixelsPerMeter is null", () => {
    setupStoreMock({ pixelsPerMeter: null });
    render(<ShapePanel {...defaultProps} />);
    expect(screen.getByRole("button", { name: "Add Shape" })).toBeDisabled();
  });

  it("shows hint message when pixelsPerMeter is null", () => {
    setupStoreMock({ pixelsPerMeter: null });
    render(<ShapePanel {...defaultProps} />);
    expect(
      screen.getByText("Set scale first to add shapes"),
    ).toBeInTheDocument();
  });

  it("does not show hint message when pixelsPerMeter is set", () => {
    setupStoreMock({ pixelsPerMeter: 100 });
    render(<ShapePanel {...defaultProps} />);
    expect(
      screen.queryByText("Set scale first to add shapes"),
    ).not.toBeInTheDocument();
  });

  it("enables Add Shape when pixelsPerMeter is set", () => {
    setupStoreMock({ pixelsPerMeter: 100 });
    render(<ShapePanel {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: "Add Shape" }),
    ).not.toBeDisabled();
  });

  // --------------------------------------------------
  // Add shape callback
  // --------------------------------------------------
  it("calls onAddShape with custom name, width, height", () => {
    render(<ShapePanel {...defaultProps} />);
    const nameInput = screen.getByPlaceholderText("e.g. Garden Bed, Patio");
    const [widthInput, heightInput] = screen.getAllByRole("spinbutton");

    fireEvent.change(nameInput, { target: { value: "Patio" } });
    fireEvent.change(widthInput, { target: { value: "4.5" } });
    fireEvent.change(heightInput, { target: { value: "6" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Shape" }));

    expect(defaultProps.onAddShape).toHaveBeenCalledWith("Patio", 4.5, 6);
  });

  it("uses default name when name field is empty", () => {
    setupStoreMock({ pixelsPerMeter: 100, objectIdCounter: 3 });
    render(<ShapePanel {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Add Shape" }));
    // Default name is "Shape {objectIdCounter + 1}"
    expect(defaultProps.onAddShape).toHaveBeenCalledWith(
      "Shape 4",
      DEFAULTS.shapeWidthM,
      DEFAULTS.shapeHeightM,
    );
  });

  it("uses default dimensions when inputs are empty strings", () => {
    render(<ShapePanel {...defaultProps} />);
    const [widthInput, heightInput] = screen.getAllByRole("spinbutton");
    fireEvent.change(widthInput, { target: { value: "" } });
    fireEvent.change(heightInput, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Shape" }));
    expect(defaultProps.onAddShape).toHaveBeenCalledWith(
      expect.any(String),
      DEFAULTS.shapeWidthM,
      DEFAULTS.shapeHeightM,
    );
  });

  it("clears name input after adding a shape", () => {
    render(<ShapePanel {...defaultProps} />);
    const nameInput = screen.getByPlaceholderText("e.g. Garden Bed, Patio");
    fireEvent.change(nameInput, { target: { value: "Patio" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Shape" }));
    expect(nameInput).toHaveValue("");
  });

  // --------------------------------------------------
  // Color picker
  // --------------------------------------------------
  it("renders a color swatch for each SHAPE_COLOR", () => {
    render(<ShapePanel {...defaultProps} />);
    // ColorPicker renders a button per color
    const swatches = screen
      .getAllByRole("button")
      .filter(
        (btn) => btn.style.background !== "" && btn.textContent !== "Add Shape",
      );
    expect(swatches.length).toBe(SHAPE_COLORS.length);
  });

  it("calls setSelectedColor when a color swatch is clicked", () => {
    const setSelectedColor = vi.fn();
    setupStoreMock({ pixelsPerMeter: 100, setSelectedColor });
    render(<ShapePanel {...defaultProps} />);
    // Click the second color swatch (skip "Add Shape" button)
    const swatches = screen
      .getAllByRole("button")
      .filter((btn) => btn.style.background !== "");
    fireEvent.click(swatches[1]);
    expect(setSelectedColor).toHaveBeenCalledWith(SHAPE_COLORS[1]);
  });
});
