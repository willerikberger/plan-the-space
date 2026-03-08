import type { SerializedProject, ProjectRecord } from "@/lib/types";
import { createProjectRecord } from "@/lib/projectRecord";

export function createEmptyProjectData(): SerializedProject {
  return {
    version: 5,
    pixelsPerMeter: null,
    backgroundImage: null,
    viewAids: {
      showGrid: true,
      showRulers: true,
      snapEnabled: true,
      gridStepM: 0.5,
      majorEvery: 5,
      guideLock: false,
      guides: [],
      snapTolerancePx: 10,
    },
    savedAt: new Date().toISOString(),
    objects: [],
  };
}

export function makeProject(
  overrides: Partial<Parameters<typeof createProjectRecord>[0]> & {
    name: string;
  },
): ProjectRecord {
  return createProjectRecord({
    projectData: createEmptyProjectData(),
    ...overrides,
  });
}
