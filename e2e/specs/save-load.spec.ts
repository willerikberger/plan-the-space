import { test, expect } from "../fixtures/base.fixture";
import {
  getObjectCount,
  getStoreState,
  waitForAutoSave,
  waitForCanvasReady,
  clearIndexedDB,
} from "../fixtures/helpers";
import path from "path";

test.describe("Save & Load", () => {
  test("manual save shows toast", async ({ page, calibratedProject }) => {
    await page.getByTestId("save-btn").click();
    await expect(page.locator("[data-sonner-toast]")).toBeVisible({
      timeout: 5000,
    });
  });

  test("manual load shows toast", async ({ page, calibratedProject }) => {
    // Save first so there's something to load
    await page.getByTestId("save-btn").click();
    await page.waitForTimeout(500);

    await page.getByTestId("load-btn").click();
    await expect(page.locator("[data-sonner-toast]")).toBeVisible({
      timeout: 5000,
    });
  });

  test("save and reload preserves data", async ({
    page,
    calibratedProject,
  }) => {
    // Add a shape
    await page.getByTestId("add-shape-btn").click();
    await page.waitForTimeout(200);
    expect(await getObjectCount(page)).toBe(1);

    // Save manually
    await page.getByTestId("save-btn").click();
    await page.waitForTimeout(500);

    // Reload the page
    await page.reload();
    await page
      .locator('[data-testid="empty-projects"], [data-testid="project-grid"]')
      .first()
      .waitFor({ timeout: 15000 });

    // Open the project (click the first project card)
    await page.locator("[data-testid='project-grid'] > *").first().click();
    await waitForCanvasReady(page);

    // Verify the shape persisted
    expect(await getObjectCount(page)).toBeGreaterThanOrEqual(1);
  });

  test("clear storage with confirmation", async ({
    page,
    calibratedProject,
  }) => {
    // Save first
    await page.getByTestId("save-btn").click();
    await page.waitForTimeout(500);

    // Click clear storage
    await page.getByTestId("clear-storage-btn").click();

    // Confirm dialog should appear
    await expect(page.getByTestId("confirm-action-btn")).toBeVisible();
    await page.getByTestId("confirm-action-btn").click();

    // Toast should show
    await expect(page.locator("[data-sonner-toast]")).toBeVisible({
      timeout: 5000,
    });
  });

  test("cancel clear preserves data", async ({ page, calibratedProject }) => {
    // Add a shape and save
    await page.getByTestId("add-shape-btn").click();
    await page.waitForTimeout(200);
    await page.getByTestId("save-btn").click();
    await page.waitForTimeout(500);

    // Click clear storage then cancel
    await page.getByTestId("clear-storage-btn").click();
    await expect(page.getByTestId("confirm-cancel-btn")).toBeVisible();
    await page.getByTestId("confirm-cancel-btn").click();

    // Shape should still be there
    expect(await getObjectCount(page)).toBe(1);
  });

  test("export JSON triggers download", async ({ page, calibratedProject }) => {
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("export-btn").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.json$/);
  });

  test("import valid JSON restores project", async ({
    page,
    calibratedProject,
  }) => {
    const fileInput = page
      .getByTestId("import-btn")
      .locator('input[type="file"]');
    await fileInput.setInputFiles(
      path.join(__dirname, "../fixtures/test-assets/valid-project.json"),
    );

    // Wait for import to process
    await page.waitForTimeout(1000);

    // Should show a toast or status indicating success
    await expect(page.locator("[data-sonner-toast]")).toBeVisible({
      timeout: 5000,
    });
  });

  test("import invalid JSON shows error", async ({
    page,
    calibratedProject,
  }) => {
    const fileInput = page
      .getByTestId("import-btn")
      .locator('input[type="file"]');
    await fileInput.setInputFiles(
      path.join(__dirname, "../fixtures/test-assets/invalid-project.json"),
    );

    // Wait for import to process
    await page.waitForTimeout(1000);

    // Should show error toast or status message
    await expect(page.locator("[data-sonner-toast]")).toBeVisible({
      timeout: 5000,
    });
  });

  test("auto-save triggers after delay", async ({
    page,
    calibratedProject,
  }) => {
    // Add a shape
    await page.getByTestId("add-shape-btn").click();
    await page.waitForTimeout(200);
    expect(await getObjectCount(page)).toBe(1);

    // Wait for auto-save (2s debounce + buffer)
    await waitForAutoSave(page);

    // Reload the page
    await page.reload();
    await page
      .locator('[data-testid="empty-projects"], [data-testid="project-grid"]')
      .first()
      .waitFor({ timeout: 15000 });

    // Open the project
    await page.locator("[data-testid='project-grid'] > *").first().click();
    await waitForCanvasReady(page);

    // Verify auto-saved data persisted
    expect(await getObjectCount(page)).toBeGreaterThanOrEqual(1);
  });

  test("save button accessible", async ({ page, calibratedProject }) => {
    await expect(page.getByTestId("save-btn")).toBeVisible();
    await expect(page.getByTestId("save-btn")).toBeEnabled();
  });

  test("import button accessible", async ({ page, calibratedProject }) => {
    await expect(page.getByTestId("import-btn")).toBeVisible();
  });
});
