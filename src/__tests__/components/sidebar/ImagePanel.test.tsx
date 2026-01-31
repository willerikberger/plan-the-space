import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ImagePanel } from "@/components/sidebar/ImagePanel";

describe("ImagePanel", () => {
  const defaultProps = {
    onAddOverlayImage: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------
  // Rendering
  // --------------------------------------------------
  it('renders the "Add Overlay Image" label', () => {
    render(<ImagePanel {...defaultProps} />);
    expect(screen.getByText("Add Overlay Image")).toBeInTheDocument();
  });

  it('renders the "Choose Image" button', () => {
    render(<ImagePanel {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: "Choose Image" }),
    ).toBeInTheDocument();
  });

  it("renders the help text about images", () => {
    render(<ImagePanel {...defaultProps} />);
    expect(
      screen.getByText("Images can be moved, resized, and layered with shapes"),
    ).toBeInTheDocument();
  });

  // --------------------------------------------------
  // File input
  // --------------------------------------------------
  it("renders a hidden file input that accepts images", () => {
    render(<ImagePanel {...defaultProps} />);
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(fileInput).not.toBeNull();
    expect(fileInput.accept).toBe("image/*");
  });

  it("calls onAddOverlayImage when an image file is selected", () => {
    render(<ImagePanel {...defaultProps} />);
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["image-data"], "photo.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(defaultProps.onAddOverlayImage).toHaveBeenCalledWith(file);
  });

  it("does not call onAddOverlayImage when no file is selected", () => {
    render(<ImagePanel {...defaultProps} />);
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [] } });
    expect(defaultProps.onAddOverlayImage).not.toHaveBeenCalled();
  });
});
