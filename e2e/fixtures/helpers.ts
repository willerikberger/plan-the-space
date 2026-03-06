import type { Page } from "@playwright/test";

/**
 * Reads the full Zustand store state, converting the objects Map to an array.
 */
export async function getStoreState(page: Page) {
  return page.evaluate(() => {
    const store = (window as any).__PLANNER_STORE__?.getState();
    if (!store) return null;
    return {
      ...store,
      objects: Array.from(store.objects.values()),
    };
  });
}

/**
 * Returns the current planner mode.
 */
export async function getMode(page: Page): Promise<string> {
  return page.evaluate(() => {
    return (window as any).__PLANNER_STORE__?.getState()?.mode ?? "unknown";
  });
}

/**
 * Returns the count of visible objects (shapes, lines, overlayImages).
 */
export async function getObjectCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const store = (window as any).__PLANNER_STORE__?.getState();
    if (!store) return 0;
    const visibleTypes = new Set(["shape", "line", "overlayImage"]);
    let count = 0;
    for (const obj of store.objects.values()) {
      if (visibleTypes.has(obj.type)) count++;
    }
    return count;
  });
}

/**
 * Reads Fabric.js canvas objects with basic properties.
 */
export async function getFabricObjects(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector(
      'canvas[aria-label="Floor plan design canvas"]',
    ) as any;
    const fabric = canvas?.__fabric;
    if (!fabric) return [];
    return fabric.getObjects().map((obj: any) => ({
      type: obj.type,
      objectId: obj.objectId,
      left: obj.left,
      top: obj.top,
      width: obj.width,
      height: obj.height,
      scaleX: obj.scaleX,
      scaleY: obj.scaleY,
    }));
  });
}

/**
 * Click at a position relative to the canvas element bounding box.
 */
export async function canvasClick(page: Page, x: number, y: number) {
  const canvas = page.locator('canvas[aria-label="Floor plan design canvas"]');
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas not found");
  await page.mouse.click(box.x + x, box.y + y);
}

/**
 * Drag from one point to another on the canvas (coordinates relative to canvas).
 */
export async function canvasDrag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  steps = 10,
) {
  const canvas = page.locator('canvas[aria-label="Floor plan design canvas"]');
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas not found");
  await page.mouse.move(box.x + from.x, box.y + from.y);
  await page.mouse.down();
  await page.mouse.move(box.x + to.x, box.y + to.y, { steps });
  await page.mouse.up();
}

/**
 * Dispatch a wheel event at a canvas position.
 */
export async function canvasScroll(
  page: Page,
  x: number,
  y: number,
  deltaY: number,
) {
  const canvas = page.locator('canvas[aria-label="Floor plan design canvas"]');
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas not found");
  // Position the mouse first, then scroll
  await page.mouse.move(box.x + x, box.y + y);
  await page.mouse.wheel(0, deltaY);
}

/**
 * Waits for the canvas element and Fabric.js instance to be ready.
 */
export async function waitForCanvasReady(page: Page) {
  await page.waitForSelector('canvas[aria-label="Floor plan design canvas"]', {
    timeout: 15000,
  });
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector(
        'canvas[aria-label="Floor plan design canvas"]',
      ) as any;
      return canvas && canvas.__fabric;
    },
    { timeout: 15000 },
  );
}

/**
 * Polls the store until the mode matches the expected value.
 */
export async function waitForMode(page: Page, mode: string) {
  await page.waitForFunction(
    (m) => {
      const store = (window as any).__PLANNER_STORE__?.getState();
      return store?.mode === m;
    },
    mode,
    { timeout: 10000 },
  );
}

/**
 * Waits long enough for the auto-save debounce (2s) to complete.
 */
export async function waitForAutoSave(page: Page) {
  await page.waitForTimeout(3000);
}

/**
 * Deletes the PlanTheSpaceDB IndexedDB database.
 */
export async function clearIndexedDB(page: Page) {
  await page.evaluate(() => {
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase("PlanTheSpaceDB");
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => resolve();
    });
  });
}
