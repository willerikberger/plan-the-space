import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// A component that throws on render
function ThrowingChild({ message }: { message: string }): React.JSX.Element {
  throw new Error(message);
}

// A component that renders normally
function GoodChild() {
  return <div>All is well</div>;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("ErrorBoundary", () => {
  it("renders children normally when no error", () => {
    render(
      <ErrorBoundary>
        <GoodChild />
      </ErrorBoundary>,
    );
    expect(screen.getByText("All is well")).toBeInTheDocument();
  });

  it("shows error message when child throws", () => {
    // Suppress React's default error logging during this test
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowingChild message="Canvas exploded" />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Canvas exploded")).toBeInTheDocument();
  });

  it('shows "Reload from last save" button', () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowingChild message="fail" />
      </ErrorBoundary>,
    );

    expect(
      screen.getByRole("button", { name: /reload from last save/i }),
    ).toBeInTheDocument();
  });

  it("logs error to console with structured data", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowingChild message="Structured error" />
      </ErrorBoundary>,
    );

    // Find our structured log call (React also calls console.error)
    const structuredCall = errorSpy.mock.calls.find(
      (call) => call[0] === "[PlanTheSpace] Uncaught error:",
    );
    expect(structuredCall).toBeDefined();
    expect(structuredCall![1]).toMatchObject({
      message: "Structured error",
    });
  });

  it("recovery button triggers reload", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    // Mock window.location.reload
    const reloadMock = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...window.location, reload: reloadMock },
      writable: true,
    });

    render(
      <ErrorBoundary>
        <ThrowingChild message="fail" />
      </ErrorBoundary>,
    );

    const button = screen.getByRole("button", {
      name: /reload from last save/i,
    });
    fireEvent.click(button);

    expect(reloadMock).toHaveBeenCalledOnce();
  });
});
