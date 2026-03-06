import { test, expect } from "../fixtures/base.fixture";

test.describe("Responsive Layout", () => {
  test("sidebar hidden on mobile by default", async ({
    freshProject: page,
  }) => {
    const sidebar = page.getByTestId("sidebar");
    await expect(sidebar).not.toBeInViewport();
  });

  test("hamburger button opens sidebar", async ({ freshProject: page }) => {
    await page.getByLabel("Open sidebar").click();
    const sidebar = page.getByTestId("sidebar");
    await expect(sidebar).toBeInViewport();
  });

  test("backdrop closes sidebar", async ({ freshProject: page }) => {
    await page.getByLabel("Open sidebar").click();
    await expect(page.getByTestId("sidebar")).toBeInViewport();

    // Click the backdrop overlay
    await page.locator(".fixed.inset-0.bg-black\\/50").click();
    await expect(page.getByTestId("sidebar")).not.toBeInViewport();
  });

  test("close button closes sidebar", async ({ freshProject: page }) => {
    await page.getByLabel("Open sidebar").click();
    await expect(page.getByTestId("sidebar")).toBeInViewport();

    await page.getByLabel("Close sidebar").click();
    await expect(page.getByTestId("sidebar")).not.toBeInViewport();
  });
});
