"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { useShallow } from "zustand/react/shallow";
import { usePlannerStore } from "@/lib/store";
import { LINE_COLORS } from "@/lib/constants";

interface LinePanelProps {
  onStartDrawLine: () => void;
  onCancelDrawLine: () => void;
}

export function LinePanel({
  onStartDrawLine,
  onCancelDrawLine,
}: LinePanelProps) {
  const {
    selectedLineColor,
    setSelectedLineColor,
    lineWidth,
    setLineWidth,
    mode,
    isCalibrated,
  } = usePlannerStore(
    useShallow((s) => ({
      selectedLineColor: s.selectedLineColor,
      setSelectedLineColor: s.setSelectedLineColor,
      lineWidth: s.lineWidth,
      setLineWidth: s.setLineWidth,
      mode: s.mode,
      isCalibrated: s.pixelsPerMeter !== null,
    })),
  );

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-planner-text-secondary text-xs">
          Line Color
        </Label>
        <ColorPicker
          colors={LINE_COLORS}
          selected={selectedLineColor}
          onSelect={setSelectedLineColor}
        />
      </div>
      <div>
        <Label className="text-planner-text-secondary text-xs">
          Line Width
        </Label>
        <Input
          type="number"
          step="1"
          min="1"
          max="20"
          value={lineWidth}
          onChange={(e) => setLineWidth(parseInt(e.target.value) || 3)}
        />
      </div>
      <div className="flex gap-2">
        {mode !== "drawing-line" ? (
          <Button onClick={onStartDrawLine} disabled={!isCalibrated}>
            Draw Line
          </Button>
        ) : (
          <Button variant="secondary" onClick={onCancelDrawLine}>
            Cancel
          </Button>
        )}
      </div>
      <p className="text-xs text-planner-text-dim">
        {!isCalibrated
          ? "Set scale first. Lines snap to 45\u00b0 angles."
          : "Lines snap to 45\u00b0 angles."}
      </p>
    </div>
  );
}
