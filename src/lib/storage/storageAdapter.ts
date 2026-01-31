import type { SerializedProject } from "@/lib/types";

// ============================================
// StorageAdapter interface
// ============================================
// Abstracts persistence operations so the app can swap backends
// (IndexedDB, Vercel KV, localStorage, in-memory for tests, etc.)

export interface StorageAdapter {
  /** Persist a serialized project */
  save(project: SerializedProject): Promise<void>;

  /** Load the persisted project, or null if none exists */
  load(): Promise<SerializedProject | null>;

  /** Remove the persisted project */
  clear(): Promise<void>;

  /** Persist a deduplicated image blob by its ref key */
  saveImage(ref: string, data: string): Promise<void>;

  /** Load a deduplicated image blob by its ref key, or null if missing */
  loadImage(ref: string): Promise<string | null>;

  /** Delete a single deduplicated image by its ref key */
  deleteImage(ref: string): Promise<void>;

  /** Remove all images from the pool */
  clearImages(): Promise<void>;
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
  };
}
