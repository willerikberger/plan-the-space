"use client";

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
    <div className="flex items-center gap-3 px-5 py-3 bg-planner-sidebar border-b border-planner-accent">
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
      <span className="text-sm text-planner-text-muted">
        Scroll to zoom &bull; Drag canvas to pan
      </span>
    </div>
  );
}
