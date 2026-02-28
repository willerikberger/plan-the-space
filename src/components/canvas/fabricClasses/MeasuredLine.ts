/**
 * @module MeasuredLine
 * @description Fabric Line subclass that self-renders a length label at the midpoint.
 * Eliminates the need for a separate FabricText label that drifts during transforms.
 * @dependencies fabric (Line), constants (DEFAULTS)
 */
import { Line } from "fabric";
import { DEFAULTS } from "@/lib/constants";

export class MeasuredLine extends Line {
  declare label: string;
  declare lengthM: number;
  declare labelColor: string;

  _render(ctx: CanvasRenderingContext2D): void {
    super._render(ctx);

    if (!this.label) return;

    // Midpoint of the line in local coords
    const x1 = this.x1 ?? 0;
    const y1 = this.y1 ?? 0;
    const x2 = this.x2 ?? 0;
    const y2 = this.y2 ?? 0;
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    ctx.save();

    // Background pill behind the label
    ctx.font = `bold ${DEFAULTS.lineLabelFontSize}px Arial`;
    const textWidth = ctx.measureText(this.label).width;
    const padding = 5;
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(
      midX - textWidth / 2 - padding,
      midY - 15 - DEFAULTS.lineLabelFontSize / 2 - padding,
      textWidth + padding * 2,
      DEFAULTS.lineLabelFontSize + padding * 2,
    );

    // Label text
    ctx.fillStyle = this.labelColor || "white";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.label, midX, midY - 15);

    ctx.restore();
  }
}
