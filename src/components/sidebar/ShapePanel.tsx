"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { usePlannerStore } from "@/lib/store";
import { SHAPE_COLORS, DEFAULTS } from "@/lib/constants";

interface ShapePanelProps {
  onAddShape: (name: string, widthM: number, heightM: number) => void;
}

export function ShapePanel({ onAddShape }: ShapePanelProps) {
  const [name, setName] = useState("");
  const [width, setWidth] = useState(String(DEFAULTS.shapeWidthM));
  const [height, setHeight] = useState(String(DEFAULTS.shapeHeightM));
  const selectedColor = usePlannerStore((s) => s.selectedColor);
  const setSelectedColor = usePlannerStore((s) => s.setSelectedColor);
  const isCalibrated = usePlannerStore((s) => s.pixelsPerMeter !== null);
  const objectIdCounter = usePlannerStore((s) => s.objectIdCounter);

  const handleAdd = () => {
    const w = parseFloat(width) || DEFAULTS.shapeWidthM;
    const h = parseFloat(height) || DEFAULTS.shapeHeightM;
    const n = name || `Shape ${objectIdCounter + 1}`;
    onAddShape(n, w, h);
    setName("");
  };

  return (
    <div className="flex flex-col gap-3">
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
            aria-describedby="shape-dim-hint"
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
            aria-describedby="shape-dim-hint"
          />
          <p id="shape-dim-hint" className="sr-only">
            Minimum 0.1 meters
          </p>
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
