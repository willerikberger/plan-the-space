import type { SerializedProject, ProjectRecord } from "@/lib/types";
import { createProjectRecord } from "@/lib/projectRecord";

export function createEmptyProjectData(): SerializedProject {
  return {
    version: 4,
    pixelsPerMeter: null,
    backgroundImage: null,
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
