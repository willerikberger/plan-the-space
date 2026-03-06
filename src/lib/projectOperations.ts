import type { StorageAdapter } from "./storage/storageAdapter";
import type {
  ProjectRecord,
  ProjectListItem,
  SerializedProject,
  SerializedObject,
  Camera,
  LayerGroup,
  LayerEntry,
} from "./types";
import { usePlannerStore } from "./store";
import { createProjectRecord, duplicateProjectRecord } from "./projectRecord";
import {
  deserializeProject,
  migrateProject,
} from "@/components/canvas/utils/serialization";

function toListItem(r: ProjectRecord): ProjectListItem {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    deletedAt: r.deletedAt,
    thumbnailDataUrl: r.thumbnailDataUrl,
  };
}

function createEmptyProjectData(): SerializedProject {
  return {
    version: 4,
    pixelsPerMeter: null,
    backgroundImage: null,
    savedAt: new Date().toISOString(),
    objects: [],
  };
}

/** Create a new empty project, save it, and switch to it */
export async function createProject(
  adapter: StorageAdapter,
  opts: { name: string; description?: string },
): Promise<string> {
  const record = createProjectRecord({
    name: opts.name,
    description: opts.description,
    projectData: createEmptyProjectData(),
  });
  await adapter.saveProjectRecord(record);

  const store = usePlannerStore.getState();
  store.addProject(toListItem(record));
  store.setActiveProjectId(record.id);
  store.setActiveView("canvas");
  store.reset();

  return record.id;
}

/** Save the current project data to the active project's record */
export async function saveCurrentProject(
  adapter: StorageAdapter,
  projectData: SerializedProject,
): Promise<void> {
  const { activeProjectId } = usePlannerStore.getState();
  if (!activeProjectId) return;

  const loaded = await adapter.loadProjectRecord(activeProjectId);
  if (!loaded) return;

  const record = {
    ...loaded,
    projectData,
    updatedAt: new Date().toISOString(),
  };
  await adapter.saveProjectRecord(record);

  // Empty partial — updateProjectMeta always bumps updatedAt
  usePlannerStore.getState().updateProjectMeta(activeProjectId, {});
}

/** Result of opening a project, includes deserialized data for canvas loading */
export interface OpenProjectResult {
  record: ProjectRecord;
  serializedObjects: SerializedObject[];
  camera?: Camera;
  layers?: Record<LayerGroup, LayerEntry[]>;
}

/** Open an existing project by loading its data into the store */
export async function openProject(
  adapter: StorageAdapter,
  projectId: string,
): Promise<OpenProjectResult | null> {
  const record = await adapter.loadProjectRecord(projectId);
  if (!record) return null;

  const store = usePlannerStore.getState();
  store.reset();

  const migrated = migrateProject(record.projectData);
  const deserialized = deserializeProject(migrated);
  store.loadProject({
    pixelsPerMeter: deserialized.pixelsPerMeter,
    objects: deserialized.objects,
  });

  if (deserialized.camera) {
    store.setCamera(deserialized.camera);
  }
  if (deserialized.layers) {
    usePlannerStore.setState({ layers: deserialized.layers });
  }

  store.setActiveProjectId(projectId);
  store.setActiveView("canvas");

  await adapter.saveAppState({ lastOpenedProjectId: projectId });

  return {
    record,
    serializedObjects: deserialized.serializedObjects,
    camera: deserialized.camera ?? undefined,
    layers: deserialized.layers ?? undefined,
  };
}

/** Duplicate a project */
export async function duplicateProject(
  adapter: StorageAdapter,
  projectId: string,
): Promise<string | null> {
  const record = await adapter.loadProjectRecord(projectId);
  if (!record) return null;

  const copy = duplicateProjectRecord(record);
  await adapter.saveProjectRecord(copy);
  usePlannerStore.getState().addProject(toListItem(copy));

  return copy.id;
}

/** Soft-delete a project (mark as deleted) */
export async function softDeleteProject(
  adapter: StorageAdapter,
  projectId: string,
): Promise<void> {
  const loaded = await adapter.loadProjectRecord(projectId);
  if (!loaded) return;

  const now = new Date().toISOString();
  await adapter.saveProjectRecord({
    ...loaded,
    deletedAt: now,
    updatedAt: now,
  });
  usePlannerStore.getState().softDeleteProject(projectId);
}

/** Permanently delete a project */
export async function permanentDeleteProject(
  adapter: StorageAdapter,
  projectId: string,
): Promise<void> {
  await adapter.deleteProjectRecord(projectId);
  usePlannerStore.getState().permanentlyDeleteProject(projectId);
}

/** Restore a soft-deleted project */
export async function restoreProject(
  adapter: StorageAdapter,
  projectId: string,
): Promise<void> {
  const loaded = await adapter.loadProjectRecord(projectId);
  if (!loaded) return;

  await adapter.saveProjectRecord({
    ...loaded,
    deletedAt: null,
    updatedAt: new Date().toISOString(),
  });
  usePlannerStore.getState().restoreProject(projectId);
}

/** Rename a project */
export async function renameProject(
  adapter: StorageAdapter,
  projectId: string,
  newName: string,
): Promise<ProjectRecord | null> {
  const loaded = await adapter.loadProjectRecord(projectId);
  if (!loaded) return null;

  const record = {
    ...loaded,
    name: newName,
    updatedAt: new Date().toISOString(),
  };
  await adapter.saveProjectRecord(record);
  usePlannerStore.getState().updateProjectMeta(projectId, { name: newName });

  return record;
}

/** Initialize the app: load all projects and app state */
export async function initializeApp(adapter: StorageAdapter): Promise<{
  projects: ProjectListItem[];
  lastOpenedProjectId: string | null;
}> {
  const records = await adapter.loadAllProjectRecords();
  const items = records.map(toListItem);

  const store = usePlannerStore.getState();
  store.setProjects(items);
  store.setActiveView("picker");

  const appState = await adapter.loadAppState();

  return {
    projects: items,
    lastOpenedProjectId: appState?.lastOpenedProjectId ?? null,
  };
}

/** Import a JSON file as a new project */
export async function importJsonAsProject(
  adapter: StorageAdapter,
  serializedProject: SerializedProject,
  filename?: string,
): Promise<string> {
  const migrated = migrateProject(serializedProject);
  const baseName = filename
    ? filename.replace(/\.json$/i, "")
    : "Imported Project";
  const name = `${baseName} (Imported)`;

  const record = createProjectRecord({
    name,
    projectData: migrated,
  });
  await adapter.saveProjectRecord(record);
  usePlannerStore.getState().addProject(toListItem(record));

  return record.id;
}
