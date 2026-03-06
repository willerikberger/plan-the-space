import path from "path";
import { test, expect } from "../fixtures/base.fixture";
import {
  getStoreState,
  waitForCanvasReady,
  clearIndexedDB,
} from "../fixtures/helpers";

test.describe("Project Management", () => {
  test("shows empty state on first visit", async ({
    projectPickerPage: page,
  }) => {
    await expect(page.getByTestId("empty-projects")).toBeVisible();
    await expect(page.getByTestId("project-grid")).not.toBeVisible();
  });

  test("wizard: create project full flow", async ({
    projectPickerPage: page,
  }) => {
    await page.getByTestId("new-project-btn").click();
    await expect(page.getByTestId("new-project-wizard")).toBeVisible();

    // Step 1: fill name
    await page.getByTestId("wizard-name-input").fill("My Test Project");
    await page.getByTestId("wizard-next-btn").click();

    // Step 2: skip background image
    await page.getByTestId("wizard-skip-btn").click();

    // Should transition to canvas view
    await expect(
      page.locator('canvas[aria-label="Floor plan design canvas"]'),
    ).toBeVisible({ timeout: 10000 });
  });

  test("wizard: Next button disabled without name", async ({
    projectPickerPage: page,
  }) => {
    await page.getByTestId("new-project-btn").click();
    await expect(page.getByTestId("wizard-next-btn")).toBeDisabled();

    // Type a name, then clear it
    await page.getByTestId("wizard-name-input").fill("temp");
    await expect(page.getByTestId("wizard-next-btn")).toBeEnabled();

    await page.getByTestId("wizard-name-input").clear();
    await expect(page.getByTestId("wizard-next-btn")).toBeDisabled();
  });

  test("wizard: Back button returns to step 1", async ({
    projectPickerPage: page,
  }) => {
    await page.getByTestId("new-project-btn").click();
    await page.getByTestId("wizard-name-input").fill("Test");
    await page.getByTestId("wizard-next-btn").click();

    // Now on step 2, click back
    await page.getByTestId("wizard-back-btn").click();

    // Should see step 1 elements again
    await expect(page.getByTestId("wizard-name-input")).toBeVisible();
    // Name should be preserved
    await expect(page.getByTestId("wizard-name-input")).toHaveValue("Test");
  });

  test("wizard: Cancel closes wizard", async ({ projectPickerPage: page }) => {
    await page.getByTestId("new-project-btn").click();
    await expect(page.getByTestId("new-project-wizard")).toBeVisible();

    // Cancel button (ghost variant)
    await page.getByRole("button", { name: "Cancel" }).click();

    await expect(page.getByTestId("new-project-wizard")).not.toBeVisible();
  });

  test("open existing project", async ({ projectPickerPage: page }) => {
    // Create a project first
    await page.getByTestId("new-project-btn").click();
    await page.getByTestId("wizard-name-input").fill("Openable Project");
    await page.getByTestId("wizard-next-btn").click();
    await page.getByTestId("wizard-skip-btn").click();
    await expect(
      page.locator('canvas[aria-label="Floor plan design canvas"]'),
    ).toBeVisible({ timeout: 10000 });

    // Go home
    await page.getByTestId("home-btn").click();
    await expect(page.getByTestId("project-grid")).toBeVisible();

    // Click on the project card
    await page
      .getByRole("button", { name: "Open project Openable Project" })
      .click();
    await expect(
      page.locator('canvas[aria-label="Floor plan design canvas"]'),
    ).toBeVisible({ timeout: 10000 });
  });

  test("rename project", async ({ projectPickerPage: page }) => {
    // Create a project
    await page.getByTestId("new-project-btn").click();
    await page.getByTestId("wizard-name-input").fill("Original Name");
    await page.getByTestId("wizard-next-btn").click();
    await page.getByTestId("wizard-skip-btn").click();
    await expect(
      page.locator('canvas[aria-label="Floor plan design canvas"]'),
    ).toBeVisible({ timeout: 10000 });

    // Go home
    await page.getByTestId("home-btn").click();
    await expect(page.getByTestId("project-grid")).toBeVisible();

    // Get the project ID from store
    const state = await getStoreState(page);
    const projectId = state.projects[0].id;

    // Hover over card to show menu, click menu button
    await page.getByTestId(`project-menu-${projectId}`).click({ force: true });
    await page.getByTestId(`project-rename-${projectId}`).click();

    // Rename dialog
    await expect(page.getByTestId("rename-dialog")).toBeVisible();
    await page.getByTestId("rename-input").clear();
    await page.getByTestId("rename-input").fill("Renamed Project");
    await page.getByTestId("rename-confirm-btn").click();

    // Verify renamed
    await expect(page.getByText("Renamed Project")).toBeVisible();
  });

  test("duplicate project", async ({ projectPickerPage: page }) => {
    // Create a project
    await page.getByTestId("new-project-btn").click();
    await page.getByTestId("wizard-name-input").fill("To Duplicate");
    await page.getByTestId("wizard-next-btn").click();
    await page.getByTestId("wizard-skip-btn").click();
    await expect(
      page.locator('canvas[aria-label="Floor plan design canvas"]'),
    ).toBeVisible({ timeout: 10000 });

    // Go home
    await page.getByTestId("home-btn").click();
    await expect(page.getByTestId("project-grid")).toBeVisible();

    const state = await getStoreState(page);
    const projectId = state.projects[0].id;

    // Open menu and duplicate
    await page.getByTestId(`project-menu-${projectId}`).click({ force: true });
    await page.getByTestId(`project-duplicate-${projectId}`).click();

    // Should now have 2 project cards
    await expect(
      page.getByTestId("project-grid").locator('[role="button"]'),
    ).toHaveCount(2);
  });

  test("soft delete project", async ({ projectPickerPage: page }) => {
    // Create a project
    await page.getByTestId("new-project-btn").click();
    await page.getByTestId("wizard-name-input").fill("Delete Me");
    await page.getByTestId("wizard-next-btn").click();
    await page.getByTestId("wizard-skip-btn").click();
    await expect(
      page.locator('canvas[aria-label="Floor plan design canvas"]'),
    ).toBeVisible({ timeout: 10000 });

    // Go home
    await page.getByTestId("home-btn").click();
    await expect(page.getByTestId("project-grid")).toBeVisible();

    const state = await getStoreState(page);
    const projectId = state.projects[0].id;

    // Delete
    await page.getByTestId(`project-menu-${projectId}`).click({ force: true });
    await page.getByTestId(`project-delete-${projectId}`).click();

    // Project grid should be gone, empty state shows
    await expect(page.getByTestId("empty-projects")).toBeVisible();
    // Trash toggle should appear
    await expect(page.getByTestId("trash-toggle")).toBeVisible();
  });

  test("restore from trash", async ({ projectPickerPage: page }) => {
    // Create and delete a project
    await page.getByTestId("new-project-btn").click();
    await page.getByTestId("wizard-name-input").fill("Restore Me");
    await page.getByTestId("wizard-next-btn").click();
    await page.getByTestId("wizard-skip-btn").click();
    await expect(
      page.locator('canvas[aria-label="Floor plan design canvas"]'),
    ).toBeVisible({ timeout: 10000 });

    await page.getByTestId("home-btn").click();
    await expect(page.getByTestId("project-grid")).toBeVisible();

    const state = await getStoreState(page);
    const projectId = state.projects[0].id;

    await page.getByTestId(`project-menu-${projectId}`).click({ force: true });
    await page.getByTestId(`project-delete-${projectId}`).click();

    // Open trash
    await page.getByTestId("trash-toggle").click();
    await expect(page.getByText("Restore Me")).toBeVisible();

    // Restore
    await page.getByRole("button", { name: "Restore" }).click();

    // Should be back in the grid
    await expect(page.getByTestId("project-grid")).toBeVisible();
    await expect(page.getByText("Restore Me")).toBeVisible();
  });

  test("permanent delete", async ({ projectPickerPage: page }) => {
    // Create and delete a project
    await page.getByTestId("new-project-btn").click();
    await page.getByTestId("wizard-name-input").fill("Gone Forever");
    await page.getByTestId("wizard-next-btn").click();
    await page.getByTestId("wizard-skip-btn").click();
    await expect(
      page.locator('canvas[aria-label="Floor plan design canvas"]'),
    ).toBeVisible({ timeout: 10000 });

    await page.getByTestId("home-btn").click();
    await expect(page.getByTestId("project-grid")).toBeVisible();

    const state = await getStoreState(page);
    const projectId = state.projects[0].id;

    await page.getByTestId(`project-menu-${projectId}`).click({ force: true });
    await page.getByTestId(`project-delete-${projectId}`).click();

    // Open trash and permanently delete
    await page.getByTestId("trash-toggle").click();
    await page.getByRole("button", { name: "Delete Forever" }).click();

    // Trash toggle should be gone (no trashed items)
    await expect(page.getByTestId("trash-toggle")).not.toBeVisible();
    // Empty state
    await expect(page.getByTestId("empty-projects")).toBeVisible();
  });

  test("trash toggle show/hide", async ({ projectPickerPage: page }) => {
    // Create and delete a project
    await page.getByTestId("new-project-btn").click();
    await page.getByTestId("wizard-name-input").fill("Trash Toggle Test");
    await page.getByTestId("wizard-next-btn").click();
    await page.getByTestId("wizard-skip-btn").click();
    await expect(
      page.locator('canvas[aria-label="Floor plan design canvas"]'),
    ).toBeVisible({ timeout: 10000 });

    await page.getByTestId("home-btn").click();
    const state = await getStoreState(page);
    const projectId = state.projects[0].id;

    await page.getByTestId(`project-menu-${projectId}`).click({ force: true });
    await page.getByTestId(`project-delete-${projectId}`).click();

    // Toggle open
    await page.getByTestId("trash-toggle").click();
    await expect(page.getByText("Trash Toggle Test")).toBeVisible();

    // Toggle closed
    await page.getByTestId("trash-toggle").click();
    // The trashed project name should not be visible (collapsed)
    await expect(
      page.getByRole("button", { name: "Restore" }),
    ).not.toBeVisible();
  });

  test("project name shows in toolbar", async ({ freshProject: page }) => {
    await expect(page.getByTestId("project-name")).toHaveText("Test Project");
  });

  test("go home button returns to picker", async ({ freshProject: page }) => {
    await page.getByTestId("home-btn").click();
    // Should see the picker view
    await expect(page.getByTestId("new-project-btn")).toBeVisible();
    await expect(
      page.locator('canvas[aria-label="Floor plan design canvas"]'),
    ).not.toBeVisible();
  });
});
