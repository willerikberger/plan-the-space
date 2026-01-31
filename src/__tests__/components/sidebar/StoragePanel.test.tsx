import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { StoragePanel } from "@/components/sidebar/StoragePanel";

// Mock the IndexedDB storage module
vi.mock("@/lib/storage/indexeddb", () => ({
  checkProjectExists: vi.fn(),
}));

import { checkProjectExists } from "@/lib/storage/indexeddb";

const mockCheckProjectExists = checkProjectExists as unknown as ReturnType<
  typeof vi.fn
>;

describe("StoragePanel", () => {
  const defaultProps = {
    onSave: vi.fn(),
    onLoad: vi.fn(),
    onClear: vi.fn(),
    onExport: vi.fn(),
    onImport: vi.fn(),
    onToggleAutoSave: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckProjectExists.mockResolvedValue(null);
  });

  // --------------------------------------------------
  // Rendering
  // --------------------------------------------------
  it("renders Save / Load heading", () => {
    render(<StoragePanel {...defaultProps} />);
    expect(screen.getByText("Save / Load")).toBeInTheDocument();
  });

  it("renders auto-save status", () => {
    render(<StoragePanel {...defaultProps} />);
    expect(screen.getByText("Auto-save: On")).toBeInTheDocument();
  });

  it("renders Save Now button", () => {
    render(<StoragePanel {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: "Save Now" }),
    ).toBeInTheDocument();
  });

  it("renders Load button", () => {
    render(<StoragePanel {...defaultProps} />);
    expect(screen.getByRole("button", { name: "Load" })).toBeInTheDocument();
  });

  it("renders Clear button", () => {
    render(<StoragePanel {...defaultProps} />);
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
  });

  it("renders Export JSON button", () => {
    render(<StoragePanel {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: "Export JSON" }),
    ).toBeInTheDocument();
  });

  it("renders Import JSON button", () => {
    render(<StoragePanel {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: "Import JSON" }),
    ).toBeInTheDocument();
  });

  it("renders File Export/Import label", () => {
    render(<StoragePanel {...defaultProps} />);
    expect(screen.getByText("File Export/Import")).toBeInTheDocument();
  });

  // --------------------------------------------------
  // Storage status
  // --------------------------------------------------
  it('shows "No saved data" initially', () => {
    render(<StoragePanel {...defaultProps} />);
    expect(screen.getByText("No saved data")).toBeInTheDocument();
  });

  it("shows last saved date when project exists", async () => {
    const savedAt = "2025-06-15T10:30:00.000Z";
    mockCheckProjectExists.mockResolvedValue({ savedAt });
    render(<StoragePanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Last saved:/)).toBeInTheDocument();
    });
  });

  it('keeps "No saved data" when checkProjectExists returns null', async () => {
    mockCheckProjectExists.mockResolvedValue(null);
    render(<StoragePanel {...defaultProps} />);
    // Wait a tick and confirm state hasn't changed
    await waitFor(() => {
      expect(screen.getByText("No saved data")).toBeInTheDocument();
    });
  });

  // --------------------------------------------------
  // Button callbacks
  // --------------------------------------------------
  it("calls onSave when Save Now is clicked", () => {
    render(<StoragePanel {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Save Now" }));
    expect(defaultProps.onSave).toHaveBeenCalledTimes(1);
  });

  it("calls onLoad when Load is clicked", () => {
    render(<StoragePanel {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Load" }));
    expect(defaultProps.onLoad).toHaveBeenCalledTimes(1);
  });

  it("calls onClear when Clear is clicked", () => {
    render(<StoragePanel {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(defaultProps.onClear).toHaveBeenCalledTimes(1);
  });

  it("calls onExport when Export JSON is clicked", () => {
    render(<StoragePanel {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Export JSON" }));
    expect(defaultProps.onExport).toHaveBeenCalledTimes(1);
  });

  // --------------------------------------------------
  // File import via hidden input
  // --------------------------------------------------
  it("calls onImport when a JSON file is selected", () => {
    render(<StoragePanel {...defaultProps} />);
    // The hidden file input is the <input type="file">
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(fileInput).not.toBeNull();
    expect(fileInput.accept).toBe(".json");

    const file = new File(["{}"], "project.json", { type: "application/json" });
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(defaultProps.onImport).toHaveBeenCalledWith(file);
  });
});
