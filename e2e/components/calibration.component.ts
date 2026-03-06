import type { Page, Locator } from "@playwright/test";

export class CalibrationComponent {
  readonly page: Page;
  readonly startBtn: Locator;
  readonly cancelBtn: Locator;
  readonly applyBtn: Locator;
  readonly lengthInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.startBtn = page.locator('[data-testid="start-calibration-btn"]');
    this.cancelBtn = page.locator('[data-testid="cancel-calibration-btn"]');
    this.applyBtn = page.locator('[data-testid="apply-calibration-btn"]');
    this.lengthInput = page.locator("#calibration-length");
  }

  async startCalibration() {
    await this.startBtn.click();
  }

  async cancelCalibration() {
    await this.cancelBtn.click();
  }

  async applyCalibration(meters: number) {
    await this.lengthInput.fill(String(meters));
    await this.applyBtn.click();
  }

  async isStartDisabled(): Promise<boolean> {
    return this.startBtn.isDisabled();
  }

  async isInputVisible(): Promise<boolean> {
    return this.lengthInput.isVisible();
  }
}
