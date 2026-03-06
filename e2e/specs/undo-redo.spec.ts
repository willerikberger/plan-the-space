import { test, expect } from "../fixtures/base.fixture";
import { getObjectCount, getMode } from "../fixtures/helpers";

test.describe("Undo & Redo", () => {
  test("undo button initially disabled", async ({
    page,
    calibratedProject,
  }) => {
    await expect(page.getByTestId("undo-btn")).toBeDisabled();
  });

  test("undo reverts shape addition", async ({ page, calibratedProject }) => {
    await page.getByTestId("add-shape-btn").click();
    await page.waitForTimeout(200);
    expect(await getObjectCount(page)).toBe(1);

    await page.getByTestId("undo-btn").click();
    await page.waitForTimeout(300);
    expect(await getObjectCount(page)).toBe(0);
  });

  test("redo restores undone shape", async ({ page, calibratedProject }) => {
    await page.getByTestId("add-shape-btn").click();
    await page.waitForTimeout(200);
    expect(await getObjectCount(page)).toBe(1);

    await page.getByTestId("undo-btn").click();
    await page.waitForTimeout(300);
    expect(await getObjectCount(page)).toBe(0);

    await page.getByTestId("redo-btn").click();
    await page.waitForTimeout(300);
    expect(await getObjectCount(page)).toBe(1);
  });

  test("keyboard Cmd+Z triggers undo", async ({ page, calibratedProject }) => {
    await page.getByTestId("add-shape-btn").click();
    await page.waitForTimeout(200);
    expect(await getObjectCount(page)).toBe(1);

    await page.keyboard.press("Meta+z");
    await page.waitForTimeout(300);
    expect(await getObjectCount(page)).toBe(0);
  });

  test("keyboard Cmd+Shift+Z triggers redo", async ({
    page,
    calibratedProject,
  }) => {
    await page.getByTestId("add-shape-btn").click();
    await page.waitForTimeout(200);

    await page.keyboard.press("Meta+z");
    await page.waitForTimeout(300);
    expect(await getObjectCount(page)).toBe(0);

    await page.keyboard.press("Meta+Shift+z");
    await page.waitForTimeout(300);
    expect(await getObjectCount(page)).toBe(1);
  });

  test("keyboard Cmd+Y triggers redo", async ({ page, calibratedProject }) => {
    await page.getByTestId("add-shape-btn").click();
    await page.waitForTimeout(200);

    await page.keyboard.press("Meta+z");
    await page.waitForTimeout(300);
    expect(await getObjectCount(page)).toBe(0);

    await page.keyboard.press("Meta+y");
    await page.waitForTimeout(300);
    expect(await getObjectCount(page)).toBe(1);
  });

  test("multiple undo steps", async ({ page, calibratedProject }) => {
    // Add 3 shapes
    for (let i = 0; i < 3; i++) {
      await page.getByTestId("add-shape-btn").click();
      await page.waitForTimeout(200);
    }
    expect(await getObjectCount(page)).toBe(3);

    // Undo all 3
    for (let i = 0; i < 3; i++) {
      await page.getByTestId("undo-btn").click();
      await page.waitForTimeout(300);
    }
    expect(await getObjectCount(page)).toBe(0);
  });

  test("redo clears on new action after undo", async ({
    page,
    calibratedProject,
  }) => {
    // Add shape A
    await page.getByTestId("add-shape-btn").click();
    await page.waitForTimeout(200);

    // Undo
    await page.getByTestId("undo-btn").click();
    await page.waitForTimeout(300);

    // Add shape B (new action should clear redo stack)
    await page.getByTestId("add-shape-btn").click();
    await page.waitForTimeout(200);

    // Redo should be disabled
    await expect(page.getByTestId("redo-btn")).toBeDisabled();
  });

  test("undo count updates", async ({ page, calibratedProject }) => {
    // Initially undo disabled
    await expect(page.getByTestId("undo-btn")).toBeDisabled();

    // Add shapes
    await page.getByTestId("add-shape-btn").click();
    await page.waitForTimeout(200);
    await page.getByTestId("add-shape-btn").click();
    await page.waitForTimeout(200);

    // Undo should now be enabled
    await expect(page.getByTestId("undo-btn")).toBeEnabled();
  });

  test("rapid undo stress test", async ({ page, calibratedProject }) => {
    // Add 5 shapes
    for (let i = 0; i < 5; i++) {
      await page.getByTestId("add-shape-btn").click();
      await page.waitForTimeout(150);
    }
    expect(await getObjectCount(page)).toBe(5);

    // Rapidly undo all
    for (let i = 0; i < 5; i++) {
      await page.getByTestId("undo-btn").click();
      await page.waitForTimeout(100);
    }
    expect(await getObjectCount(page)).toBe(0);

    // Page should still be functional
    await expect(page.getByTestId("add-shape-btn")).toBeVisible();
  });

  test("undo reverts line drawing", async ({ page, calibratedProject }) => {
    // Switch to Lines tab and start line drawing
    await page.getByRole("tab", { name: "Lines" }).click();
    await page.getByTestId("draw-line-btn").click();
    await page.waitForTimeout(200);

    // Draw a line on the canvas by clicking two points
    const canvas = page.locator(
      'canvas[aria-label="Floor plan design canvas"]',
    );
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");

    await page.mouse.click(box.x + 150, box.y + 150);
    await page.waitForTimeout(200);
    await page.mouse.click(box.x + 350, box.y + 150);
    await page.waitForTimeout(300);

    const countAfterLine = await getObjectCount(page);

    // If line was drawn, undo it
    if (countAfterLine > 0) {
      await page.getByTestId("undo-btn").click();
      await page.waitForTimeout(300);
      expect(await getObjectCount(page)).toBeLessThan(countAfterLine);
    }
  });

  test("redo button disabled when nothing to redo", async ({
    page,
    calibratedProject,
  }) => {
    await expect(page.getByTestId("redo-btn")).toBeDisabled();
  });
});
