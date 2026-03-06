import type { SerializedProject, ProjectRecord, AppState } from "@/lib/types";
import type { StorageAdapter, DBMigration } from "./storageAdapter";
import {
  DB_NAME,
  DB_VERSION,
  STORE_NAME,
  IMAGE_POOL_STORE,
  APP_STATE_STORE,
  APP_STATE_KEY,
  STORAGE_KEY,
} from "@/lib/constants";
import { migrateProject } from "@/components/canvas/utils/serialization";
import { migrateV2RecordToProjectRecord } from "@/lib/projectRecord";

// ============================================
// Schema migrations
// ============================================
// Each migration handles upgrading from a specific DB version.
// They run in ascending `fromVersion` order during onupgradeneeded.

const migrations: readonly DBMigration[] = [
  {
    // Fresh install (version 0 -> 1): create the projects store
    fromVersion: 0,
    migrate(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    },
  },
  {
    // Version 1 -> 2: add the image-pool store
    fromVersion: 1,
    migrate(db) {
      if (!db.objectStoreNames.contains(IMAGE_POOL_STORE)) {
        db.createObjectStore(IMAGE_POOL_STORE);
      }
    },
  },
  {
    // Version 2 -> 3: add the app-state store + migrate legacy project
    fromVersion: 2,
    migrate(db, tx) {
      if (!db.objectStoreNames.contains(APP_STATE_STORE)) {
        db.createObjectStore(APP_STATE_STORE, { keyPath: "id" });
      }

      // Migrate existing single-project record to a ProjectRecord
      const projectStore = tx.objectStore(STORE_NAME);
      const getRequest = projectStore.get(STORAGE_KEY);
      getRequest.onsuccess = () => {
        const oldData = getRequest.result as SerializedProject | undefined;
        if (!oldData) return;

        const record = migrateV2RecordToProjectRecord(oldData);
        projectStore.put(record);
        projectStore.delete(STORAGE_KEY);

        // Save last-opened reference in app-state
        const appStateStore = tx.objectStore(APP_STATE_STORE);
        const state: AppState & { id: string } = {
          id: APP_STATE_KEY,
          lastOpenedProjectId: record.id,
        };
        appStateStore.put(state);
      };
    },
  },
];

// ============================================
// Centralized DB open with versioned migrations
// ============================================

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const tx = (event.target as IDBOpenDBRequest).transaction!;
      const oldVersion = event.oldVersion;

      // Run every migration whose fromVersion >= oldVersion
      for (const migration of migrations) {
        if (migration.fromVersion >= oldVersion) {
          migration.migrate(db, tx);
        }
      }
    };
  });
}

// ============================================
// Low-level IDB helpers (reduce boilerplate)
// ============================================

/** Run a read-only operation on a single object store. */
async function idbRead<T>(
  storeName: string,
  operation: (store: IDBObjectStore) => IDBRequest,
): Promise<T | undefined> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    return await new Promise<T | undefined>((resolve, reject) => {
      const request = operation(store);
      request.onsuccess = () => resolve(request.result as T | undefined);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

/** Run a read-write operation on a single object store. */
async function idbWrite(
  storeName: string,
  operation: (store: IDBObjectStore) => IDBRequest,
): Promise<void> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    await new Promise<void>((resolve, reject) => {
      const request = operation(store);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

// ============================================
// IndexedDB adapter factory
// ============================================

export function createIndexedDBAdapter(): StorageAdapter {
  return {
    async save(project: SerializedProject): Promise<void> {
      const projectData = { ...project, id: STORAGE_KEY };
      await idbWrite(STORE_NAME, (store) => store.put(projectData));
    },

    async load(): Promise<SerializedProject | null> {
      const data = await idbRead<SerializedProject>(STORE_NAME, (store) =>
        store.get(STORAGE_KEY),
      );
      if (!data) return null;
      return migrateProject(data);
    },

    async clear(): Promise<void> {
      await idbWrite(STORE_NAME, (store) => store.delete(STORAGE_KEY));
    },

    async saveImage(ref: string, data: string): Promise<void> {
      await idbWrite(IMAGE_POOL_STORE, (store) => store.put(data, ref));
    },

    async loadImage(ref: string): Promise<string | null> {
      const result = await idbRead<string>(IMAGE_POOL_STORE, (store) =>
        store.get(ref),
      );
      return result ?? null;
    },

    async deleteImage(ref: string): Promise<void> {
      await idbWrite(IMAGE_POOL_STORE, (store) => store.delete(ref));
    },

    async clearImages(): Promise<void> {
      await idbWrite(IMAGE_POOL_STORE, (store) => store.clear());
    },

    // Multi-project methods
    async saveProjectRecord(record: ProjectRecord): Promise<void> {
      await idbWrite(STORE_NAME, (store) => store.put(record));
    },

    async loadProjectRecord(id: string): Promise<ProjectRecord | null> {
      const data = await idbRead<ProjectRecord>(STORE_NAME, (store) =>
        store.get(id),
      );
      return data ?? null;
    },

    async loadAllProjectRecords(): Promise<ProjectRecord[]> {
      const db = await openDatabase();
      try {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        return await new Promise<ProjectRecord[]>((resolve, reject) => {
          const request = store.getAll();
          request.onsuccess = () => {
            // Filter out legacy records (they have a string 'id' matching STORAGE_KEY)
            const records = (request.result as ProjectRecord[]).filter(
              (r) => r.id !== STORAGE_KEY && r.createdAt != null,
            );
            resolve(records);
          };
          request.onerror = () => reject(request.error);
        });
      } finally {
        db.close();
      }
    },

    async deleteProjectRecord(id: string): Promise<void> {
      await idbWrite(STORE_NAME, (store) => store.delete(id));
    },

    async saveAppState(state: AppState): Promise<void> {
      await idbWrite(APP_STATE_STORE, (store) =>
        store.put({ ...state, id: APP_STATE_KEY }),
      );
    },

    async loadAppState(): Promise<AppState | null> {
      const data = await idbRead<AppState & { id: string }>(
        APP_STATE_STORE,
        (store) => store.get(APP_STATE_KEY),
      );
      if (!data) return null;
      return { lastOpenedProjectId: data.lastOpenedProjectId };
    },
  };
}

// ============================================
// Default adapter instance
// ============================================

let defaultAdapter: StorageAdapter | null = null;

export function getDefaultAdapter(): StorageAdapter {
  if (!defaultAdapter) {
    defaultAdapter = createIndexedDBAdapter();
  }
  return defaultAdapter;
}

// ============================================
// Backward-compatible function exports
// ============================================
// These delegate to the default adapter so existing callers continue to work.

export async function saveProject(data: SerializedProject): Promise<void> {
  return getDefaultAdapter().save(data);
}

export async function loadProject(): Promise<SerializedProject | null> {
  return getDefaultAdapter().load();
}

export async function clearProject(): Promise<void> {
  return getDefaultAdapter().clear();
}

export async function checkProjectExists(): Promise<SerializedProject | null> {
  try {
    return await getDefaultAdapter().load();
  } catch {
    return null;
  }
}

export async function saveImageData(ref: string, data: string): Promise<void> {
  return getDefaultAdapter().saveImage(ref, data);
}

export async function loadImageData(ref: string): Promise<string | null> {
  return getDefaultAdapter().loadImage(ref);
}

export async function deleteImageData(ref: string): Promise<void> {
  return getDefaultAdapter().deleteImage(ref);
}

export async function clearImagePool(): Promise<void> {
  return getDefaultAdapter().clearImages();
}

// Re-export types for convenience
export type { StorageAdapter, DBMigration } from "./storageAdapter";
export { createInMemoryAdapter } from "./storageAdapter";
