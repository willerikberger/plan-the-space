import type { Page, Locator } from "@playwright/test";

export class ShapePanelComponent {
  readonly page: Page;
  readonly nameInput: Locator;
  readonly widthInput: Locator;
  readonly heightInput: Locator;
  readonly addBtn: Locator;

  constructor(page: Page) {
    this.page = page;
    this.nameInput = page.locator('[data-testid="shape-name-input"]');
    this.widthInput = page.locator('[data-testid="shape-width-input"]');
    this.heightInput = page.locator('[data-testid="shape-height-input"]');
    this.addBtn = page.locator('[data-testid="add-shape-btn"]');
  }

  async addShape(name?: string, width?: number, height?: number) {
    if (name !== undefined) {
      await this.nameInput.clear();
      await this.nameInput.fill(name);
    }
    if (width !== undefined) {
      await this.widthInput.clear();
      await this.widthInput.fill(String(width));
    }
    if (height !== undefined) {
      await this.heightInput.clear();
      await this.heightInput.fill(String(height));
    }
    await this.addBtn.click();
  }

  async isAddDisabled(): Promise<boolean> {
    return this.addBtn.isDisabled();
  }

  async clearInputs() {
    await this.nameInput.clear();
    await this.widthInput.clear();
    await this.heightInput.clear();
  }
}
