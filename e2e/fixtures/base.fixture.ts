import { test as base, expect, type Page } from "@playwright/test";
import path from "path";
import {
  clearIndexedDB,
  waitForCanvasReady,
  waitForMode,
  canvasDrag,
} from "./helpers";

type Fixtures = {
  projectPickerPage: Page;
  freshProject: Page;
  calibratedProject: Page;
};

export const test = base.extend<Fixtures>({
  projectPickerPage: [
    async ({ page }, use) => {
      await page.goto("/");
      await clearIndexedDB(page);
      await page.reload();
      await page
        .locator('[data-testid="empty-projects"], [data-testid="project-grid"]')
        .first()
        .waitFor({ timeout: 15000 });
      await use(page);
    },
    { auto: false },
  ],

  freshProject: [
    async ({ page }, use) => {
      // Navigate and clear DB
      await page.goto("/");
      await clearIndexedDB(page);
      await page.reload();
      await page
        .locator('[data-testid="empty-projects"], [data-testid="project-grid"]')
        .first()
        .waitFor({ timeout: 15000 });

      // Create a new project
      await page.locator('[data-testid="new-project-btn"]').click();
      await page
        .locator('[data-testid="wizard-name-input"]')
        .fill("Test Project");
      await page.locator('[data-testid="wizard-next-btn"]').click();
      await page.locator('[data-testid="wizard-skip-btn"]').click();

      await waitForCanvasReady(page);
      await use(page);
    },
    { auto: false },
  ],

  calibratedProject: [
    async ({ page }, use) => {
      // Navigate and clear DB
      await page.goto("/");
      await clearIndexedDB(page);
      await page.reload();
      await page
        .locator('[data-testid="empty-projects"], [data-testid="project-grid"]')
        .first()
        .waitFor({ timeout: 15000 });

      // Create a new project
      await page.locator('[data-testid="new-project-btn"]').click();
      await page
        .locator('[data-testid="wizard-name-input"]')
        .fill("Test Project");
      await page.locator('[data-testid="wizard-next-btn"]').click();
      await page.locator('[data-testid="wizard-skip-btn"]').click();

      await waitForCanvasReady(page);

      // Upload background image via the sidebar file input
      const bgInput = page
        .locator('[data-testid="sidebar"]')
        .locator('input[type="file"]')
        .first();
      await bgInput.setInputFiles(
        path.join(__dirname, "test-assets", "test-200x200.png"),
      );

      // Wait for the image to load onto canvas
      await page.waitForFunction(
        () => {
          const store = (window as any).__PLANNER_STORE__?.getState();
          if (!store) return false;
          for (const obj of store.objects.values()) {
            if (obj.type === "backgroundImage") return true;
          }
          return false;
        },
        { timeout: 10000 },
      );

      // Start calibration
      await page.locator('[data-testid="start-calibration-btn"]').click();
      await waitForMode(page, "calibrating");

      // Draw a 100px horizontal calibration line on canvas
      await canvasDrag(page, { x: 100, y: 100 }, { x: 200, y: 100 });

      // Wait for calibration input to appear
      await page.locator("#calibration-length").waitFor({ timeout: 5000 });

      // Enter 1 meter for the 100px line -> pixelsPerMeter = 100
      await page.locator("#calibration-length").fill("1");
      await page.locator('[data-testid="apply-calibration-btn"]').click();

      await waitForMode(page, "normal");
      await use(page);
    },
    { auto: false },
  ],
});

export { expect };
