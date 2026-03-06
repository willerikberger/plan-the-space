import type { Page, Locator } from "@playwright/test";

export class StoragePanelComponent {
  readonly page: Page;
  readonly saveBtn: Locator;
  readonly loadBtn: Locator;
  readonly clearBtn: Locator;
  readonly exportBtn: Locator;
  readonly importBtn: Locator;

  constructor(page: Page) {
    this.page = page;
    this.saveBtn = page.locator('[data-testid="save-btn"]');
    this.loadBtn = page.locator('[data-testid="load-btn"]');
    this.clearBtn = page.locator('[data-testid="clear-storage-btn"]');
    this.exportBtn = page.locator('[data-testid="export-btn"]');
    this.importBtn = page.locator('[data-testid="import-btn"]');
  }

  async save() {
    await this.saveBtn.click();
  }

  async load() {
    await this.loadBtn.click();
  }

  async clearStorage() {
    await this.clearBtn.click();
    // May trigger a confirm dialog
    const confirmBtn = this.page.locator('[data-testid="confirm-action-btn"]');
    if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await confirmBtn.click();
    }
  }

  async exportJson() {
    const downloadPromise = this.page.waitForEvent("download");
    await this.exportBtn.click();
    return downloadPromise;
  }

  async importJson(filePath: string) {
    // The import button may trigger a file input
    const fileInput = this.page
      .locator('[data-testid="sidebar"]')
      .locator('input[type="file"][accept*="json"]');
    if (await fileInput.count()) {
      await fileInput.setInputFiles(filePath);
    } else {
      // Some implementations use a button that opens a file chooser
      const [fileChooser] = await Promise.all([
        this.page.waitForEvent("filechooser"),
        this.importBtn.click(),
      ]);
      await fileChooser.setFiles(filePath);
    }
  }
}
