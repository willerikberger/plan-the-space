"use client";

import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("[PlanTheSpace] Uncaught error:", {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className="flex h-screen items-center justify-center bg-planner-sidebar"
          role="alert"
        >
          <div className="max-w-md rounded-lg bg-planner-accent p-8 text-center">
            <h1 className="mb-4 text-xl font-semibold text-planner-text">
              Something went wrong
            </h1>
            <p className="mb-2 text-sm text-planner-text-secondary">
              An unexpected error occurred while rendering the canvas.
            </p>
            {this.state.error && (
              <pre className="mb-6 max-h-32 overflow-auto rounded bg-planner-sidebar p-3 text-left text-xs text-planner-text-secondary">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={this.handleReload}
              className="rounded bg-planner-primary px-6 py-2 text-sm font-medium text-planner-text transition-opacity hover:opacity-90"
            >
              Reload from last save
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
