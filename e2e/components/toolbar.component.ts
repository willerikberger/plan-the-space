import type { Page, Locator } from "@playwright/test";

export class ToolbarComponent {
  readonly page: Page;
  readonly homeBtn: Locator;
  readonly modeBadge: Locator;
  readonly scaleDisplay: Locator;
  readonly undoBtn: Locator;
  readonly redoBtn: Locator;
  readonly projectName: Locator;

  constructor(page: Page) {
    this.page = page;
    this.homeBtn = page.locator('[data-testid="home-btn"]');
    this.modeBadge = page.locator('[data-testid="mode-badge"]');
    this.scaleDisplay = page.locator('[data-testid="scale-display"]');
    this.undoBtn = page.locator('[data-testid="undo-btn"]');
    this.redoBtn = page.locator('[data-testid="redo-btn"]');
    this.projectName = page.locator('[data-testid="project-name"]');
  }

  async goHome() {
    await this.homeBtn.click();
  }

  async undo() {
    await this.undoBtn.click();
  }

  async redo() {
    await this.redoBtn.click();
  }

  async getMode(): Promise<string> {
    return (await this.modeBadge.textContent()) ?? "";
  }

  async getScale(): Promise<string> {
    return (await this.scaleDisplay.textContent()) ?? "";
  }

  async getProjectName(): Promise<string> {
    return (await this.projectName.textContent()) ?? "";
  }

  async isUndoDisabled(): Promise<boolean> {
    return this.undoBtn.isDisabled();
  }

  async isRedoDisabled(): Promise<boolean> {
    return this.redoBtn.isDisabled();
  }
}
