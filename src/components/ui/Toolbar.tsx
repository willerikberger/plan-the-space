"use client";

import { useState } from "react";
import { Undo2, Redo2, Home } from "lucide-react";
import { usePlannerStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface ToolbarProps {
  onUndo?: () => void;
  onRedo?: () => void;
  onGoHome?: () => void;
  projectName?: string | null;
}

export function Toolbar({
  onUndo,
  onRedo,
  onGoHome,
  projectName,
}: ToolbarProps) {
  const mode = usePlannerStore((s) => s.mode);
  const pixelsPerMeter = usePlannerStore((s) => s.pixelsPerMeter);
  const historyState = usePlannerStore((s) => s.historyState);
  const viewAids = usePlannerStore((s) => s.viewAids);
  const [menuOpen, setMenuOpen] = useState(false);

  const modeLabel = (() => {
    switch (mode) {
      case "calibrating":
        return "Calibrating";
      case "drawing-line":
        return "Drawing Line";
      case "drawing-mask":
        return "Drawing Mask";
      case "cleanup":
        return "Cleanup Mode";
      default:
        return pixelsPerMeter ? "Ready" : "No Scale Set";
    }
  })();

  const modeClass = cn(
    "px-3 py-1.5 rounded text-xs font-semibold",
    mode === "calibrating" && "bg-planner-calibration animate-mode-pulse",
    mode === "drawing-line" && "bg-planner-calibration animate-mode-pulse",
    mode === "drawing-mask" && "bg-planner-cleanup animate-mode-pulse",
    mode === "cleanup" && "bg-planner-cleanup animate-mode-pulse",
    mode === "normal" && "bg-planner-primary",
  );

  return (
    <div className="relative flex items-center gap-3 px-5 py-3 bg-planner-sidebar border-b border-planner-accent">
      {onGoHome && (
        <button
          onClick={onGoHome}
          className="p-1.5 rounded text-planner-text-muted hover:text-planner-text hover:bg-planner-accent transition-colors"
          aria-label="Go to project picker"
          title="Home"
          data-testid="home-btn"
        >
          <Home size={16} />
        </button>
      )}
      {projectName && (
        <span
          className="text-sm font-medium text-planner-text truncate max-w-48"
          data-testid="project-name"
        >
          {projectName}
        </span>
      )}
      <span className={modeClass} data-testid="mode-badge">
        {modeLabel}
      </span>
      <span
        className="text-sm text-planner-text-muted"
        data-testid="scale-display"
      >
        {pixelsPerMeter ? (
          <>
            Scale:{" "}
            <strong className="text-planner-green">
              1m = {Math.round(pixelsPerMeter)}px
            </strong>
          </>
        ) : (
          "Scale: Not set"
        )}
      </span>

      {/* Undo / Redo */}
      <div className="flex items-center gap-1 ml-4">
        <button
          onClick={onUndo}
          disabled={!historyState.canUndo}
          data-testid="undo-btn"
          className={cn(
            "p-1.5 rounded transition-colors",
            historyState.canUndo
              ? "text-planner-text hover:bg-planner-accent cursor-pointer"
              : "text-planner-text-disabled cursor-not-allowed",
          )}
          aria-label={
            historyState.canUndo
              ? `Undo (${historyState.undoCount} step${historyState.undoCount !== 1 ? "s" : ""})`
              : "Nothing to undo"
          }
          title={
            historyState.canUndo
              ? `Undo · ⌘Z (${historyState.undoCount} step${historyState.undoCount !== 1 ? "s" : ""})`
              : "Nothing to undo"
          }
        >
          <Undo2 size={16} />
        </button>
        <button
          onClick={onRedo}
          disabled={!historyState.canRedo}
          data-testid="redo-btn"
          className={cn(
            "p-1.5 rounded transition-colors",
            historyState.canRedo
              ? "text-planner-text hover:bg-planner-accent cursor-pointer"
              : "text-planner-text-disabled cursor-not-allowed",
          )}
          aria-label={
            historyState.canRedo
              ? `Redo (${historyState.redoCount} step${historyState.redoCount !== 1 ? "s" : ""})`
              : "Nothing to redo"
          }
          title={
            historyState.canRedo
              ? `Redo · ⌘⇧Z (${historyState.redoCount} step${historyState.redoCount !== 1 ? "s" : ""})`
              : "Nothing to redo"
          }
        >
          <Redo2 size={16} />
        </button>
      </div>

      <span className="flex-1" />
      <div className="relative">
        <button
          className="px-3 py-1.5 rounded text-xs font-medium bg-planner-accent text-planner-text hover:opacity-90 transition-opacity"
          data-testid="grid-menu-btn"
          onClick={() => setMenuOpen((v) => !v)}
        >
          Grid
        </button>
        {menuOpen && (
          <div
            className="absolute right-0 top-9 z-20 w-64 rounded-md border border-planner-accent bg-planner-sidebar p-3 shadow-xl"
            data-testid="grid-menu"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-planner-text-muted">Grid</span>
              <button
                className="text-xs text-planner-text-muted hover:text-planner-text"
                onClick={() => setMenuOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <button
                className="w-full rounded bg-planner-accent px-2 py-1 text-left"
                data-testid="toggle-grid-btn"
                onClick={() => usePlannerStore.getState().toggleGrid()}
              >
                {viewAids.showGrid ? "Hide Grid" : "Show Grid"}
              </button>
              <button
                className="w-full rounded bg-planner-accent px-2 py-1 text-left"
                data-testid="toggle-snap-btn"
                onClick={() => usePlannerStore.getState().toggleSnap()}
              >
                {viewAids.snapEnabled ? "Disable Snapping" : "Enable Snapping"}
              </button>
              <button
                className="w-full rounded bg-planner-accent px-2 py-1 text-left"
                data-testid="toggle-rulers-btn"
                onClick={() => usePlannerStore.getState().toggleRulers()}
              >
                {viewAids.showRulers ? "Hide Rulers" : "Show Rulers"}
              </button>

              <label className="flex items-center justify-between gap-2">
                <span>Grid Step (m)</span>
                <input
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={viewAids.gridStepM}
                  data-testid="grid-step-input"
                  className="w-20 rounded bg-planner-canvas px-2 py-1"
                  onChange={(e) =>
                    usePlannerStore
                      .getState()
                      .setGridStepM(Number.parseFloat(e.target.value))
                  }
                />
              </label>

              <label className="flex items-center justify-between gap-2">
                <span>Major Every</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={viewAids.majorEvery}
                  data-testid="major-every-input"
                  className="w-20 rounded bg-planner-canvas px-2 py-1"
                  onChange={(e) =>
                    usePlannerStore
                      .getState()
                      .setMajorEvery(Number.parseInt(e.target.value, 10))
                  }
                />
              </label>

              <label className="flex items-center justify-between gap-2">
                <span>Guide Lock</span>
                <input
                  type="checkbox"
                  checked={viewAids.guideLock}
                  data-testid="guide-lock-toggle"
                  onChange={(e) =>
                    usePlannerStore.getState().setGuideLock(e.target.checked)
                  }
                />
              </label>

              <button
                className="w-full rounded bg-planner-danger-alt px-2 py-1 text-left"
                data-testid="clear-guides-btn"
                onClick={() => usePlannerStore.getState().clearGuides()}
              >
                Clear Guides
              </button>
            </div>
          </div>
        )}
      </div>
      <span className="text-sm text-planner-text-muted">
        Scroll to zoom &bull; Drag canvas to pan
      </span>
    </div>
  );
}
