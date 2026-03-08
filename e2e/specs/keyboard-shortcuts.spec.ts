import { test, expect } from "../fixtures/base.fixture";
import { getObjectCount, canvasClick, waitForMode } from "../fixtures/helpers";

test.describe("Keyboard Shortcuts", () => {
  test("Delete key removes selected object", async ({
    calibratedProject: page,
  }) => {
    await page.getByTestId("add-shape-btn").click();
    await page.waitForTimeout(300);
    expect(await getObjectCount(page)).toBe(1);

    // Click on shape at canvas center to select it
    await canvasClick(page, 400, 300);
    await page.waitForTimeout(200);

    await page.keyboard.press("Delete");
    await page.waitForTimeout(300);
    expect(await getObjectCount(page)).toBe(0);
  });

  test("Backspace key removes selected object", async ({
    calibratedProject: page,
  }) => {
    await page.getByTestId("add-shape-btn").click();
    await page.waitForTimeout(300);
    expect(await getObjectCount(page)).toBe(1);

    await canvasClick(page, 400, 300);
    await page.waitForTimeout(200);

    await page.keyboard.press("Backspace");
    await page.waitForTimeout(300);
    expect(await getObjectCount(page)).toBe(0);
  });

  test("Escape cancels calibration", async ({ calibratedProject: page }) => {
    await page.getByTestId("start-calibration-btn").click();
    await waitForMode(page, "calibrating");

    await page.keyboard.press("Escape");
    await waitForMode(page, "normal");
  });

  test("Escape cancels line drawing", async ({ calibratedProject: page }) => {
    await page.getByRole("tab", { name: "Lines" }).click();
    await page.getByTestId("draw-line-btn").click();
    await waitForMode(page, "drawing-line");

    await page.keyboard.press("Escape");
    await waitForMode(page, "normal");
  });

  test("Cmd+Z triggers undo", async ({ calibratedProject: page }) => {
    await page.getByTestId("add-shape-btn").click();
    await page.waitForTimeout(300);
    expect(await getObjectCount(page)).toBe(1);

    await canvasClick(page, 100, 100);
    await page.waitForTimeout(100);
    await page.keyboard.press("Meta+z");
    await page.waitForTimeout(500);
    expect(await getObjectCount(page)).toBe(0);
  });

  test("Cmd+Shift+Z triggers redo", async ({ calibratedProject: page }) => {
    await page.getByTestId("add-shape-btn").click();
    await page.waitForTimeout(300);
    expect(await getObjectCount(page)).toBe(1);

    await canvasClick(page, 100, 100);
    await page.waitForTimeout(100);
    await page.keyboard.press("Meta+z");
    await page.waitForTimeout(500);
    expect(await getObjectCount(page)).toBe(0);

    await page.keyboard.press("Meta+Shift+z");
    await page.waitForTimeout(500);
    expect(await getObjectCount(page)).toBe(1);
  });

  test("shortcuts work when canvas focused", async ({
    calibratedProject: page,
  }) => {
    await page.getByTestId("add-shape-btn").click();
    await page.waitForTimeout(300);

    // Click canvas to focus it
    await canvasClick(page, 100, 100);
    await page.waitForTimeout(200);

    await page.keyboard.press("Meta+z");
    await page.waitForTimeout(500);
    expect(await getObjectCount(page)).toBe(0);
  });

  test("shortcuts do not fire when input focused", async ({
    calibratedProject: page,
  }) => {
    await page.getByTestId("add-shape-btn").click();
    await page.waitForTimeout(300);
    expect(await getObjectCount(page)).toBe(1);

    // Focus a text input, then press Delete
    await page.getByTestId("shape-name-input").focus();
    await page.keyboard.press("Delete");
    await page.waitForTimeout(300);

    // Shape should still exist
    expect(await getObjectCount(page)).toBe(1);
  });

  test("G toggles grid visibility", async ({ calibratedProject: page }) => {
    const before = await page.evaluate(
      () =>
        (
          window as unknown as {
            __PLANNER_STORE__: {
              getState: () => { viewAids: { showGrid: boolean } };
            };
          }
        ).__PLANNER_STORE__.getState().viewAids.showGrid,
    );

    await page.keyboard.press("g");

    const after = await page.evaluate(
      () =>
        (
          window as unknown as {
            __PLANNER_STORE__: {
              getState: () => { viewAids: { showGrid: boolean } };
            };
          }
        ).__PLANNER_STORE__.getState().viewAids.showGrid,
    );
    expect(after).toBe(!before);
  });

  test("Shift+G toggles snapping", async ({ calibratedProject: page }) => {
    const before = await page.evaluate(
      () =>
        (
          window as unknown as {
            __PLANNER_STORE__: {
              getState: () => { viewAids: { snapEnabled: boolean } };
            };
          }
        ).__PLANNER_STORE__.getState().viewAids.snapEnabled,
    );

    await page.keyboard.press("Shift+g");

    const after = await page.evaluate(
      () =>
        (
          window as unknown as {
            __PLANNER_STORE__: {
              getState: () => { viewAids: { snapEnabled: boolean } };
            };
          }
        ).__PLANNER_STORE__.getState().viewAids.snapEnabled,
    );
    expect(after).toBe(!before);
  });

  test("Alt+G clears guides", async ({ calibratedProject: page }) => {
    await page.evaluate(() => {
      (
        window as unknown as {
          __PLANNER_STORE__: {
            getState: () => {
              addGuide: (axis: "x" | "y", valueM: number) => void;
            };
          };
        }
      ).__PLANNER_STORE__
        .getState()
        .addGuide("x", 2.5);
    });

    await page.keyboard.press("Alt+g");

    const guidesCount = await page.evaluate(
      () =>
        (
          window as unknown as {
            __PLANNER_STORE__: {
              getState: () => { viewAids: { guides: unknown[] } };
            };
          }
        ).__PLANNER_STORE__.getState().viewAids.guides.length,
    );
    expect(guidesCount).toBe(0);
  });
});
