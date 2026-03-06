import type { ProjectRecord, SerializedProject } from "./types";

/** Create a new ProjectRecord with a fresh UUID and timestamps */
export function createProjectRecord(opts: {
  name: string;
  description?: string;
  projectData: SerializedProject;
}): ProjectRecord {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: opts.name,
    description: opts.description,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    thumbnailDataUrl: null,
    projectData: opts.projectData,
  };
}

/** Create a duplicate of a ProjectRecord with a fresh ID and "(Copy)" suffix */
export function duplicateProjectRecord(record: ProjectRecord): ProjectRecord {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: `${record.name} (Copy)`,
    description: record.description,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    thumbnailDataUrl: null,
    projectData: structuredClone(record.projectData),
  };
}

/** Wrap a legacy single-project SerializedProject into a ProjectRecord */
export function migrateV2RecordToProjectRecord(
  data: SerializedProject,
): ProjectRecord {
  const savedAt = data.savedAt || new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: "My Project",
    createdAt: savedAt,
    updatedAt: savedAt,
    deletedAt: null,
    thumbnailDataUrl: null,
    projectData: data,
  };
}
