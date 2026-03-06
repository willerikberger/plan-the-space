"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
  colors: readonly string[];
  selected: string;
  onSelect: (color: string) => void;
}

/** Map RGBA strings to human-readable color names for aria-labels */
function colorName(rgba: string): string {
  if (rgba.includes("76, 175, 80")) return "Green";
  if (rgba.includes("33, 150, 243")) return "Blue";
  if (rgba.includes("255, 152, 0")) return "Orange";
  if (rgba.includes("156, 39, 176")) return "Purple";
  if (rgba.includes("244, 67, 54")) return "Red";
  if (rgba.includes("121, 85, 72")) return "Brown";
  if (rgba.includes("96, 125, 139")) return "Gray";
  if (rgba.includes("255, 235, 59")) return "Yellow";
  if (rgba.includes("255, 255, 255")) return "White";
  if (rgba.includes("0, 0, 0")) return "Black";
  return "Color";
}

export const ColorPicker = memo(function ColorPicker({
  colors,
  selected,
  onSelect,
}: ColorPickerProps) {
  return (
    <div className="flex gap-2 flex-wrap" role="radiogroup">
      {colors.map((color) => {
        const displayColor = color.replace("0.6", "0.8");
        const isSelected = selected === color;
        const name = colorName(color);
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={name}
            className={cn(
              "size-10 rounded-md cursor-pointer border-2 transition-transform hover:scale-110",
              isSelected ? "border-white" : "border-transparent",
            )}
            style={{ background: displayColor }}
            onClick={() => onSelect(color)}
          />
        );
      })}
    </div>
  );
});
