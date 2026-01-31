"use client";

import { Button } from "@/components/ui/button";
import { FileInput } from "@/components/ui/FileInput";
import { usePlannerStore } from "@/lib/store";

interface CleanupPanelProps {
  onDrawMask: () => void;
  onExitCleanup: () => void;
  onAddCleanupImage: (file: File) => void;
}

export function CleanupPanel({
  onDrawMask,
  onExitCleanup,
  onAddCleanupImage,
}: CleanupPanelProps) {
  const mode = usePlannerStore((s) => s.mode);

  return (
    <div className="bg-planner-cleanup-bg border-2 border-planner-cleanup rounded-lg p-4 mb-4">
      <h3 className="text-planner-cleanup text-sm font-semibold mb-3">
        Cleanup Mode Active
      </h3>
      <p className="text-xs text-planner-text-secondary mb-3">
        Draw rectangles to hide unwanted parts of the image, or add images that
        become part of the background.
      </p>
      <div className="flex gap-2 mb-3">
        <Button
          variant="outline"
          className="bg-planner-calibration hover:bg-planner-calibration-hover text-black border-0"
          onClick={onDrawMask}
          disabled={mode === "drawing-mask"}
        >
          {mode === "drawing-mask"
            ? "Drawing... Click & Drag"
            : "Draw Mask Rectangle"}
        </Button>
      </div>
      <div className="mb-3">
        <label className="text-planner-text-secondary text-xs block mb-1.5">
          Add Background Image
        </label>
        <FileInput
          accept="image/*"
          onChange={onAddCleanupImage}
          label="Choose Image"
        />
      </div>
      <Button
        className="bg-planner-success hover:bg-planner-cleanup-hover text-white"
        onClick={onExitCleanup}
      >
        Exit Cleanup Mode
      </Button>
    </div>
  );
}
