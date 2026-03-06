import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/specs",
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:4000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      threshold: 0.3,
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 5"] },
      testMatch: "responsive.spec.ts",
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:4000",
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
