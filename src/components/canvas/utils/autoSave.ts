/**
 * @module autoSave
 * @description Provides debounced auto-save to IndexedDB and a best-effort save on page unload.
 * Reads current Zustand store state at execution time to serialize the project before persisting.
 * @dependencies constants (AUTOSAVE_DEBOUNCE_MS), store (autoSaveEnabled, objects, pixelsPerMeter, backgroundImageData), canvasOrchestration (FabricStateResult)
 * @usage Called from PlannerCanvas to schedule auto-saves after canvas mutations, and registered as a beforeunload handler for safety saves.
 */
import type { PlannerObject, SerializedProject } from "@/lib/types";
import { AUTOSAVE_DEBOUNCE_MS } from "@/lib/constants";
import { usePlannerStore } from "@/lib/store";
import type { FabricStateResult } from "./canvasOrchestration";

/** Signature for the getFabricState function */
export type GetFabricStateFn = (id: number) => FabricStateResult;

/** Signature for the serializeProject function */
export type SerializeProjectFn = (
  pixelsPerMeter: number | null,
  backgroundImageData: string | null,
  objects: PlannerObject[],
  getFabricState: (id: number) => FabricStateResult,
) => SerializedProject;

/** Signature for the saveToIDB function */
export type SaveToIDBFn = (data: SerializedProject) => Promise<void>;

export interface ScheduleAutoSaveOptions {
  isRestoring: boolean;
  timerRef: { current: ReturnType<typeof setTimeout> | null };
  getFabricState: GetFabricStateFn;
  serializeProject: SerializeProjectFn;
  saveToIDB: SaveToIDBFn;
}

/**
 * Schedule a debounced auto-save to IndexedDB.
 * Cancels any previously scheduled save. Reads the current store state
 * at execution time (inside the timer).
 */
export function scheduleAutoSave(options: ScheduleAutoSaveOptions): void {
  const { isRestoring, timerRef, getFabricState, serializeProject, saveToIDB } =
    options;
  if (isRestoring) return;
  const store = usePlannerStore.getState();
  if (!store.autoSaveEnabled) return;
  if (timerRef.current) clearTimeout(timerRef.current);
  timerRef.current = setTimeout(async () => {
    try {
      const s = usePlannerStore.getState();
      const objects = Array.from(s.objects.values());
      const data = serializeProject(
        s.pixelsPerMeter,
        s.backgroundImageData,
        objects,
        (id) => getFabricState(id),
      );
      await saveToIDB(data);
      s.setStatusMessage("Saved to browser storage");
    } catch (err) {
      usePlannerStore.getState().setStatusMessage("Auto-save failed");
      console.error("Auto-save error:", err);
    }
  }, AUTOSAVE_DEBOUNCE_MS);
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
  const data = serializeProject(
    s.pixelsPerMeter,
    s.backgroundImageData,
    objects,
    getFabricState,
  );
  // Synchronous best-effort via sendBeacon isn't possible with IDB,
  // but we can try a fire-and-forget save
  saveToIDB(data).catch(() => {});
}
