/**
 * @module MeasuredRect
 * @description Fabric Rect subclass that self-renders a name label and dimension text.
 * Eliminates the need for separate FabricText objects that drift during transforms.
 * @dependencies fabric (Rect), constants (DEFAULTS)
 */
import { Rect } from "fabric";
import { DEFAULTS } from "@/lib/constants";

export class MeasuredRect extends Rect {
  declare label: string;
  declare widthM: number;
  declare heightM: number;

  _render(ctx: CanvasRenderingContext2D): void {
    super._render(ctx);

    if (!this.label && !this.widthM) return;

    // Undo scaleX/scaleY so text renders at constant size
    const sx = this.scaleX ?? 1;
    const sy = this.scaleY ?? 1;
    ctx.save();
    ctx.scale(1 / sx, 1 / sy);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Name label
    if (this.label) {
      ctx.fillStyle = "white";
      ctx.font = `${DEFAULTS.labelFontSize}px Arial`;
      ctx.fillText(this.label, 0, -8 * sy);
    }

    // Dimensions text
    if (this.widthM != null && this.heightM != null) {
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = `${DEFAULTS.dimsFontSize}px Arial`;
      ctx.fillText(`${this.widthM}m \u00d7 ${this.heightM}m`, 0, 10 * sy);
    }

    ctx.restore();
  }

  /** Update metric dimensions (called during scaling) */
  updateDimensions(widthM: number, heightM: number): void {
    this.widthM = widthM;
    this.heightM = heightM;
  }
}
