import { test, expect } from "../fixtures/base.fixture";

test.describe("Grid and guides", () => {
  test("persists view aids settings and guides through save/load", async ({
    calibratedProject: page,
  }) => {
    // Set a known view-aids state
    await page.evaluate(() => {
      const store = (
        window as unknown as {
          __PLANNER_STORE__: {
            getState: () => {
              setViewAids: (partial: {
                showGrid?: boolean;
                gridStepM?: number;
                majorEvery?: number;
                snapEnabled?: boolean;
              }) => void;
              addGuide: (
                axis: "x" | "y",
                valueM: number,
                id?: string,
              ) => string;
              clearGuides: () => void;
            };
          };
        }
      ).__PLANNER_STORE__.getState();
      store.clearGuides();
      store.setViewAids({
        showGrid: false,
        snapEnabled: true,
        gridStepM: 1,
        majorEvery: 4,
      });
      store.addGuide("x", 2.5, "guide-persist");
    });

    await page.getByTestId("save-btn").click();
    await page.waitForTimeout(300);

    // Mutate state away from saved value
    await page.evaluate(() => {
      const store = (
        window as unknown as {
          __PLANNER_STORE__: {
            getState: () => {
              setViewAids: (partial: {
                showGrid?: boolean;
                gridStepM?: number;
              }) => void;
              clearGuides: () => void;
            };
          };
        }
      ).__PLANNER_STORE__.getState();
      store.setViewAids({ showGrid: true, gridStepM: 0.5 });
      store.clearGuides();
    });

    await page.getByTestId("load-btn").click();
    await page.waitForTimeout(500);

    const state = await page.evaluate(() => {
      const store = (
        window as unknown as {
          __PLANNER_STORE__: {
            getState: () => {
              viewAids: {
                showGrid: boolean;
                gridStepM: number;
                majorEvery: number;
                guides: Array<{ id: string }>;
              };
            };
          };
        }
      ).__PLANNER_STORE__.getState();
      return store.viewAids;
    });

    expect(state.showGrid).toBe(false);
    expect(state.gridStepM).toBe(1);
    expect(state.majorEvery).toBe(4);
    expect(state.guides).toHaveLength(1);
    expect(state.guides[0].id).toBe("guide-persist");
  });
});
