import path from "path";
import { test, expect } from "../fixtures/base.fixture";
import { getStoreState, getObjectCount } from "../fixtures/helpers";

test.describe("Images", () => {
  test("upload overlay image appears in store", async ({
    calibratedProject: page,
  }) => {
    // Switch to Images tab
    await page.getByRole("tab", { name: "Images" }).click();

    // Upload overlay image
    const fileInput = page
      .locator('input[type="file"][accept="image/*"]')
      .last();
    await fileInput.setInputFiles(
      path.join(__dirname, "../fixtures/test-assets/test-100x100.png"),
    );

    // Wait for the overlay to appear in the store
    await page.waitForFunction(
      () => {
        const state = (window as any).__PLANNER_STORE__?.getState();
        if (!state) return false;
        return Array.from(state.objects.values()).some(
          (o: any) => o.type === "overlayImage",
        );
      },
      { timeout: 5000 },
    );

    const state = await getStoreState(page);
    const objects = Array.from(Object.values(state.objects));
    const overlays = objects.filter((o: any) => o.type === "overlayImage");
    expect(overlays.length).toBe(1);
  });

  test("overlay appears in object list", async ({
    calibratedProject: page,
  }) => {
    await page.getByRole("tab", { name: "Images" }).click();

    const fileInput = page
      .locator('input[type="file"][accept="image/*"]')
      .last();
    await fileInput.setInputFiles(
      path.join(__dirname, "../fixtures/test-assets/test-100x100.png"),
    );

    await page.waitForFunction(
      () => {
        const state = (window as any).__PLANNER_STORE__?.getState();
        if (!state) return false;
        return Array.from(state.objects.values()).some(
          (o: any) => o.type === "overlayImage",
        );
      },
      { timeout: 5000 },
    );

    // The object list should contain the overlay (shown as "Image")
    await expect(page.getByTestId("object-list")).toContainText("Image");
  });

  test("delete overlay removes from list", async ({
    calibratedProject: page,
  }) => {
    await page.getByRole("tab", { name: "Images" }).click();

    const fileInput = page
      .locator('input[type="file"][accept="image/*"]')
      .last();
    await fileInput.setInputFiles(
      path.join(__dirname, "../fixtures/test-assets/test-100x100.png"),
    );

    await page.waitForFunction(
      () => {
        const state = (window as any).__PLANNER_STORE__?.getState();
        if (!state) return false;
        return Array.from(state.objects.values()).some(
          (o: any) => o.type === "overlayImage",
        );
      },
      { timeout: 5000 },
    );

    // Get the overlay object id
    const state = await getStoreState(page);
    const objects = Array.from(Object.entries(state.objects));
    const overlay = objects.find(
      ([, o]: [string, any]) => o.type === "overlayImage",
    );
    expect(overlay).toBeTruthy();
    const overlayId = overlay![0];

    // Click delete on the object item
    const objectItem = page.getByTestId(`object-item-${overlayId}`);
    await objectItem.getByRole("button", { name: /Delete/i }).click();

    // Overlay should be removed
    await page.waitForFunction(
      (id: string) => {
        const s = (window as any).__PLANNER_STORE__?.getState();
        if (!s) return false;
        const objs = Object.values(Object.fromEntries(s.objects));
        return !objs.some((o: any) => o.type === "overlayImage");
      },
      overlayId,
      { timeout: 5000 },
    );
  });

  test("multiple overlays", async ({ calibratedProject: page }) => {
    await page.getByRole("tab", { name: "Images" }).click();

    const fileInput = page
      .locator('input[type="file"][accept="image/*"]')
      .last();

    // Upload two overlay images
    await fileInput.setInputFiles(
      path.join(__dirname, "../fixtures/test-assets/test-100x100.png"),
    );
    await page.waitForFunction(
      () => {
        const state = (window as any).__PLANNER_STORE__?.getState();
        if (!state) return false;
        return (
          Array.from(state.objects.values()).filter(
            (o: any) => o.type === "overlayImage",
          ).length === 1
        );
      },
      { timeout: 5000 },
    );

    await fileInput.setInputFiles(
      path.join(__dirname, "../fixtures/test-assets/test-200x200.png"),
    );
    await page.waitForFunction(
      () => {
        const state = (window as any).__PLANNER_STORE__?.getState();
        if (!state) return false;
        return (
          Array.from(state.objects.values()).filter(
            (o: any) => o.type === "overlayImage",
          ).length === 2
        );
      },
      { timeout: 5000 },
    );

    const state = await getStoreState(page);
    const objects = Array.from(Object.values(state.objects));
    const overlays = objects.filter((o: any) => o.type === "overlayImage");
    expect(overlays.length).toBe(2);
  });

  test("overlay count in object list", async ({ calibratedProject: page }) => {
    await page.getByRole("tab", { name: "Images" }).click();

    const initialText = await page.getByTestId("object-count").textContent();
    const initialCount = parseInt(initialText || "0");

    const fileInput = page
      .locator('input[type="file"][accept="image/*"]')
      .last();
    await fileInput.setInputFiles(
      path.join(__dirname, "../fixtures/test-assets/test-100x100.png"),
    );

    await page.waitForFunction(
      () => {
        const state = (window as any).__PLANNER_STORE__?.getState();
        if (!state) return false;
        return Array.from(state.objects.values()).some(
          (o: any) => o.type === "overlayImage",
        );
      },
      { timeout: 5000 },
    );

    await expect(page.getByTestId("object-count")).toHaveText(
      String(initialCount + 1),
    );
  });
});
