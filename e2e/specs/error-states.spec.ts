import path from "path";
import { test, expect } from "../fixtures/base.fixture";
import { getObjectCount } from "../fixtures/helpers";

test.describe("Error States", () => {
  test("import non-JSON file shows error", async ({
    calibratedProject: page,
  }) => {
    const fileInput = page
      .getByTestId("import-btn")
      .locator('input[type="file"]');
    await fileInput.setInputFiles(
      path.join(__dirname, "../fixtures/test-assets/test-100x100.png"),
    );

    const statusBar = page.getByTestId("status-bar");
    await expect(statusBar).toContainText(/failed|invalid|error/i, {
      timeout: 5000,
    });
  });

  test("import invalid JSON does not clear canvas", async ({
    calibratedProject: page,
  }) => {
    await page.getByTestId("add-shape-btn").click();
    await page.waitForTimeout(300);
    const countBefore = await getObjectCount(page);
    expect(countBefore).toBeGreaterThan(0);

    const fileInput = page
      .getByTestId("import-btn")
      .locator('input[type="file"]');
    await fileInput.setInputFiles(
      path.join(__dirname, "../fixtures/test-assets/invalid-project.json"),
    );
    await page.waitForTimeout(500);

    const countAfter = await getObjectCount(page);
    expect(countAfter).toBe(countBefore);
  });

  test("no unhandled console errors during normal workflow", async ({
    calibratedProject: page,
  }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.getByTestId("add-shape-btn").click();
    await page.waitForTimeout(300);
    await page.getByTestId("undo-btn").click();
    await page.waitForTimeout(300);
    await page.getByTestId("redo-btn").click();
    await page.waitForTimeout(300);

    // Filter out known non-issues
    const realErrors = errors.filter((e) => !e.includes("favicon"));
    expect(realErrors).toHaveLength(0);
  });

  test("empty project name in wizard keeps Next disabled", async ({
    projectPickerPage: page,
  }) => {
    await page.getByTestId("new-project-btn").click();
    await expect(page.getByTestId("new-project-wizard")).toBeVisible();

    await expect(page.getByTestId("wizard-next-btn")).toBeDisabled();

    // Spaces only should also be disabled
    await page.getByTestId("wizard-name-input").fill("   ");
    await expect(page.getByTestId("wizard-next-btn")).toBeDisabled();
  });

  test("status bar shows messages", async ({ calibratedProject: page }) => {
    const statusBar = page.getByTestId("status-bar");
    await expect(statusBar).toBeVisible();
  });
});
