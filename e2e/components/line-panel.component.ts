import type { Page, Locator } from "@playwright/test";

export class LinePanelComponent {
  readonly page: Page;
  readonly drawBtn: Locator;
  readonly cancelBtn: Locator;
  readonly widthInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.drawBtn = page.locator('[data-testid="draw-line-btn"]');
    this.cancelBtn = page.locator('[data-testid="cancel-line-btn"]');
    this.widthInput = page.locator('[data-testid="line-width-input"]');
  }

  async startDrawing() {
    await this.drawBtn.click();
  }

  async cancelDrawing() {
    await this.cancelBtn.click();
  }

  async setWidth(n: number) {
    await this.widthInput.clear();
    await this.widthInput.fill(String(n));
  }

  async isDrawDisabled(): Promise<boolean> {
    return this.drawBtn.isDisabled();
  }
}
