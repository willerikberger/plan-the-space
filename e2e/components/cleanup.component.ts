import type { Page, Locator } from "@playwright/test";

export class CleanupComponent {
  readonly page: Page;
  readonly drawMaskBtn: Locator;
  readonly exitBtn: Locator;

  constructor(page: Page) {
    this.page = page;
    this.drawMaskBtn = page.locator('[data-testid="draw-mask-btn"]');
    this.exitBtn = page.locator('[data-testid="exit-cleanup-btn"]');
  }

  async drawMask() {
    await this.drawMaskBtn.click();
  }

  async exitCleanup() {
    await this.exitBtn.click();
  }

  async isDrawMaskDisabled(): Promise<boolean> {
    return this.drawMaskBtn.isDisabled();
  }
}
