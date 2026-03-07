/**
 * @module autoSave
 * @description Provides debounced auto-save to IndexedDB and a best-effort save on page unload.
 * Reads current Zustand store state at execution time to serialize the project before persisting.
 * @dependencies constants (AUTOSAVE_DEBOUNCE_MS), store (autoSaveEnabled, objects, pixelsPerMeter), canvasOrchestration (FabricStateResult)
 * @usage Called from PlannerCanvas to schedule auto-saves after canvas mutations, and registered as a beforeunload handler for safety saves.
 */
import type {
  PlannerObject,
  SerializedProject,
  Camera,
  LayerGroup,
  LayerEntry,
} from "@/lib/types";
import { AUTOSAVE_DEBOUNCE_MS } from "@/lib/constants";
import { usePlannerStore } from "@/lib/store";
import { saveCurrentProject } from "@/lib/projectOperations";
import { getDefaultAdapter } from "@/lib/storage/indexeddb";
import type { FabricStateResult } from "./canvasOrchestration";

/** Signature for the getFabricState function */
export type GetFabricStateFn = (id: number) => FabricStateResult;

/** Signature for the serializeProject function */
export type SerializeProjectFn = (
  pixelsPerMeter: number | null,
  objects: PlannerObject[],
  getFabricState: (id: number) => FabricStateResult,
  camera?: Camera | null,
  layers?: Record<LayerGroup, LayerEntry[]> | null,
) => SerializedProject;

/** Signature for the saveToIDB function */
export type SaveToIDBFn = (data: SerializedProject) => Promise<void>;

export interface ScheduleAutoSaveOptions {
  isRestoring: boolean;
  timerRef: { current: ReturnType<typeof setTimeout> | null };
  getFabricState: GetFabricStateFn;
  serializeProject: SerializeProjectFn;
  saveToIDB: SaveToIDBFn;
  isLoadingProjectRef?: { current: boolean };
}

/**
 * Schedule a debounced auto-save to IndexedDB.
 * Cancels any previously scheduled save. Reads the current store state
 * at execution time (inside the timer).
 */
export function scheduleAutoSave(options: ScheduleAutoSaveOptions): void {
  const {
    isRestoring,
    timerRef,
    getFabricState,
    serializeProject,
    saveToIDB,
    isLoadingProjectRef,
  } = options;
  if (isRestoring) return;
  const store = usePlannerStore.getState();
  if (!store.autoSaveEnabled) return;
  if (timerRef.current) clearTimeout(timerRef.current);
  timerRef.current = setTimeout(async () => {
    try {
      if (isLoadingProjectRef?.current) return;
      const s = usePlannerStore.getState();
      const objects = Array.from(s.objects.values());
      const data = serializeProject(
        s.pixelsPerMeter,
        objects,
        (id) => getFabricState(id),
        s.camera,
        s.layers,
      );
      // Save to legacy IDB for backward compat
      await saveToIDB(data);
      // Also save to per-project record if a project is active
      if (s.activeProjectId) {
        await saveCurrentProject(getDefaultAdapter(), data);
      }
      s.setStatusMessage("Saved to browser storage");
    } catch (err) {
      usePlannerStore.getState().setStatusMessage("Auto-save failed");
      console.error("Auto-save error:", err);
    }
  }, AUTOSAVE_DEBOUNCE_MS);
}

/**
 * Cancel any pending debounced auto-save.
 */
export function cancelAutoSave(timerRef: {
  current: ReturnType<typeof setTimeout> | null;
}): void {
  if (timerRef.current) {
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }
}

/**
 * Best-effort synchronous save on page close.
 * Fires a fire-and-forget save to IndexedDB.
 */
export function handleBeforeUnload(
  getFabricState: GetFabricStateFn,
  serializeProject: SerializeProjectFn,
  saveToIDB: SaveToIDBFn,
): void {
  const s = usePlannerStore.getState();
  if (!s.autoSaveEnabled) return;
  const objects = Array.from(s.objects.values());
  // Don't overwrite saved data with an empty project (fresh page)
  if (objects.length === 0 && s.pixelsPerMeter === null) return;
  const data = serializeProject(
    s.pixelsPerMeter,
    objects,
    getFabricState,
    s.camera,
    s.layers,
  );
  // Synchronous best-effort via sendBeacon isn't possible with IDB,
  // but we can try a fire-and-forget save
  saveToIDB(data).catch(() => {});
  // Also save to per-project record if active
  if (s.activeProjectId) {
    saveCurrentProject(getDefaultAdapter(), data).catch(() => {});
  }
}
