"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { useShallow } from "zustand/react/shallow";
import { usePlannerStore } from "@/lib/store";
import { SHAPE_COLORS, DEFAULTS } from "@/lib/constants";

interface ShapePanelProps {
  onAddShape: (name: string, widthM: number, heightM: number) => void;
}

export function ShapePanel({ onAddShape }: ShapePanelProps) {
  const [name, setName] = useState("");
  const [width, setWidth] = useState(String(DEFAULTS.shapeWidthM));
  const [height, setHeight] = useState(String(DEFAULTS.shapeHeightM));
  const { selectedColor, setSelectedColor, isCalibrated } = usePlannerStore(
    useShallow((s) => ({
      selectedColor: s.selectedColor,
      setSelectedColor: s.setSelectedColor,
      isCalibrated: s.pixelsPerMeter !== null,
    })),
  );

  const handleAdd = () => {
    const w = parseFloat(width) || DEFAULTS.shapeWidthM;
    const h = parseFloat(height) || DEFAULTS.shapeHeightM;
    const n = name || `Shape ${usePlannerStore.getState().objectIdCounter + 1}`;
    onAddShape(n, w, h);
    setName("");
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-planner-text-secondary text-xs">
          Shape Name
        </Label>
        <Input
          type="text"
          placeholder="e.g. Garden Bed, Patio"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <Label className="text-planner-text-secondary text-xs">
            Width (m)
          </Label>
          <Input
            type="number"
            step="0.1"
            min="0.1"
            value={width}
            onChange={(e) => setWidth(e.target.value)}
          />
        </div>
        <div className="flex-1">
          <Label className="text-planner-text-secondary text-xs">
            Height (m)
          </Label>
          <Input
            type="number"
            step="0.1"
            min="0.1"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
          />
        </div>
      </div>
      <div>
        <Label className="text-planner-text-secondary text-xs">Color</Label>
        <ColorPicker
          colors={SHAPE_COLORS}
          selected={selectedColor}
          onSelect={setSelectedColor}
        />
      </div>
      <Button onClick={handleAdd} disabled={!isCalibrated}>
        Add Shape
      </Button>
      {!isCalibrated && (
        <p className="text-xs text-planner-text-dim">
          Set scale first to add shapes
        </p>
      )}
    </div>
  );
}
