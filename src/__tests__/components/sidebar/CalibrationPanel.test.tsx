import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CalibrationPanel } from "@/components/sidebar/CalibrationPanel";
import { usePlannerStore } from "@/lib/store";

vi.mock("@/lib/store", () => ({
  usePlannerStore: vi.fn(),
}));

const mockUsePlannerStore = usePlannerStore as unknown as ReturnType<
  typeof vi.fn
>;

function setupStoreMock(overrides: Record<string, unknown> = {}) {
  const state: Record<string, unknown> = {
    mode: "normal",
    backgroundImageData: null,
    showCalibrationInput: false,
    ...overrides,
  };
  mockUsePlannerStore.mockImplementation(
    (selector?: (s: Record<string, unknown>) => unknown) =>
      selector ? selector(state) : state,
  );
}

describe("CalibrationPanel", () => {
  const defaultProps = {
    onStartCalibration: vi.fn(),
    onCancelCalibration: vi.fn(),
    onApplyCalibration: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setupStoreMock();
  });

  // --------------------------------------------------
  // Rendering
  // --------------------------------------------------
  it("renders the Set Scale heading", () => {
    render(<CalibrationPanel {...defaultProps} />);
    expect(screen.getByText("2. Set Scale")).toBeInTheDocument();
  });

  it("renders calibration instructions", () => {
    render(<CalibrationPanel {...defaultProps} />);
    expect(screen.getByText(/Click "Start Calibration"/)).toBeInTheDocument();
    expect(
      screen.getByText(/Draw a line on a known dimension/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Enter the real-world length/)).toBeInTheDocument();
  });

  // --------------------------------------------------
  // Start Calibration button (normal mode)
  // --------------------------------------------------
  it('shows "Start Calibration" button in normal mode', () => {
    setupStoreMock({ mode: "normal", backgroundImageData: "data:test" });
    render(<CalibrationPanel {...defaultProps} />);
    const btn = screen.getByRole("button", { name: "Start Calibration" });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });

  it('disables "Start Calibration" when no background image', () => {
    setupStoreMock({ mode: "normal", backgroundImageData: null });
    render(<CalibrationPanel {...defaultProps} />);
    const btn = screen.getByRole("button", { name: "Start Calibration" });
    expect(btn).toBeDisabled();
  });

  it("calls onStartCalibration when button clicked", () => {
    setupStoreMock({ mode: "normal", backgroundImageData: "data:test" });
    render(<CalibrationPanel {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Start Calibration" }));
    expect(defaultProps.onStartCalibration).toHaveBeenCalledTimes(1);
  });

  // --------------------------------------------------
  // Cancel button (calibrating mode)
  // --------------------------------------------------
  it('shows "Cancel" button in calibrating mode', () => {
    setupStoreMock({ mode: "calibrating" });
    render(<CalibrationPanel {...defaultProps} />);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Start Calibration" }),
    ).not.toBeInTheDocument();
  });

  it("calls onCancelCalibration when cancel clicked", () => {
    setupStoreMock({ mode: "calibrating" });
    render(<CalibrationPanel {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(defaultProps.onCancelCalibration).toHaveBeenCalledTimes(1);
  });

  // --------------------------------------------------
  // Calibration input (showCalibrationInput === true)
  // --------------------------------------------------
  it("does not show length input when showCalibrationInput is false", () => {
    setupStoreMock({ showCalibrationInput: false });
    render(<CalibrationPanel {...defaultProps} />);
    expect(screen.queryByPlaceholderText("e.g. 5.0")).not.toBeInTheDocument();
  });

  it("shows length input when showCalibrationInput is true", () => {
    setupStoreMock({ showCalibrationInput: true });
    render(<CalibrationPanel {...defaultProps} />);
    expect(screen.getByPlaceholderText("e.g. 5.0")).toBeInTheDocument();
    expect(screen.getByText(/Line length in real life/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Apply Scale" }),
    ).toBeInTheDocument();
  });

  it("calls onApplyCalibration with parsed value on Apply Scale click", () => {
    setupStoreMock({ showCalibrationInput: true });
    render(<CalibrationPanel {...defaultProps} />);
    const input = screen.getByPlaceholderText("e.g. 5.0");
    fireEvent.change(input, { target: { value: "3.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply Scale" }));
    expect(defaultProps.onApplyCalibration).toHaveBeenCalledWith(3.5);
  });

  it("calls onApplyCalibration on Enter key", () => {
    setupStoreMock({ showCalibrationInput: true });
    render(<CalibrationPanel {...defaultProps} />);
    const input = screen.getByPlaceholderText("e.g. 5.0");
    fireEvent.change(input, { target: { value: "7" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(defaultProps.onApplyCalibration).toHaveBeenCalledWith(7);
  });

  it("does not call onApplyCalibration for invalid value (0)", () => {
    setupStoreMock({ showCalibrationInput: true });
    render(<CalibrationPanel {...defaultProps} />);
    const input = screen.getByPlaceholderText("e.g. 5.0");
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply Scale" }));
    expect(defaultProps.onApplyCalibration).not.toHaveBeenCalled();
  });

  it("does not call onApplyCalibration for negative value", () => {
    setupStoreMock({ showCalibrationInput: true });
    render(<CalibrationPanel {...defaultProps} />);
    const input = screen.getByPlaceholderText("e.g. 5.0");
    fireEvent.change(input, { target: { value: "-2" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply Scale" }));
    expect(defaultProps.onApplyCalibration).not.toHaveBeenCalled();
  });

  it("does not call onApplyCalibration for empty value", () => {
    setupStoreMock({ showCalibrationInput: true });
    render(<CalibrationPanel {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Apply Scale" }));
    expect(defaultProps.onApplyCalibration).not.toHaveBeenCalled();
  });

  it("does not call onApplyCalibration for non-numeric input", () => {
    setupStoreMock({ showCalibrationInput: true });
    render(<CalibrationPanel {...defaultProps} />);
    const input = screen.getByPlaceholderText("e.g. 5.0");
    fireEvent.change(input, { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply Scale" }));
    expect(defaultProps.onApplyCalibration).not.toHaveBeenCalled();
  });
});
