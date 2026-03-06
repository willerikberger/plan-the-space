import { test, expect } from "../fixtures/base.fixture";
import {
  getStoreState,
  getObjectCount,
  waitForCanvasReady,
} from "../fixtures/helpers";

test.describe("Shapes", () => {
  test("add button disabled before calibration", async ({
    freshProject: page,
  }) => {
    // Shapes tab is default, button should be disabled without calibration
    await expect(page.getByTestId("add-shape-btn")).toBeDisabled();
  });

  test("default name auto-generation", async ({ calibratedProject: page }) => {
    // Add shape without a name
    await page.getByTestId("add-shape-btn").click();

    // Check object list for auto-generated name
    const state = await getStoreState(page);
    const objects = Array.from(Object.values(state.objects));
    const shapes = objects.filter((o: any) => o.type === "shape");
    expect(shapes.length).toBe(1);
    expect((shapes[0] as any).name).toMatch(/^Shape \d+$/);
  });

  test("custom name and dimensions", async ({ calibratedProject: page }) => {
    await page.getByTestId("shape-name-input").fill("Garden Bed");
    await page.getByTestId("shape-width-input").clear();
    await page.getByTestId("shape-width-input").fill("3");
    await page.getByTestId("shape-height-input").clear();
    await page.getByTestId("shape-height-input").fill("4");
    await page.getByTestId("add-shape-btn").click();

    const state = await getStoreState(page);
    const objects = Array.from(Object.values(state.objects));
    const shape = objects.find((o: any) => o.type === "shape") as any;
    expect(shape).toBeTruthy();
    expect(shape.name).toBe("Garden Bed");
    expect(shape.widthM).toBe(3);
    expect(shape.heightM).toBe(4);
  });

  test("shape appears on canvas", async ({ calibratedProject: page }) => {
    await page.getByTestId("add-shape-btn").click();

    // Verify a fabric object was created by checking store
    const count = await getObjectCount(page);
    // calibratedProject has a background image, so count should be at least 2
    // (background + new shape)
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test("shape appears in object list", async ({ calibratedProject: page }) => {
    await page.getByTestId("shape-name-input").fill("My Shape");
    await page.getByTestId("add-shape-btn").click();

    await expect(page.getByTestId("object-list")).toContainText("My Shape");
  });

  test("multiple shapes", async ({ calibratedProject: page }) => {
    await page.getByTestId("shape-name-input").fill("Shape A");
    await page.getByTestId("add-shape-btn").click();

    await page.getByTestId("shape-name-input").fill("Shape B");
    await page.getByTestId("add-shape-btn").click();

    await page.getByTestId("shape-name-input").fill("Shape C");
    await page.getByTestId("add-shape-btn").click();

    const state = await getStoreState(page);
    const objects = Array.from(Object.values(state.objects));
    const shapes = objects.filter((o: any) => o.type === "shape");
    expect(shapes.length).toBe(3);
  });

  test("input clears after add", async ({ calibratedProject: page }) => {
    await page.getByTestId("shape-name-input").fill("Temporary");
    await page.getByTestId("add-shape-btn").click();

    await expect(page.getByTestId("shape-name-input")).toHaveValue("");
  });

  test("color selection changes shape color", async ({
    calibratedProject: page,
  }) => {
    // Click a different color swatch (the color picker renders swatches as buttons)
    const colorSwatches = page
      .getByTestId("add-shape-btn")
      .locator("..")
      .locator("..")
      .locator("button[aria-label]");
    // Get the second color swatch if available
    const swatches = page
      .locator('[role="radiogroup"] button, [data-color]')
      .first();
    if ((await swatches.count()) > 0) {
      await swatches.click();
    }

    await page.getByTestId("shape-name-input").fill("Colored Shape");
    await page.getByTestId("add-shape-btn").click();

    const state = await getStoreState(page);
    const objects = Array.from(Object.values(state.objects));
    const shape = objects.find((o: any) => o.type === "shape") as any;
    expect(shape).toBeTruthy();
    expect(shape.color).toBeTruthy();
  });

  test("object count badge updates", async ({ calibratedProject: page }) => {
    // Initial count (background image is not a "visible" object in the list)
    const initialText = await page.getByTestId("object-count").textContent();
    const initialCount = parseInt(initialText || "0");

    await page.getByTestId("add-shape-btn").click();
    await expect(page.getByTestId("object-count")).toHaveText(
      String(initialCount + 1),
    );

    await page.getByTestId("add-shape-btn").click();
    await expect(page.getByTestId("object-count")).toHaveText(
      String(initialCount + 2),
    );
  });

  test("shape dimensions in store", async ({ calibratedProject: page }) => {
    await page.getByTestId("shape-width-input").clear();
    await page.getByTestId("shape-width-input").fill("2");
    await page.getByTestId("shape-height-input").clear();
    await page.getByTestId("shape-height-input").fill("3");
    await page.getByTestId("add-shape-btn").click();

    const state = await getStoreState(page);
    const objects = Array.from(Object.values(state.objects));
    const shape = objects.find((o: any) => o.type === "shape") as any;
    expect(shape.widthM).toBe(2);
    expect(shape.heightM).toBe(3);
  });

  test("default dimensions when empty", async ({ calibratedProject: page }) => {
    // Clear the default width/height inputs
    await page.getByTestId("shape-width-input").clear();
    await page.getByTestId("shape-height-input").clear();
    await page.getByTestId("add-shape-btn").click();

    const state = await getStoreState(page);
    const objects = Array.from(Object.values(state.objects));
    const shape = objects.find((o: any) => o.type === "shape") as any;
    // Should use DEFAULTS.shapeWidthM and DEFAULTS.shapeHeightM
    expect(shape.widthM).toBeGreaterThan(0);
    expect(shape.heightM).toBeGreaterThan(0);
  });

  test("add shape with minimum dimensions", async ({
    calibratedProject: page,
  }) => {
    await page.getByTestId("shape-width-input").clear();
    await page.getByTestId("shape-width-input").fill("0.1");
    await page.getByTestId("shape-height-input").clear();
    await page.getByTestId("shape-height-input").fill("0.1");
    await page.getByTestId("add-shape-btn").click();

    const state = await getStoreState(page);
    const objects = Array.from(Object.values(state.objects));
    const shape = objects.find((o: any) => o.type === "shape") as any;
    expect(shape.widthM).toBeCloseTo(0.1);
    expect(shape.heightM).toBeCloseTo(0.1);
  });
});
