import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CleanupPanel } from "@/components/sidebar/CleanupPanel";
import { usePlannerStore } from "@/lib/store";

vi.mock("@/lib/store", () => ({
  usePlannerStore: vi.fn(),
}));

const mockUsePlannerStore = usePlannerStore as unknown as ReturnType<
  typeof vi.fn
>;

function setupStoreMock(overrides: Record<string, unknown> = {}) {
  const state: Record<string, unknown> = {
    mode: "cleanup",
    ...overrides,
  };
  mockUsePlannerStore.mockImplementation(
    (selector?: (s: Record<string, unknown>) => unknown) =>
      selector ? selector(state) : state,
  );
}

describe("CleanupPanel", () => {
  const defaultProps = {
    onDrawMask: vi.fn(),
    onExitCleanup: vi.fn(),
    onAddCleanupImage: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setupStoreMock();
  });

  // --------------------------------------------------
  // Rendering
  // --------------------------------------------------
  it('renders "Cleanup Mode Active" heading', () => {
    render(<CleanupPanel {...defaultProps} />);
    expect(screen.getByText("Cleanup Mode Active")).toBeInTheDocument();
  });

  it("renders the description text", () => {
    render(<CleanupPanel {...defaultProps} />);
    expect(
      screen.getByText(/Draw rectangles to hide unwanted parts/),
    ).toBeInTheDocument();
  });

  it('renders the "Draw Mask Rectangle" button in cleanup mode', () => {
    setupStoreMock({ mode: "cleanup" });
    render(<CleanupPanel {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: "Draw Mask Rectangle" }),
    ).toBeInTheDocument();
  });

  it('renders the "Exit Cleanup Mode" button', () => {
    render(<CleanupPanel {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: "Exit Cleanup Mode" }),
    ).toBeInTheDocument();
  });

  it('renders the "Add Background Image" label', () => {
    render(<CleanupPanel {...defaultProps} />);
    expect(screen.getByText("Add Background Image")).toBeInTheDocument();
  });

  it('renders the "Choose Image" button for background image', () => {
    render(<CleanupPanel {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: "Choose Image" }),
    ).toBeInTheDocument();
  });

  // --------------------------------------------------
  // Drawing-mask mode
  // --------------------------------------------------
  it('shows "Drawing... Click & Drag" text when mode is drawing-mask', () => {
    setupStoreMock({ mode: "drawing-mask" });
    render(<CleanupPanel {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: "Drawing... Click & Drag" }),
    ).toBeInTheDocument();
  });

  it("disables the mask button when mode is drawing-mask", () => {
    setupStoreMock({ mode: "drawing-mask" });
    render(<CleanupPanel {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: "Drawing... Click & Drag" }),
    ).toBeDisabled();
  });

  it("enables the mask button when mode is cleanup (not drawing-mask)", () => {
    setupStoreMock({ mode: "cleanup" });
    render(<CleanupPanel {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: "Draw Mask Rectangle" }),
    ).not.toBeDisabled();
  });

  // --------------------------------------------------
  // Button callbacks
  // --------------------------------------------------
  it('calls onDrawMask when "Draw Mask Rectangle" is clicked', () => {
    setupStoreMock({ mode: "cleanup" });
    render(<CleanupPanel {...defaultProps} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Draw Mask Rectangle" }),
    );
    expect(defaultProps.onDrawMask).toHaveBeenCalledTimes(1);
  });

  it('calls onExitCleanup when "Exit Cleanup Mode" is clicked', () => {
    render(<CleanupPanel {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Exit Cleanup Mode" }));
    expect(defaultProps.onExitCleanup).toHaveBeenCalledTimes(1);
  });

  // --------------------------------------------------
  // File input for cleanup images
  // --------------------------------------------------
  it("renders a hidden file input that accepts images", () => {
    render(<CleanupPanel {...defaultProps} />);
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(fileInput).not.toBeNull();
    expect(fileInput.accept).toBe("image/*");
  });

  it("calls onAddCleanupImage when an image file is selected", () => {
    render(<CleanupPanel {...defaultProps} />);
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["image-data"], "cleanup.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(defaultProps.onAddCleanupImage).toHaveBeenCalledWith(file);
  });

  it("does not call onAddCleanupImage when no file is selected", () => {
    render(<CleanupPanel {...defaultProps} />);
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [] } });
    expect(defaultProps.onAddCleanupImage).not.toHaveBeenCalled();
  });
});
