import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LinePanel } from "@/components/sidebar/LinePanel";
import { usePlannerStore } from "@/lib/store";
import { LINE_COLORS, DEFAULTS } from "@/lib/constants";

vi.mock("@/lib/store", () => ({
  usePlannerStore: vi.fn(),
}));

const mockUsePlannerStore = usePlannerStore as unknown as ReturnType<
  typeof vi.fn
>;

function setupStoreMock(overrides: Record<string, unknown> = {}) {
  const state: Record<string, unknown> = {
    selectedLineColor: LINE_COLORS[0],
    setSelectedLineColor: vi.fn(),
    lineWidth: DEFAULTS.lineWidth,
    setLineWidth: vi.fn(),
    mode: "normal",
    pixelsPerMeter: 100,
    ...overrides,
  };
  mockUsePlannerStore.mockImplementation(
    (selector?: (s: Record<string, unknown>) => unknown) =>
      selector ? selector(state) : state,
  );
}

describe("LinePanel", () => {
  const defaultProps = {
    onStartDrawLine: vi.fn(),
    onCancelDrawLine: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setupStoreMock();
  });

  // --------------------------------------------------
  // Rendering
  // --------------------------------------------------
  it("renders line color and width sections", () => {
    render(<LinePanel {...defaultProps} />);
    expect(screen.getByText("Line Color")).toBeInTheDocument();
    expect(screen.getByText("Line Width")).toBeInTheDocument();
  });

  it("renders color swatches for each LINE_COLOR", () => {
    render(<LinePanel {...defaultProps} />);
    const swatches = screen
      .getAllByRole("button")
      .filter((btn) => btn.style.background !== "");
    expect(swatches.length).toBe(LINE_COLORS.length);
  });

  it("renders line width input with default value", () => {
    render(<LinePanel {...defaultProps} />);
    expect(screen.getByRole("spinbutton")).toHaveValue(DEFAULTS.lineWidth);
  });

  // --------------------------------------------------
  // Draw Line button (normal mode)
  // --------------------------------------------------
  it('shows "Draw Line" button in normal mode', () => {
    render(<LinePanel {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: "Draw Line" }),
    ).toBeInTheDocument();
  });

  it('enables "Draw Line" when pixelsPerMeter is set', () => {
    setupStoreMock({ pixelsPerMeter: 100 });
    render(<LinePanel {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: "Draw Line" }),
    ).not.toBeDisabled();
  });

  it('disables "Draw Line" when pixelsPerMeter is null', () => {
    setupStoreMock({ pixelsPerMeter: null });
    render(<LinePanel {...defaultProps} />);
    expect(screen.getByRole("button", { name: "Draw Line" })).toBeDisabled();
  });

  it("calls onStartDrawLine when Draw Line is clicked", () => {
    setupStoreMock({ pixelsPerMeter: 100 });
    render(<LinePanel {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Draw Line" }));
    expect(defaultProps.onStartDrawLine).toHaveBeenCalledTimes(1);
  });

  // --------------------------------------------------
  // Cancel button (drawing-line mode)
  // --------------------------------------------------
  it('shows "Cancel" button when mode is drawing-line', () => {
    setupStoreMock({ mode: "drawing-line" });
    render(<LinePanel {...defaultProps} />);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Draw Line" }),
    ).not.toBeInTheDocument();
  });

  it("calls onCancelDrawLine when Cancel is clicked", () => {
    setupStoreMock({ mode: "drawing-line" });
    render(<LinePanel {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(defaultProps.onCancelDrawLine).toHaveBeenCalledTimes(1);
  });

  // --------------------------------------------------
  // Hint text based on pixelsPerMeter
  // --------------------------------------------------
  it('shows "Set scale first" hint when pixelsPerMeter is null', () => {
    setupStoreMock({ pixelsPerMeter: null });
    render(<LinePanel {...defaultProps} />);
    expect(screen.getByText(/Set scale first/)).toBeInTheDocument();
  });

  it("shows snap angle hint when pixelsPerMeter is set", () => {
    setupStoreMock({ pixelsPerMeter: 100 });
    render(<LinePanel {...defaultProps} />);
    expect(screen.getByText(/Lines snap to 45/)).toBeInTheDocument();
    expect(screen.queryByText(/Set scale first/)).not.toBeInTheDocument();
  });

  // --------------------------------------------------
  // Color picker interaction
  // --------------------------------------------------
  it("calls setSelectedLineColor when a color swatch is clicked", () => {
    const setSelectedLineColor = vi.fn();
    setupStoreMock({ pixelsPerMeter: 100, setSelectedLineColor });
    render(<LinePanel {...defaultProps} />);
    const swatches = screen
      .getAllByRole("button")
      .filter((btn) => btn.style.background !== "");
    fireEvent.click(swatches[2]);
    expect(setSelectedLineColor).toHaveBeenCalledWith(LINE_COLORS[2]);
  });

  // --------------------------------------------------
  // Line width change
  // --------------------------------------------------
  it("calls setLineWidth when line width input changes", () => {
    const setLineWidth = vi.fn();
    setupStoreMock({ pixelsPerMeter: 100, setLineWidth });
    render(<LinePanel {...defaultProps} />);
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "5" },
    });
    expect(setLineWidth).toHaveBeenCalledWith(5);
  });

  it("falls back to 3 for invalid line width input", () => {
    const setLineWidth = vi.fn();
    setupStoreMock({ pixelsPerMeter: 100, setLineWidth });
    render(<LinePanel {...defaultProps} />);
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "abc" },
    });
    expect(setLineWidth).toHaveBeenCalledWith(3);
  });
});
