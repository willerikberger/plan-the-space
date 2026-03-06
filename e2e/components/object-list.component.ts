import type { Page, Locator } from "@playwright/test";

export class ObjectListComponent {
  readonly page: Page;
  readonly list: Locator;
  readonly countBadge: Locator;
  readonly emptyMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.list = page.locator('[data-testid="object-list"]');
    this.countBadge = page.locator('[data-testid="object-count"]');
    this.emptyMessage = page.locator('[data-testid="object-list-empty"]');
  }

  async getCount(): Promise<string> {
    return (await this.countBadge.textContent()) ?? "0";
  }

  async isEmpty(): Promise<boolean> {
    return this.emptyMessage.isVisible();
  }

  async getItems(): Promise<Locator[]> {
    const items = this.list.locator("[data-testid^='object-item-']");
    const count = await items.count();
    const result: Locator[] = [];
    for (let i = 0; i < count; i++) {
      result.push(items.nth(i));
    }
    return result;
  }

  async selectItem(id: number) {
    await this.page.locator(`[data-testid="object-item-${id}"]`).click();
  }

  async deleteItem(id: number) {
    const item = this.page.locator(`[data-testid="object-item-${id}"]`);
    await item
      .locator(
        'button[aria-label*="delete" i], button[aria-label*="Delete" i], button:has(svg)',
      )
      .last()
      .click();
  }

  async moveUp(id: number) {
    const item = this.page.locator(`[data-testid="object-item-${id}"]`);
    await item.locator('button[aria-label*="up" i]').click();
  }

  async moveDown(id: number) {
    const item = this.page.locator(`[data-testid="object-item-${id}"]`);
    await item.locator('button[aria-label*="down" i]').click();
  }
}
