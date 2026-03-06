import { test, expect } from "../fixtures/base.fixture";
import {
  getStoreState,
  getMode,
  getObjectCount,
  waitForMode,
  canvasClick,
} from "../fixtures/helpers";

test.describe("Lines", () => {
  test("draw button disabled before calibration", async ({
    freshProject: page,
  }) => {
    // Switch to Lines tab
    await page.getByRole("tab", { name: "Lines" }).click();
    await expect(page.getByTestId("draw-line-btn")).toBeDisabled();
  });

  test("mode transitions to drawing-line", async ({
    calibratedProject: page,
  }) => {
    await page.getByRole("tab", { name: "Lines" }).click();
    await page.getByTestId("draw-line-btn").click();
    await waitForMode(page, "drawing-line");

    const mode = await getMode(page);
    expect(mode).toBe("drawing-line");
  });

  test("draw line between two points", async ({ calibratedProject: page }) => {
    await page.getByRole("tab", { name: "Lines" }).click();
    await page.getByTestId("draw-line-btn").click();
    await waitForMode(page, "drawing-line");

    // Click two points on canvas
    await canvasClick(page, 150, 200);
    await canvasClick(page, 250, 200);

    // Mode should return to normal after line is complete
    await waitForMode(page, "normal");

    // Verify a line was added to the store
    const state = await getStoreState(page);
    const objects = Array.from(Object.values(state.objects));
    const lines = objects.filter((o: any) => o.type === "line");
    expect(lines.length).toBe(1);
  });

  test("line appears in object list", async ({ calibratedProject: page }) => {
    await page.getByRole("tab", { name: "Lines" }).click();
    await page.getByTestId("draw-line-btn").click();
    await waitForMode(page, "drawing-line");

    await canvasClick(page, 150, 200);
    await canvasClick(page, 250, 200);
    await waitForMode(page, "normal");

    // Check that the object list shows the line
    const state = await getStoreState(page);
    const objects = Array.from(Object.values(state.objects));
    const line = objects.find((o: any) => o.type === "line") as any;
    expect(line).toBeTruthy();

    await expect(page.getByTestId("object-list")).toContainText(line.name);
  });

  test("line length accuracy", async ({ calibratedProject: page }) => {
    // calibratedProject has pixelsPerMeter=100, so 100px = 1.0m
    await page.getByRole("tab", { name: "Lines" }).click();
    await page.getByTestId("draw-line-btn").click();
    await waitForMode(page, "drawing-line");

    // Draw a 100px horizontal line
    await canvasClick(page, 150, 200);
    await canvasClick(page, 250, 200);
    await waitForMode(page, "normal");

    const state = await getStoreState(page);
    const objects = Array.from(Object.values(state.objects));
    const line = objects.find((o: any) => o.type === "line") as any;
    expect(line).toBeTruthy();
    // 100px at 100px/m should be approximately 1.0m
    // Allow some tolerance for canvas coordinate transforms
    expect(line.lengthM).toBeGreaterThan(0.5);
    expect(line.lengthM).toBeLessThan(2.0);
  });

  test("cancel button appears during drawing", async ({
    calibratedProject: page,
  }) => {
    await page.getByRole("tab", { name: "Lines" }).click();
    await page.getByTestId("draw-line-btn").click();
    await waitForMode(page, "drawing-line");

    await expect(page.getByTestId("cancel-line-btn")).toBeVisible();
    // draw-line-btn should not be visible (replaced by cancel)
    await expect(page.getByTestId("draw-line-btn")).not.toBeVisible();
  });

  test("cancel returns to normal mode", async ({ calibratedProject: page }) => {
    await page.getByRole("tab", { name: "Lines" }).click();
    await page.getByTestId("draw-line-btn").click();
    await waitForMode(page, "drawing-line");

    await page.getByTestId("cancel-line-btn").click();
    await waitForMode(page, "normal");

    const mode = await getMode(page);
    expect(mode).toBe("normal");
  });

  test("escape cancels line drawing", async ({ calibratedProject: page }) => {
    await page.getByRole("tab", { name: "Lines" }).click();
    await page.getByTestId("draw-line-btn").click();
    await waitForMode(page, "drawing-line");

    await page.keyboard.press("Escape");
    await waitForMode(page, "normal");

    const mode = await getMode(page);
    expect(mode).toBe("normal");
  });

  test("cancel mid-draw resets", async ({ calibratedProject: page }) => {
    await page.getByRole("tab", { name: "Lines" }).click();
    await page.getByTestId("draw-line-btn").click();
    await waitForMode(page, "drawing-line");

    // Click first point but don't complete the line
    await canvasClick(page, 150, 200);

    // Cancel
    await page.getByTestId("cancel-line-btn").click();
    await waitForMode(page, "normal");

    // No line should have been created
    const state = await getStoreState(page);
    const objects = Array.from(Object.values(state.objects));
    const lines = objects.filter((o: any) => o.type === "line");
    expect(lines.length).toBe(0);
  });

  test("line width setting", async ({ calibratedProject: page }) => {
    await page.getByRole("tab", { name: "Lines" }).click();

    // Change line width
    await page.getByTestId("line-width-input").clear();
    await page.getByTestId("line-width-input").fill("8");

    // Verify the store was updated
    const state = await getStoreState(page);
    expect(state.lineWidth).toBe(8);
  });

  test("multiple lines", async ({ calibratedProject: page }) => {
    await page.getByRole("tab", { name: "Lines" }).click();

    // Draw 3 lines
    for (let i = 0; i < 3; i++) {
      await page.getByTestId("draw-line-btn").click();
      await waitForMode(page, "drawing-line");
      await canvasClick(page, 150, 150 + i * 50);
      await canvasClick(page, 250, 150 + i * 50);
      await waitForMode(page, "normal");
    }

    const state = await getStoreState(page);
    const objects = Array.from(Object.values(state.objects));
    const lines = objects.filter((o: any) => o.type === "line");
    expect(lines.length).toBe(3);
  });

  test("mode badge shows Drawing Line", async ({ calibratedProject: page }) => {
    await page.getByRole("tab", { name: "Lines" }).click();
    await page.getByTestId("draw-line-btn").click();
    await waitForMode(page, "drawing-line");

    await expect(page.getByTestId("mode-badge")).toHaveText("Drawing Line");
  });
});
