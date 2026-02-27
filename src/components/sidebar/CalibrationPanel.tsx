"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [error, setError] = useState("");
  const mode = usePlannerStore((s) => s.mode);
  const hasBackgroundImage = usePlannerStore(
    (s) => s.backgroundImageData !== null,
  );
  const showInput = usePlannerStore((s) => s.showCalibrationInput);

  const handleApply = () => {
    const val = parseFloat(lengthValue);
    if (!lengthValue.trim()) {
      setError("Please enter a length value");
      return;
    }
    if (isNaN(val) || val <= 0) {
      setError("Length must be a positive number");
      return;
    }
    setError("");
    onApplyCalibration(val);
    setLengthValue("");
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
          <Label
            className="text-planner-text-secondary"
            htmlFor="calibration-length"
          >
            Line length in real life (meters)
          </Label>
          <Input
            id="calibration-length"
            type="number"
            step="0.1"
            min="0.1"
            placeholder="e.g. 5.0"
            value={lengthValue}
            onChange={(e) => {
              setLengthValue(e.target.value);
              if (error) setError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && handleApply()}
            aria-invalid={!!error}
            aria-describedby={error ? "calibration-error" : "calibration-hint"}
            autoFocus
          />
          <p
            id="calibration-hint"
            className="text-[10px] text-planner-text-dim"
          >
            Enter a positive number (minimum 0.1)
          </p>
          {error && (
            <p
              id="calibration-error"
              className="text-xs text-planner-danger-alt"
              role="alert"
            >
              {error}
            </p>
          )}
          <Button onClick={handleApply}>Apply Scale</Button>
        </div>
      )}
    </div>
  );
}
