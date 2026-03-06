import type { Page, Locator } from "@playwright/test";

export class ImagePanelComponent {
  readonly page: Page;
  readonly fileInput: Locator;

  constructor(page: Page) {
    this.page = page;
    // The overlay image file input is inside the Images tab content
    // It's the second file input in the sidebar (first is background image)
    this.fileInput = page
      .locator('[data-testid="sidebar"]')
      .locator('input[type="file"]');
  }

  /**
   * Upload a background image (first file input in sidebar).
   */
  async uploadBackground(filePath: string) {
    await this.fileInput.first().setInputFiles(filePath);
  }

  /**
   * Upload an overlay image (must switch to Images tab first).
   * The overlay file input appears inside the Images tab.
   */
  async uploadOverlay(filePath: string) {
    // After switching to Images tab, the overlay input is the last file input
    await this.fileInput.last().setInputFiles(filePath);
  }
}
