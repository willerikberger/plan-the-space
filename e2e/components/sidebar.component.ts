import type { Page, Locator } from "@playwright/test";

export class SidebarComponent {
  readonly page: Page;
  readonly root: Locator;
  readonly modeToggle: Locator;
  readonly mobileToggle: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.locator('[data-testid="sidebar"]');
    this.modeToggle = page.locator('[data-testid="mode-toggle"]');
    this.mobileToggle = page.locator('button[aria-label="Open sidebar"]');
  }

  async switchToCleanup() {
    await this.modeToggle.locator("text=Cleanup Mode").click();
  }

  async switchToNormal() {
    await this.modeToggle.locator("text=Normal Mode").click();
  }

  async isVisible(): Promise<boolean> {
    return this.root.isVisible();
  }

  async openMobile() {
    await this.mobileToggle.click();
  }

  async closeMobile() {
    await this.page.locator('button[aria-label="Close sidebar"]').click();
  }

  async selectShapesTab() {
    await this.root.locator('button[value="shapes"]').click();
  }

  async selectLinesTab() {
    await this.root.locator('button[value="lines"]').click();
  }

  async selectImagesTab() {
    await this.root.locator('button[value="images"]').click();
  }
}
