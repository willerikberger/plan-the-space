import type { Page } from "@playwright/test";
import { canvasClick, canvasDrag, canvasScroll } from "../fixtures/helpers";

export class CanvasInteraction {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async click(x: number, y: number) {
    await canvasClick(this.page, x, y);
  }

  async drag(
    from: { x: number; y: number },
    to: { x: number; y: number },
    steps?: number,
  ) {
    await canvasDrag(this.page, from, to, steps);
  }

  async scroll(x: number, y: number, deltaY: number) {
    await canvasScroll(this.page, x, y, deltaY);
  }

  async getCanvasBBox() {
    const canvas = this.page.locator(
      'canvas[data-fabric="main"][aria-label="Floor plan design canvas"]',
    );
    return canvas.boundingBox();
  }
}
