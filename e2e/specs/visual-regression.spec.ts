import path from "path";
import { test, expect } from "../fixtures/base.fixture";
import { canvasClick, waitForMode } from "../fixtures/helpers";

test.describe("Visual Regression", () => {
  test("empty project picker", async ({ projectPickerPage: page }) => {
    await expect(page).toHaveScreenshot("empty-picker.png");
  });

  test("picker with projects", async ({ projectPickerPage: page }) => {
    // Create a project first
    await page.getByTestId("new-project-btn").click();
    await page.getByTestId("wizard-name-input").fill("My Project");
    await page.getByTestId("wizard-next-btn").click();
    await page.getByTestId("wizard-skip-btn").click();
    await page.waitForTimeout(500);

    // Go back to picker
    await page.getByTestId("home-btn").click();
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot("picker-with-projects.png");
  });

  test("canvas initial state", async ({ freshProject: page }) => {
    await expect(page).toHaveScreenshot("canvas-initial.png");
  });

  test("wizard step 1", async ({ projectPickerPage: page }) => {
    await page.getByTestId("new-project-btn").click();
    await expect(page.getByTestId("new-project-wizard")).toBeVisible();
    await expect(page).toHaveScreenshot("wizard-step1.png");
  });

  test("wizard step 2", async ({ projectPickerPage: page }) => {
    await page.getByTestId("new-project-btn").click();
    await page.getByTestId("wizard-name-input").fill("Test");
    await page.getByTestId("wizard-next-btn").click();
    await expect(page).toHaveScreenshot("wizard-step2.png");
  });

  test("confirm dialog", async ({ calibratedProject: page }) => {
    await page.getByTestId("add-shape-btn").click();
    await page.waitForTimeout(300);

    await page.getByRole("button", { name: "Clear All" }).click();
    await expect(page.getByTestId("confirm-action-btn")).toBeVisible();
    await expect(page).toHaveScreenshot("confirm-dialog.png");
  });

  test("cleanup mode UI", async ({ calibratedProject: page }) => {
    await page.locator('[data-testid="mode-toggle"] button').last().click();
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot("cleanup-mode.png");
  });

  test("calibration panel with input", async ({ freshProject: page }) => {
    // Upload image first
    const fileInput = page
      .locator('input[type="file"][accept="image/*"]')
      .first();
    await fileInput.setInputFiles(
      path.join(__dirname, "../fixtures/test-assets/test-200x200.png"),
    );
    await page.waitForTimeout(500);

    // Start calibration
    await page.getByTestId("start-calibration-btn").click();
    await waitForMode(page, "calibrating");

    // Draw calibration line
    await canvasClick(page, 200, 200);
    await canvasClick(page, 300, 200);
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot("calibration-input.png");
  });

  test("canvas with shapes", async ({ calibratedProject: page }) => {
    await page.getByTestId("shape-name-input").fill("Garden");
    await page.getByTestId("add-shape-btn").click();
    await page.waitForTimeout(200);

    await page.getByTestId("shape-name-input").fill("Patio");
    await page.getByTestId("add-shape-btn").click();
    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot("canvas-with-shapes.png");
  });

  test("sidebar object list", async ({ calibratedProject: page }) => {
    await page.getByTestId("shape-name-input").fill("Item 1");
    await page.getByTestId("add-shape-btn").click();
    await page.waitForTimeout(200);
    await page.getByTestId("shape-name-input").fill("Item 2");
    await page.getByTestId("add-shape-btn").click();
    await page.waitForTimeout(200);

    const objectList = page.getByTestId("object-list");
    await expect(objectList).toHaveScreenshot("object-list.png");
  });
});
