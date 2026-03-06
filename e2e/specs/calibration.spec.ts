import path from "path";
import { test, expect } from "../fixtures/base.fixture";
import {
  getStoreState,
  getMode,
  waitForMode,
  waitForCanvasReady,
  canvasClick,
} from "../fixtures/helpers";

test.describe("Calibration", () => {
  test("start button disabled without background image", async ({
    freshProject: page,
  }) => {
    await expect(page.getByTestId("start-calibration-btn")).toBeDisabled();
  });

  test("start button enabled after loading image", async ({
    freshProject: page,
  }) => {
    // Upload a background image via the sidebar file input
    const fileInput = page
      .locator('input[type="file"][accept="image/*"]')
      .first();
    await fileInput.setInputFiles(
      path.join(__dirname, "../fixtures/test-assets/test-200x200.png"),
    );

    // Wait for image to load into store
    await page.waitForFunction(
      () => {
        const state = (window as any).__PLANNER_STORE__?.getState();
        if (!state) return false;
        return Array.from(state.objects.values()).some(
          (o: any) => o.type === "backgroundImage",
        );
      },
      { timeout: 5000 },
    );

    await expect(page.getByTestId("start-calibration-btn")).toBeEnabled();
  });

  test("mode transitions to calibrating on start", async ({
    freshProject: page,
  }) => {
    // Upload image first
    const fileInput = page
      .locator('input[type="file"][accept="image/*"]')
      .first();
    await fileInput.setInputFiles(
      path.join(__dirname, "../fixtures/test-assets/test-200x200.png"),
    );
    await page.waitForFunction(
      () => {
        const state = (window as any).__PLANNER_STORE__?.getState();
        if (!state) return false;
        return Array.from(state.objects.values()).some(
          (o: any) => o.type === "backgroundImage",
        );
      },
      { timeout: 5000 },
    );

    await page.getByTestId("start-calibration-btn").click();
    await waitForMode(page, "calibrating");

    const mode = await getMode(page);
    expect(mode).toBe("calibrating");
  });

  test("cancel returns to normal mode", async ({ freshProject: page }) => {
    const fileInput = page
      .locator('input[type="file"][accept="image/*"]')
      .first();
    await fileInput.setInputFiles(
      path.join(__dirname, "../fixtures/test-assets/test-200x200.png"),
    );
    await page.waitForFunction(
      () => {
        const state = (window as any).__PLANNER_STORE__?.getState();
        if (!state) return false;
        return Array.from(state.objects.values()).some(
          (o: any) => o.type === "backgroundImage",
        );
      },
      { timeout: 5000 },
    );

    await page.getByTestId("start-calibration-btn").click();
    await waitForMode(page, "calibrating");

    await page.getByTestId("cancel-calibration-btn").click();
    await waitForMode(page, "normal");

    const mode = await getMode(page);
    expect(mode).toBe("normal");
  });

  test("escape key cancels calibration", async ({ freshProject: page }) => {
    const fileInput = page
      .locator('input[type="file"][accept="image/*"]')
      .first();
    await fileInput.setInputFiles(
      path.join(__dirname, "../fixtures/test-assets/test-200x200.png"),
    );
    await page.waitForFunction(
      () => {
        const state = (window as any).__PLANNER_STORE__?.getState();
        if (!state) return false;
        return Array.from(state.objects.values()).some(
          (o: any) => o.type === "backgroundImage",
        );
      },
      { timeout: 5000 },
    );

    await page.getByTestId("start-calibration-btn").click();
    await waitForMode(page, "calibrating");

    await page.keyboard.press("Escape");
    await waitForMode(page, "normal");

    const mode = await getMode(page);
    expect(mode).toBe("normal");
  });

  test("draw calibration line shows input", async ({ freshProject: page }) => {
    const fileInput = page
      .locator('input[type="file"][accept="image/*"]')
      .first();
    await fileInput.setInputFiles(
      path.join(__dirname, "../fixtures/test-assets/test-200x200.png"),
    );
    await page.waitForFunction(
      () => {
        const state = (window as any).__PLANNER_STORE__?.getState();
        if (!state) return false;
        return Array.from(state.objects.values()).some(
          (o: any) => o.type === "backgroundImage",
        );
      },
      { timeout: 5000 },
    );

    await page.getByTestId("start-calibration-btn").click();
    await waitForMode(page, "calibrating");

    // Draw calibration line on canvas (two clicks)
    await canvasClick(page, 100, 200);
    await canvasClick(page, 200, 200);

    // The calibration length input should appear
    await expect(page.locator("#calibration-length")).toBeVisible({
      timeout: 5000,
    });
  });

  test("apply sets scale", async ({ freshProject: page }) => {
    const fileInput = page
      .locator('input[type="file"][accept="image/*"]')
      .first();
    await fileInput.setInputFiles(
      path.join(__dirname, "../fixtures/test-assets/test-200x200.png"),
    );
    await page.waitForFunction(
      () => {
        const state = (window as any).__PLANNER_STORE__?.getState();
        if (!state) return false;
        return Array.from(state.objects.values()).some(
          (o: any) => o.type === "backgroundImage",
        );
      },
      { timeout: 5000 },
    );

    await page.getByTestId("start-calibration-btn").click();
    await waitForMode(page, "calibrating");

    await canvasClick(page, 100, 200);
    await canvasClick(page, 200, 200);

    await expect(page.locator("#calibration-length")).toBeVisible({
      timeout: 5000,
    });
    await page.locator("#calibration-length").fill("1.0");
    await page.getByTestId("apply-calibration-btn").click();

    // Mode returns to normal and scale is set
    await waitForMode(page, "normal");
    const state = await getStoreState(page);
    expect(state.pixelsPerMeter).toBeGreaterThan(0);
  });

  test("validation: empty input shows error", async ({
    freshProject: page,
  }) => {
    const fileInput = page
      .locator('input[type="file"][accept="image/*"]')
      .first();
    await fileInput.setInputFiles(
      path.join(__dirname, "../fixtures/test-assets/test-200x200.png"),
    );
    await page.waitForFunction(
      () => {
        const state = (window as any).__PLANNER_STORE__?.getState();
        if (!state) return false;
        return Array.from(state.objects.values()).some(
          (o: any) => o.type === "backgroundImage",
        );
      },
      { timeout: 5000 },
    );

    await page.getByTestId("start-calibration-btn").click();
    await waitForMode(page, "calibrating");

    await canvasClick(page, 100, 200);
    await canvasClick(page, 200, 200);
    await expect(page.locator("#calibration-length")).toBeVisible({
      timeout: 5000,
    });

    // Click apply without entering a value
    await page.getByTestId("apply-calibration-btn").click();

    await expect(page.locator("#calibration-error")).toBeVisible();
    await expect(page.locator("#calibration-error")).toHaveText(
      "Please enter a length value",
    );
  });

  test("validation: negative value shows error", async ({
    freshProject: page,
  }) => {
    const fileInput = page
      .locator('input[type="file"][accept="image/*"]')
      .first();
    await fileInput.setInputFiles(
      path.join(__dirname, "../fixtures/test-assets/test-200x200.png"),
    );
    await page.waitForFunction(
      () => {
        const state = (window as any).__PLANNER_STORE__?.getState();
        if (!state) return false;
        return Array.from(state.objects.values()).some(
          (o: any) => o.type === "backgroundImage",
        );
      },
      { timeout: 5000 },
    );

    await page.getByTestId("start-calibration-btn").click();
    await waitForMode(page, "calibrating");

    await canvasClick(page, 100, 200);
    await canvasClick(page, 200, 200);
    await expect(page.locator("#calibration-length")).toBeVisible({
      timeout: 5000,
    });

    await page.locator("#calibration-length").fill("-5");
    await page.getByTestId("apply-calibration-btn").click();

    await expect(page.locator("#calibration-error")).toBeVisible();
    await expect(page.locator("#calibration-error")).toHaveText(
      "Length must be a positive number",
    );
  });

  test("validation: zero shows error", async ({ freshProject: page }) => {
    const fileInput = page
      .locator('input[type="file"][accept="image/*"]')
      .first();
    await fileInput.setInputFiles(
      path.join(__dirname, "../fixtures/test-assets/test-200x200.png"),
    );
    await page.waitForFunction(
      () => {
        const state = (window as any).__PLANNER_STORE__?.getState();
        if (!state) return false;
        return Array.from(state.objects.values()).some(
          (o: any) => o.type === "backgroundImage",
        );
      },
      { timeout: 5000 },
    );

    await page.getByTestId("start-calibration-btn").click();
    await waitForMode(page, "calibrating");

    await canvasClick(page, 100, 200);
    await canvasClick(page, 200, 200);
    await expect(page.locator("#calibration-length")).toBeVisible({
      timeout: 5000,
    });

    await page.locator("#calibration-length").fill("0");
    await page.getByTestId("apply-calibration-btn").click();

    await expect(page.locator("#calibration-error")).toBeVisible();
    await expect(page.locator("#calibration-error")).toHaveText(
      "Length must be a positive number",
    );
  });

  test("re-calibration overwrites previous scale", async ({
    calibratedProject: page,
  }) => {
    // Already calibrated at 100px/m. Get initial scale.
    const initialState = await getStoreState(page);
    const initialScale = initialState.pixelsPerMeter;
    expect(initialScale).toBeTruthy();

    // Start a new calibration
    await page.getByTestId("start-calibration-btn").click();
    await waitForMode(page, "calibrating");

    // Draw a new calibration line
    await canvasClick(page, 100, 200);
    await canvasClick(page, 200, 200);
    await expect(page.locator("#calibration-length")).toBeVisible({
      timeout: 5000,
    });

    // Enter a different value (2 meters for the same pixel distance = half the px/m)
    await page.locator("#calibration-length").fill("2.0");
    await page.getByTestId("apply-calibration-btn").click();
    await waitForMode(page, "normal");

    const newState = await getStoreState(page);
    expect(newState.pixelsPerMeter).toBeGreaterThan(0);
    expect(newState.pixelsPerMeter).not.toBe(initialScale);
  });

  test("mode badge shows Calibrating during calibration", async ({
    freshProject: page,
  }) => {
    const fileInput = page
      .locator('input[type="file"][accept="image/*"]')
      .first();
    await fileInput.setInputFiles(
      path.join(__dirname, "../fixtures/test-assets/test-200x200.png"),
    );
    await page.waitForFunction(
      () => {
        const state = (window as any).__PLANNER_STORE__?.getState();
        if (!state) return false;
        return Array.from(state.objects.values()).some(
          (o: any) => o.type === "backgroundImage",
        );
      },
      { timeout: 5000 },
    );

    await page.getByTestId("start-calibration-btn").click();
    await waitForMode(page, "calibrating");

    await expect(page.getByTestId("mode-badge")).toHaveText("Calibrating");
  });
});
