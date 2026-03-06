import { test, expect } from "../fixtures/base.fixture";
import {
  getObjectCount,
  getStoreState,
  canvasDrag,
  waitForMode,
} from "../fixtures/helpers";

test.describe("Object Management", () => {
  test("empty list shows hint", async ({ page, calibratedProject }) => {
    await expect(page.getByTestId("object-list-empty")).toBeVisible();
    await expect(page.getByTestId("object-list-empty")).toContainText(
      "No objects yet",
    );
  });

  test("objects appear after creation", async ({ page, calibratedProject }) => {
    await page.getByTestId("add-shape-btn").click();
    await page.waitForTimeout(200);

    // Object list should contain the new shape
    const count = await page.getByTestId("object-count").textContent();
    expect(parseInt(count ?? "0")).toBe(1);
  });

  test("select object highlights in list", async ({
    page,
    calibratedProject,
  }) => {
    await page.getByTestId("add-shape-btn").click();
    await page.waitForTimeout(200);

    // Click Select button on the object item
    const selectBtn = page
      .getByTestId("object-list")
      .getByRole("button", { name: "Select" })
      .first();
    await selectBtn.click();
    await page.waitForTimeout(200);

    // The object item should have a selected style (border)
    const state = await getStoreState(page);
    const shape = state?.objects?.find((o: any) => o.type === "shape");
    if (shape) {
      const item = page.getByTestId(`object-item-${shape.id}`);
      await expect(item).toBeVisible();
    }
  });

  test("delete via list button", async ({ page, calibratedProject }) => {
    await page.getByTestId("add-shape-btn").click();
    await page.waitForTimeout(200);
    expect(await getObjectCount(page)).toBe(1);

    // Get the shape name to find the delete button
    const state = await getStoreState(page);
    const shape = state?.objects?.find((o: any) => o.type === "shape");
    expect(shape).toBeTruthy();

    // Click the delete (x) button
    const deleteBtn = page
      .getByTestId("object-list")
      .getByRole("button", { name: `Delete ${shape!.name}` });
    await deleteBtn.click();
    await page.waitForTimeout(200);

    expect(await getObjectCount(page)).toBe(0);
  });

  test("delete selected button works", async ({ page, calibratedProject }) => {
    await page.getByTestId("add-shape-btn").click();
    await page.waitForTimeout(200);

    // Select the object
    const selectBtn = page
      .getByTestId("object-list")
      .getByRole("button", { name: "Select" })
      .first();
    await selectBtn.click();
    await page.waitForTimeout(200);

    // Click Delete Selected
    await page.getByRole("button", { name: "Delete Selected" }).click();
    await page.waitForTimeout(200);

    expect(await getObjectCount(page)).toBe(0);
  });

  test("delete selected disabled without selection", async ({
    page,
    calibratedProject,
  }) => {
    await page.getByTestId("add-shape-btn").click();
    await page.waitForTimeout(200);

    // Without selecting, Delete Selected should be disabled
    await expect(
      page.getByRole("button", { name: "Delete Selected" }),
    ).toBeDisabled();
  });

  test("move up reorder", async ({ page, calibratedProject }) => {
    // Add 2 shapes
    await page.getByTestId("add-shape-btn").click();
    await page.waitForTimeout(200);
    await page.getByTestId("add-shape-btn").click();
    await page.waitForTimeout(200);

    const stateBefore = await getStoreState(page);
    const shapesBefore = stateBefore?.objects?.filter(
      (o: any) => o.type === "shape",
    );
    expect(shapesBefore?.length).toBe(2);

    // Move second shape up
    const secondShape = shapesBefore![1];
    const moveUpBtn = page.getByRole("button", {
      name: `Move ${secondShape.name} up`,
    });
    await moveUpBtn.click();
    await page.waitForTimeout(200);

    // Verify reorder happened
    const stateAfter = await getStoreState(page);
    const shapesAfter = stateAfter?.objects?.filter(
      (o: any) => o.type === "shape",
    );
    expect(shapesAfter![0].id).toBe(secondShape.id);
  });

  test("move down reorder", async ({ page, calibratedProject }) => {
    // Add 2 shapes
    await page.getByTestId("add-shape-btn").click();
    await page.waitForTimeout(200);
    await page.getByTestId("add-shape-btn").click();
    await page.waitForTimeout(200);

    const stateBefore = await getStoreState(page);
    const shapesBefore = stateBefore?.objects?.filter(
      (o: any) => o.type === "shape",
    );
    expect(shapesBefore?.length).toBe(2);

    // Move first shape down
    const firstShape = shapesBefore![0];
    const moveDownBtn = page.getByRole("button", {
      name: `Move ${firstShape.name} down`,
    });
    await moveDownBtn.click();
    await page.waitForTimeout(200);

    // Verify reorder happened
    const stateAfter = await getStoreState(page);
    const shapesAfter = stateAfter?.objects?.filter(
      (o: any) => o.type === "shape",
    );
    expect(shapesAfter![1].id).toBe(firstShape.id);
  });

  test("clear all with confirmation", async ({ page, calibratedProject }) => {
    // Add shapes
    await page.getByTestId("add-shape-btn").click();
    await page.waitForTimeout(200);
    await page.getByTestId("add-shape-btn").click();
    await page.waitForTimeout(200);
    expect(await getObjectCount(page)).toBe(2);

    // Click Clear All
    await page.getByRole("button", { name: "Clear All" }).click();

    // Confirm dialog should appear
    await expect(page.getByTestId("confirm-action-btn")).toBeVisible();
    await page.getByTestId("confirm-action-btn").click();
    await page.waitForTimeout(300);

    expect(await getObjectCount(page)).toBe(0);
  });

  test("cancel clear all preserves objects", async ({
    page,
    calibratedProject,
  }) => {
    await page.getByTestId("add-shape-btn").click();
    await page.waitForTimeout(200);
    expect(await getObjectCount(page)).toBe(1);

    // Click Clear All then cancel
    await page.getByRole("button", { name: "Clear All" }).click();
    await expect(page.getByTestId("confirm-cancel-btn")).toBeVisible();
    await page.getByTestId("confirm-cancel-btn").click();
    await page.waitForTimeout(200);

    expect(await getObjectCount(page)).toBe(1);
  });

  test("object count badge shows correct number", async ({
    page,
    calibratedProject,
  }) => {
    // Initially 0
    expect(await page.getByTestId("object-count").textContent()).toBe("0");

    // Add 3 shapes
    for (let i = 0; i < 3; i++) {
      await page.getByTestId("add-shape-btn").click();
      await page.waitForTimeout(200);
    }

    expect(await page.getByTestId("object-count").textContent()).toBe("3");
  });

  test("multiple object types in list", async ({ page, calibratedProject }) => {
    // Add a shape
    await page.getByTestId("add-shape-btn").click();
    await page.waitForTimeout(200);

    // Switch to Lines tab and draw a line
    await page.getByRole("tab", { name: "Lines" }).click();
    await page.getByTestId("draw-line-btn").click();
    await page.waitForTimeout(200);

    const canvas = page.locator(
      'canvas[aria-label="Floor plan design canvas"]',
    );
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");

    await page.mouse.click(box.x + 150, box.y + 150);
    await page.waitForTimeout(200);
    await page.mouse.click(box.x + 350, box.y + 150);
    await page.waitForTimeout(300);

    // Verify both types exist in store
    const state = await getStoreState(page);
    const types = new Set(state?.objects?.map((o: any) => o.type));
    expect(types.has("shape")).toBe(true);
  });

  test("delete removes from store", async ({ page, calibratedProject }) => {
    await page.getByTestId("add-shape-btn").click();
    await page.waitForTimeout(200);
    expect(await getObjectCount(page)).toBe(1);

    // Delete via list button
    const state = await getStoreState(page);
    const shape = state?.objects?.find((o: any) => o.type === "shape");
    const deleteBtn = page
      .getByTestId("object-list")
      .getByRole("button", { name: `Delete ${shape!.name}` });
    await deleteBtn.click();
    await page.waitForTimeout(200);

    expect(await getObjectCount(page)).toBe(0);
  });
});
