import type { Page, Locator } from "@playwright/test";

export class ProjectPickerPage {
  readonly page: Page;
  readonly newProjectBtn: Locator;
  readonly projectGrid: Locator;
  readonly emptyProjects: Locator;
  readonly trashToggle: Locator;
  readonly wizardDialog: Locator;
  readonly wizardNameInput: Locator;
  readonly wizardDescriptionInput: Locator;
  readonly wizardNextBtn: Locator;
  readonly wizardDoneBtn: Locator;
  readonly wizardSkipBtn: Locator;
  readonly wizardBackBtn: Locator;

  constructor(page: Page) {
    this.page = page;
    this.newProjectBtn = page.locator('[data-testid="new-project-btn"]');
    this.projectGrid = page.locator('[data-testid="project-grid"]');
    this.emptyProjects = page.locator('[data-testid="empty-projects"]');
    this.trashToggle = page.locator('[data-testid="trash-toggle"]');
    this.wizardDialog = page.locator('[data-testid="new-project-wizard"]');
    this.wizardNameInput = page.locator('[data-testid="wizard-name-input"]');
    this.wizardDescriptionInput = page.locator(
      '[data-testid="wizard-description-input"]',
    );
    this.wizardNextBtn = page.locator('[data-testid="wizard-next-btn"]');
    this.wizardDoneBtn = page.locator('[data-testid="wizard-done-btn"]');
    this.wizardSkipBtn = page.locator('[data-testid="wizard-skip-btn"]');
    this.wizardBackBtn = page.locator('[data-testid="wizard-back-btn"]');
  }

  async createProject(name: string) {
    await this.newProjectBtn.click();
    await this.wizardNameInput.fill(name);
    await this.wizardNextBtn.click();
    await this.wizardSkipBtn.click();
  }

  async openProject(name: string) {
    await this.projectGrid.locator(`text=${name}`).first().click();
  }

  async getProjectCount(): Promise<number> {
    const cards = this.projectGrid.locator("[data-testid^='project-menu-']");
    return cards.count();
  }

  async isEmptyState(): Promise<boolean> {
    return this.emptyProjects.isVisible();
  }

  async openTrash() {
    await this.trashToggle.click();
  }
}
