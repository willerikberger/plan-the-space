"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useShallow } from "zustand/react/shallow";
import { usePlannerStore } from "@/lib/store";

interface CalibrationPanelProps {
  onStartCalibration: () => void;
  onCancelCalibration: () => void;
  onApplyCalibration: (meters: number) => void;
}

export function CalibrationPanel({
  onStartCalibration,
  onCancelCalibration,
  onApplyCalibration,
}: CalibrationPanelProps) {
  const [lengthValue, setLengthValue] = useState("");
  const { mode, hasBackgroundImage, showInput } = usePlannerStore(
    useShallow((s) => ({
      mode: s.mode,
      hasBackgroundImage: s.backgroundImageData !== null,
      showInput: s.showCalibrationInput,
    })),
  );

  const handleApply = () => {
    const val = parseFloat(lengthValue);
    if (val > 0) {
      onApplyCalibration(val);
      setLengthValue("");
    }
  };

  return (
    <div className="mb-6">
      <h2 className="text-xs uppercase tracking-wide text-planner-primary mb-3 pb-2 border-b border-planner-accent font-semibold">
        2. Set Scale
      </h2>
      <div className="bg-planner-accent p-3 rounded-md text-sm leading-relaxed mb-3">
        <ol className="list-decimal ml-5 space-y-1">
          <li>Click &quot;Start Calibration&quot;</li>
          <li>Draw a line on a known dimension</li>
          <li>Enter the real-world length</li>
        </ol>
      </div>
      <div className="flex gap-2 mb-3">
        {mode !== "calibrating" ? (
          <Button onClick={onStartCalibration} disabled={!hasBackgroundImage}>
            Start Calibration
          </Button>
        ) : (
          <Button variant="secondary" onClick={onCancelCalibration}>
            Cancel
          </Button>
        )}
      </div>
      {showInput && (
        <div className="mt-3 space-y-2">
          <Label className="text-planner-text-secondary">
            Line length in real life (meters)
          </Label>
          <Input
            type="number"
            step="0.1"
            min="0.1"
            placeholder="e.g. 5.0"
            value={lengthValue}
            onChange={(e) => setLengthValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleApply()}
            autoFocus
          />
          <Button onClick={handleApply}>Apply Scale</Button>
        </div>
      )}
    </div>
  );
}
