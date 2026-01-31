"use client";

import { Undo2, Redo2 } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { usePlannerStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface ToolbarProps {
  onUndo?: () => void;
  onRedo?: () => void;
}

export function Toolbar({ onUndo, onRedo }: ToolbarProps) {
  const { mode, pixelsPerMeter, historyState } = usePlannerStore(
    useShallow((s) => ({
      mode: s.mode,
      pixelsPerMeter: s.pixelsPerMeter,
      historyState: s.historyState,
    })),
  );

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
      <span className={modeClass}>{modeLabel}</span>
      <span className="text-sm text-planner-text-muted">
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
          className={cn(
            "p-1.5 rounded transition-colors",
            historyState.canUndo
              ? "text-planner-text hover:bg-planner-accent cursor-pointer"
              : "text-planner-text-disabled cursor-not-allowed",
          )}
          title={
            historyState.canUndo
              ? `Undo (${historyState.undoCount} step${historyState.undoCount !== 1 ? "s" : ""})`
              : "Nothing to undo"
          }
        >
          <Undo2 size={16} />
        </button>
        <button
          onClick={onRedo}
          disabled={!historyState.canRedo}
          className={cn(
            "p-1.5 rounded transition-colors",
            historyState.canRedo
              ? "text-planner-text hover:bg-planner-accent cursor-pointer"
              : "text-planner-text-disabled cursor-not-allowed",
          )}
          title={
            historyState.canRedo
              ? `Redo (${historyState.redoCount} step${historyState.redoCount !== 1 ? "s" : ""})`
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
