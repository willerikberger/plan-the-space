import { describe, it, expect, beforeEach } from "vitest";
import { usePlannerStore } from "@/lib/store";
import type { ProjectListItem } from "@/lib/types";

const makeItem = (
  overrides: Partial<ProjectListItem> = {},
): ProjectListItem => ({
  id: crypto.randomUUID(),
  name: "Test",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  deletedAt: null,
  thumbnailDataUrl: null,
  ...overrides,
});

beforeEach(() => {
  usePlannerStore.getState().reset();
  // Also reset project-level state since reset() preserves projects
  usePlannerStore.setState({
    activeView: "picker",
    activeProjectId: null,
    projects: [],
  });
});

describe("ProjectSlice — initial state", () => {
  it("starts with picker view, null project, empty list", () => {
    const s = usePlannerStore.getState();
    expect(s.activeView).toBe("picker");
    expect(s.activeProjectId).toBeNull();
    expect(s.projects).toEqual([]);
  });
});

describe("setActiveView / setActiveProjectId", () => {
  it("setActiveView updates view", () => {
    usePlannerStore.getState().setActiveView("canvas");
    expect(usePlannerStore.getState().activeView).toBe("canvas");
  });

  it("setActiveProjectId updates ID", () => {
    usePlannerStore.getState().setActiveProjectId("abc");
    expect(usePlannerStore.getState().activeProjectId).toBe("abc");
  });
});

describe("setProjects / addProject", () => {
  it("setProjects replaces the array", () => {
    const items = [makeItem({ name: "A" }), makeItem({ name: "B" })];
    usePlannerStore.getState().setProjects(items);
    expect(usePlannerStore.getState().projects).toHaveLength(2);
  });

  it("addProject appends", () => {
    usePlannerStore.getState().addProject(makeItem({ name: "First" }));
    usePlannerStore.getState().addProject(makeItem({ name: "Second" }));
    expect(usePlannerStore.getState().projects).toHaveLength(2);
  });

  it("addProject with same ID upserts", () => {
    const item = makeItem({ name: "Original" });
    usePlannerStore.getState().addProject(item);
    usePlannerStore.getState().addProject({ ...item, name: "Updated" });
    const projects = usePlannerStore.getState().projects;
    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe("Updated");
  });
});

describe("updateProjectMeta", () => {
  it("updates name and auto-updates updatedAt", () => {
    const item = makeItem({ name: "Old", updatedAt: "2024-01-01T00:00:00Z" });
    usePlannerStore.getState().addProject(item);
    usePlannerStore.getState().updateProjectMeta(item.id, { name: "New" });
    const p = usePlannerStore.getState().projects[0];
    expect(p.name).toBe("New");
    expect(p.updatedAt).not.toBe("2024-01-01T00:00:00Z");
  });

  it("no-op for nonexistent ID", () => {
    usePlannerStore.getState().updateProjectMeta("nonexistent", { name: "X" });
    expect(usePlannerStore.getState().projects).toHaveLength(0);
  });

  it("updates thumbnail", () => {
    const item = makeItem();
    usePlannerStore.getState().addProject(item);
    usePlannerStore.getState().updateProjectMeta(item.id, {
      thumbnailDataUrl: "data:image/png;base64,thumb",
    });
    expect(usePlannerStore.getState().projects[0].thumbnailDataUrl).toBe(
      "data:image/png;base64,thumb",
    );
  });
});

describe("softDeleteProject / restoreProject", () => {
  it("sets deletedAt", () => {
    const item = makeItem();
    usePlannerStore.getState().addProject(item);
    usePlannerStore.getState().softDeleteProject(item.id);
    expect(usePlannerStore.getState().projects[0].deletedAt).toBeTruthy();
  });

  it("deleting active project clears activeProjectId and sets view to picker", () => {
    const item = makeItem();
    usePlannerStore.getState().addProject(item);
    usePlannerStore.getState().setActiveProjectId(item.id);
    usePlannerStore.getState().setActiveView("canvas");
    usePlannerStore.getState().softDeleteProject(item.id);
    expect(usePlannerStore.getState().activeProjectId).toBeNull();
    expect(usePlannerStore.getState().activeView).toBe("picker");
  });

  it("restoreProject clears deletedAt", () => {
    const item = makeItem();
    usePlannerStore.getState().addProject(item);
    usePlannerStore.getState().softDeleteProject(item.id);
    usePlannerStore.getState().restoreProject(item.id);
    expect(usePlannerStore.getState().projects[0].deletedAt).toBeNull();
  });
});

describe("permanentlyDeleteProject", () => {
  it("removes from array", () => {
    const item = makeItem();
    usePlannerStore.getState().addProject(item);
    usePlannerStore.getState().permanentlyDeleteProject(item.id);
    expect(usePlannerStore.getState().projects).toHaveLength(0);
  });

  it("clears activeProjectId if matched", () => {
    const item = makeItem();
    usePlannerStore.getState().addProject(item);
    usePlannerStore.getState().setActiveProjectId(item.id);
    usePlannerStore.getState().permanentlyDeleteProject(item.id);
    expect(usePlannerStore.getState().activeProjectId).toBeNull();
  });
});

describe("reset preserves projects", () => {
  it("reset does not clear the projects list", () => {
    const item = makeItem();
    usePlannerStore.getState().addProject(item);
    usePlannerStore.getState().reset();
    expect(usePlannerStore.getState().projects).toHaveLength(1);
  });
});
