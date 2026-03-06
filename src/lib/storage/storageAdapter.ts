import type { SerializedProject, ProjectRecord, AppState } from "@/lib/types";

// ============================================
// StorageAdapter interface
// ============================================
// Abstracts persistence operations so the app can swap backends
// (IndexedDB, Vercel KV, localStorage, in-memory for tests, etc.)

export interface StorageAdapter {
  /** Persist a serialized project (legacy single-project) */
  save(project: SerializedProject): Promise<void>;

  /** Load the persisted project, or null if none exists (legacy) */
  load(): Promise<SerializedProject | null>;

  /** Remove the persisted project (legacy) */
  clear(): Promise<void>;

  /** Persist a deduplicated image blob by its ref key */
  saveImage(ref: string, data: string): Promise<void>;

  /** Load a deduplicated image blob by its ref key, or null if missing */
  loadImage(ref: string): Promise<string | null>;

  /** Delete a single deduplicated image by its ref key */
  deleteImage(ref: string): Promise<void>;

  /** Remove all images from the pool */
  clearImages(): Promise<void>;

  // --- Multi-project methods ---

  /** Save or update a project record by its UUID */
  saveProjectRecord(record: ProjectRecord): Promise<void>;

  /** Load a project record by UUID, or null if not found */
  loadProjectRecord(id: string): Promise<ProjectRecord | null>;

  /** Load all project records */
  loadAllProjectRecords(): Promise<ProjectRecord[]>;

  /** Permanently delete a project record by UUID */
  deleteProjectRecord(id: string): Promise<void>;

  /** Save app-level state (e.g. last opened project) */
  saveAppState(state: AppState): Promise<void>;

  /** Load app-level state, or null if none exists */
  loadAppState(): Promise<AppState | null>;
}

// ============================================
// IDB migration types
// ============================================

/**
 * A single schema migration step. Each migration receives the IDBDatabase
 * during an onupgradeneeded event so it can create/delete object stores,
 * add indexes, etc.
 *
 * `fromVersion` is the version the DB is upgrading *from* (i.e. oldVersion).
 * Migrations run in ascending `fromVersion` order.
 */
export interface DBMigration {
  /** The DB version this migration upgrades FROM (i.e. oldVersion) */
  fromVersion: number;
  /** Apply the schema change */
  migrate(db: IDBDatabase, tx: IDBTransaction): void;
}

// ============================================
// In-memory adapter (useful for tests and SSR)
// ============================================

export function createInMemoryAdapter(): StorageAdapter {
  let stored: SerializedProject | null = null;
  const images = new Map<string, string>();
  const projectRecords = new Map<string, ProjectRecord>();
  let appState: AppState | null = null;

  return {
    async save(project) {
      stored = structuredClone(project);
    },
    async load() {
      return stored ? structuredClone(stored) : null;
    },
    async clear() {
      stored = null;
    },
    async saveImage(ref, data) {
      images.set(ref, data);
    },
    async loadImage(ref) {
      return images.get(ref) ?? null;
    },
    async deleteImage(ref) {
      images.delete(ref);
    },
    async clearImages() {
      images.clear();
    },

    // Multi-project methods
    async saveProjectRecord(record) {
      projectRecords.set(record.id, structuredClone(record));
    },
    async loadProjectRecord(id) {
      const r = projectRecords.get(id);
      return r ? structuredClone(r) : null;
    },
    async loadAllProjectRecords() {
      return [...projectRecords.values()].map((r) => structuredClone(r));
    },
    async deleteProjectRecord(id) {
      projectRecords.delete(id);
    },
    async saveAppState(state) {
      appState = structuredClone(state);
    },
    async loadAppState() {
      return appState ? structuredClone(appState) : null;
    },
  };
}
