import { test, expect } from "../fixtures/base.fixture";
import { getObjectCount } from "../fixtures/helpers";

interface ContentLayerItem {
  id: number;
  name: string;
}

interface ContentLayerState {
  content: ContentLayerItem[];
  visibleCount: number;
}

async function getContentLayerState(
  page: import("@playwright/test").Page,
): Promise<ContentLayerState | null> {
  return page.evaluate(() => {
    const store = (window as any).__PLANNER_STORE__?.getState();
    if (!store) return null;

    const objectsById = new Map<number, any>();
    for (const obj of store.objects.values()) {
      objectsById.set(obj.id, obj);
    }

    const content = [...store.layers.content]
      .sort((a, b) => a.zIndex - b.zIndex)
      .map((entry) => ({
        id: entry.objectId,
        name: objectsById.get(entry.objectId)?.name ?? String(entry.objectId),
      }));

    return {
      content,
      visibleCount: Array.from(store.objects.values()).filter(
        (o: any) =>
          o.type === "shape" || o.type === "line" || o.type === "overlayImage",
      ).length,
    };
  });
}

test.describe("Layering regression", () => {
  test("shape up/down controls reorder content layer without hiding shapes", async ({
    page,
    freshProject,
  }) => {
    await page.evaluate(() => {
      (window as any).__PLANNER_STORE__?.getState()?.setPixelsPerMeter(100);
    });

    await page.getByTestId("shape-name-input").fill("Shape A");
    await page.getByTestId("add-shape-btn").click();
    await expect.poll(async () => getObjectCount(page)).toBe(1);

    await page.getByTestId("shape-name-input").fill("Shape B");
    await page.getByTestId("add-shape-btn").click();
    await expect.poll(async () => getObjectCount(page)).toBe(2);

    const before = await getContentLayerState(page);
    expect(before?.content).toHaveLength(2);
    const bottom = before!.content[0];
    const top = before!.content[1];

    await page.getByRole("button", { name: `Move ${bottom.name} up` }).click();

    await expect
      .poll(async () => {
        const current = await getContentLayerState(page);
        return current?.content.map((item) => item.id);
      })
      .toEqual([top.id, bottom.id]);

    expect(await getObjectCount(page)).toBe(2);
    await expect(page.getByTestId(`object-item-${top.id}`)).toBeVisible();
    await expect(page.getByTestId(`object-item-${bottom.id}`)).toBeVisible();

    await page
      .getByRole("button", { name: `Move ${bottom.name} down` })
      .click();

    await expect
      .poll(async () => {
        const current = await getContentLayerState(page);
        return current?.content.map((item) => item.id);
      })
      .toEqual([bottom.id, top.id]);

    expect(await getObjectCount(page)).toBe(2);
    await expect(page.getByTestId(`object-item-${top.id}`)).toBeVisible();
    await expect(page.getByTestId(`object-item-${bottom.id}`)).toBeVisible();
    await expect(page.getByTestId("object-list")).not.toContainText("\\u2b");
  });

  test("move controls recover from corrupted layer-group data", async ({
    page,
    freshProject,
  }) => {
    await page.evaluate(() => {
      const store = (window as any).__PLANNER_STORE__?.getState();
      store?.setPixelsPerMeter(100);
    });

    await page.getByTestId("shape-name-input").fill("Shape A");
    await page.getByTestId("add-shape-btn").click();
    await page.getByTestId("shape-name-input").fill("Shape B");
    await page.getByTestId("add-shape-btn").click();
    await expect.poll(async () => getObjectCount(page)).toBe(2);

    const ids = await page.evaluate(() => {
      const store = (window as any).__PLANNER_STORE__?.getState();
      if (!store) return null;
      const shapes = (
        Array.from(store.objects.values()) as Array<{
          id: number;
          type: string;
        }>
      ).filter((obj) => obj.type === "shape");
      return {
        first: shapes[0]?.id,
        second: shapes[1]?.id,
      };
    });
    expect(ids?.first).not.toBeUndefined();
    expect(ids?.second).not.toBeUndefined();

    await page.evaluate(
      ({ first, second }) => {
        const plannerStore = (window as any).__PLANNER_STORE__;
        const state = plannerStore?.getState();
        if (!plannerStore || !state) return;
        plannerStore.setState({
          layers: {
            ...state.layers,
            background: [{ objectId: first, zIndex: 0 }],
            content: [{ objectId: second, zIndex: 0 }],
          },
        });
      },
      { first: ids!.first, second: ids!.second },
    );

    await page.getByRole("button", { name: "Move Shape A down" }).click();

    await expect
      .poll(async () => {
        const current = await getContentLayerState(page);
        return current?.content.map((entry) => entry.name);
      })
      .toEqual(["Shape A", "Shape B"]);

    expect(await getObjectCount(page)).toBe(2);
    await expect(page.getByTestId(`object-item-${ids!.first}`)).toBeVisible();
    await expect(page.getByTestId(`object-item-${ids!.second}`)).toBeVisible();
  });
});
