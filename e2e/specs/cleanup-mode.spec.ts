import { test, expect } from "../fixtures/base.fixture";
import {
  getMode,
  getObjectCount,
  canvasDrag,
  waitForMode,
} from "../fixtures/helpers";

test.describe("Cleanup Mode", () => {
  test("toggle to cleanup mode", async ({ page, calibratedProject }) => {
    await page.getByRole("radio", { name: "Cleanup Mode" }).click();
    await waitForMode(page, "cleanup");
    expect(await getMode(page)).toBe("cleanup");
  });

  test("cleanup panel shows instructions", async ({
    page,
    calibratedProject,
  }) => {
    await page.getByRole("radio", { name: "Cleanup Mode" }).click();
    await waitForMode(page, "cleanup");
    await expect(page.getByTestId("draw-mask-btn")).toBeVisible();
  });

  test("draw mask rectangle", async ({ page, calibratedProject }) => {
    await page.getByRole("radio", { name: "Cleanup Mode" }).click();
    await waitForMode(page, "cleanup");

    await page.getByTestId("draw-mask-btn").click();
    await waitForMode(page, "drawing-mask");

    await canvasDrag(page, { x: 100, y: 100 }, { x: 300, y: 300 });
    await waitForMode(page, "cleanup");

    // Verify mask was added to store
    const hasMask = await page.evaluate(() => {
      const store = (window as any).__PLANNER_STORE__?.getState();
      if (!store) return false;
      for (const obj of store.objects.values()) {
        if (obj.type === "mask") return true;
      }
      return false;
    });
    expect(hasMask).toBe(true);
  });

  test("drawing mask does not move background image", async ({
    page,
    calibratedProject,
  }) => {
    await page.getByRole("radio", { name: "Cleanup Mode" }).click();
    await waitForMode(page, "cleanup");
    await page.getByTestId("draw-mask-btn").click();
    await waitForMode(page, "drawing-mask");

    const before = await page.evaluate(() => {
      const fabric = (
        document.querySelector(
          'canvas[aria-label="Floor plan design canvas"]',
        ) as any
      )?.__fabric;
      if (!fabric) return null;
      const bg = fabric
        .getObjects()
        .find((obj: any) => obj.objectType === "backgroundImage");
      if (!bg) return null;
      return {
        left: bg.left ?? 0,
        top: bg.top ?? 0,
      };
    });
    expect(before).toBeTruthy();

    await canvasDrag(page, { x: 220, y: 140 }, { x: 340, y: 260 });
    await waitForMode(page, "cleanup");

    const after = await page.evaluate(() => {
      const fabric = (
        document.querySelector(
          'canvas[aria-label="Floor plan design canvas"]',
        ) as any
      )?.__fabric;
      if (!fabric) return null;
      const bg = fabric
        .getObjects()
        .find((obj: any) => obj.objectType === "backgroundImage");
      if (!bg) return null;
      return {
        left: bg.left ?? 0,
        top: bg.top ?? 0,
      };
    });

    expect(after).toEqual(before);
  });

  test("mask too small rejected", async ({ page, calibratedProject }) => {
    await page.getByRole("radio", { name: "Cleanup Mode" }).click();
    await waitForMode(page, "cleanup");

    await page.getByTestId("draw-mask-btn").click();
    await waitForMode(page, "drawing-mask");

    // Draw a very tiny mask (< 5px)
    await canvasDrag(page, { x: 200, y: 200 }, { x: 202, y: 202 });

    // Should still be in drawing-mask or cleanup, but no mask added
    const maskCount = await page.evaluate(() => {
      const store = (window as any).__PLANNER_STORE__?.getState();
      if (!store) return 0;
      let count = 0;
      for (const obj of store.objects.values()) {
        if (obj.type === "mask") count++;
      }
      return count;
    });
    expect(maskCount).toBe(0);
  });

  test("exit cleanup mode", async ({ page, calibratedProject }) => {
    await page.getByRole("radio", { name: "Cleanup Mode" }).click();
    await waitForMode(page, "cleanup");

    await page.getByRole("radio", { name: "Normal Mode" }).click();
    await waitForMode(page, "normal");
    expect(await getMode(page)).toBe("normal");
  });

  test("content objects hidden in cleanup", async ({
    page,
    calibratedProject,
  }) => {
    // Add a shape in normal mode
    await page.getByTestId("add-shape-btn").click();
    await page.waitForTimeout(200);
    expect(await getObjectCount(page)).toBe(1);

    // Switch to cleanup mode
    await page.getByRole("radio", { name: "Cleanup Mode" }).click();
    await waitForMode(page, "cleanup");

    // Shape should not be visible on canvas (fabric objects filtered)
    const fabricObjectCount = await page.evaluate(() => {
      const canvas = document.querySelector(
        'canvas[aria-label="Floor plan design canvas"]',
      ) as any;
      const fabric = canvas?.__fabric;
      if (!fabric) return 0;
      return fabric
        .getObjects()
        .filter(
          (obj: any) =>
            (obj.objectType === "shape" || obj.objectType === "line") &&
            obj.visible !== false,
        ).length;
    });
    expect(fabricObjectCount).toBe(0);
  });

  test("escape cancels mask drawing but stays in cleanup", async ({
    page,
    calibratedProject,
  }) => {
    await page.getByRole("radio", { name: "Cleanup Mode" }).click();
    await waitForMode(page, "cleanup");

    await page.getByTestId("draw-mask-btn").click();
    await waitForMode(page, "drawing-mask");

    await page.keyboard.press("Escape");
    await waitForMode(page, "cleanup");
    expect(await getMode(page)).toBe("cleanup");
  });

  test("draw mask button disabled during drawing", async ({
    page,
    calibratedProject,
  }) => {
    await page.getByRole("radio", { name: "Cleanup Mode" }).click();
    await waitForMode(page, "cleanup");

    await page.getByTestId("draw-mask-btn").click();
    await waitForMode(page, "drawing-mask");

    await expect(page.getByTestId("draw-mask-btn")).toBeDisabled();
  });

  test("mode badge shows Cleanup Mode", async ({ page, calibratedProject }) => {
    await page.getByRole("radio", { name: "Cleanup Mode" }).click();
    await waitForMode(page, "cleanup");

    await expect(page.getByTestId("mode-badge")).toContainText(/cleanup/i);
  });
});
