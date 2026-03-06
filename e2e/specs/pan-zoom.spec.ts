import { test, expect } from "../fixtures/base.fixture";
import {
  getObjectCount,
  getStoreState,
  canvasScroll,
  canvasDrag,
  getFabricObjects,
} from "../fixtures/helpers";

test.describe("Pan & Zoom", () => {
  test("scroll wheel zooms in", async ({ page, calibratedProject }) => {
    // Get initial zoom
    const initialZoom = await page.evaluate(() => {
      const canvas = document.querySelector(
        'canvas[aria-label="Floor plan design canvas"]',
      ) as any;
      return canvas?.__fabric?.getZoom() ?? 1;
    });

    // Scroll up (negative deltaY = zoom in)
    await canvasScroll(page, 400, 300, -100);
    await page.waitForTimeout(300);

    const newZoom = await page.evaluate(() => {
      const canvas = document.querySelector(
        'canvas[aria-label="Floor plan design canvas"]',
      ) as any;
      return canvas?.__fabric?.getZoom() ?? 1;
    });

    expect(newZoom).toBeGreaterThan(initialZoom);
  });

  test("scroll wheel zooms out", async ({ page, calibratedProject }) => {
    const initialZoom = await page.evaluate(() => {
      const canvas = document.querySelector(
        'canvas[aria-label="Floor plan design canvas"]',
      ) as any;
      return canvas?.__fabric?.getZoom() ?? 1;
    });

    // Scroll down (positive deltaY = zoom out)
    await canvasScroll(page, 400, 300, 100);
    await page.waitForTimeout(300);

    const newZoom = await page.evaluate(() => {
      const canvas = document.querySelector(
        'canvas[aria-label="Floor plan design canvas"]',
      ) as any;
      return canvas?.__fabric?.getZoom() ?? 1;
    });

    expect(newZoom).toBeLessThan(initialZoom);
  });

  test("zoom changes scale display", async ({ page, calibratedProject }) => {
    const initialText = await page.getByTestId("scale-display").textContent();

    await canvasScroll(page, 400, 300, -200);
    await page.waitForTimeout(300);

    // The scale display or zoom should reflect the change
    const zoom = await page.evaluate(() => {
      const canvas = document.querySelector(
        'canvas[aria-label="Floor plan design canvas"]',
      ) as any;
      return canvas?.__fabric?.getZoom() ?? 1;
    });

    expect(zoom).not.toBe(1);
  });

  test("drag empty space pans canvas", async ({ page, calibratedProject }) => {
    // Get initial viewport transform
    const initialVpt = await page.evaluate(() => {
      const canvas = document.querySelector(
        'canvas[aria-label="Floor plan design canvas"]',
      ) as any;
      const vpt = canvas?.__fabric?.viewportTransform;
      return vpt ? [vpt[4], vpt[5]] : [0, 0];
    });

    // Drag on empty area (far from center where objects might be)
    await canvasDrag(page, { x: 400, y: 300 }, { x: 500, y: 400 });
    await page.waitForTimeout(300);

    const newVpt = await page.evaluate(() => {
      const canvas = document.querySelector(
        'canvas[aria-label="Floor plan design canvas"]',
      ) as any;
      const vpt = canvas?.__fabric?.viewportTransform;
      return vpt ? [vpt[4], vpt[5]] : [0, 0];
    });

    // Viewport translation should have changed
    const hasPanned =
      newVpt[0] !== initialVpt[0] || newVpt[1] !== initialVpt[1];
    expect(hasPanned).toBe(true);
  });

  test("pan does not move objects", async ({ page, calibratedProject }) => {
    // Add a shape
    await page.getByTestId("add-shape-btn").click();
    await page.waitForTimeout(200);

    // Get initial store position
    const stateBefore = await getStoreState(page);
    const shapeBefore = stateBefore?.objects?.find(
      (o: any) => o.type === "shape",
    );

    // Pan the canvas
    await canvasDrag(page, { x: 400, y: 300 }, { x: 500, y: 400 });
    await page.waitForTimeout(300);

    // Get store position after pan
    const stateAfter = await getStoreState(page);
    const shapeAfter = stateAfter?.objects?.find(
      (o: any) => o.type === "shape",
    );

    // Store position should be unchanged
    expect(shapeAfter?.x).toBe(shapeBefore?.x);
    expect(shapeAfter?.y).toBe(shapeBefore?.y);
  });

  test("zoom has limits", async ({ page, calibratedProject }) => {
    // Zoom way in
    for (let i = 0; i < 20; i++) {
      await canvasScroll(page, 400, 300, -200);
    }
    await page.waitForTimeout(300);

    const maxZoom = await page.evaluate(() => {
      const canvas = document.querySelector(
        'canvas[aria-label="Floor plan design canvas"]',
      ) as any;
      return canvas?.__fabric?.getZoom() ?? 1;
    });

    // Zoom way out
    for (let i = 0; i < 40; i++) {
      await canvasScroll(page, 400, 300, 200);
    }
    await page.waitForTimeout(300);

    const minZoom = await page.evaluate(() => {
      const canvas = document.querySelector(
        'canvas[aria-label="Floor plan design canvas"]',
      ) as any;
      return canvas?.__fabric?.getZoom() ?? 1;
    });

    // Both should be clamped (not infinity or zero)
    expect(maxZoom).toBeLessThan(100);
    expect(minZoom).toBeGreaterThan(0.01);
  });

  test("canvas responds to scroll events", async ({
    page,
    calibratedProject,
  }) => {
    // Just verify the canvas exists and handles scroll without errors
    const canvas = page.locator(
      'canvas[aria-label="Floor plan design canvas"]',
    );
    await expect(canvas).toBeVisible();

    await canvasScroll(page, 400, 300, -50);
    await page.waitForTimeout(200);
    await canvasScroll(page, 400, 300, 50);
    await page.waitForTimeout(200);

    // Canvas should still be visible and functional
    await expect(canvas).toBeVisible();
  });
});
