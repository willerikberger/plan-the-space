/**
 * @module useHistory
 * @description Manages undo/redo by capturing and restoring snapshots of both Zustand store and Fabric canvas state.
 * Delegates to HistoryManager for stack management and IDB-backed image deduplication.
 * @dependencies lib/history (HistoryManager), store (setHistoryState), types (HistorySnapshot, StoreSnapshot, FabricObjectSnapshot, PlannerObject)
 * @usage Called from PlannerCanvas with getFabricState and restoreFromSnapshot callbacks; undo/redo are wired into useKeyboardShortcuts and the auto-save flow.
 */
"use client";

import { useRef, useCallback } from "react";
import { usePlannerStore } from "@/lib/store";
import { HistoryManager } from "@/lib/history";
import type {
  HistorySnapshot,
  StoreSnapshot,
  FabricObjectSnapshot,
  PlannerObject,
} from "@/lib/types";

type GetFabricStateFn = (id: number) => Record<string, unknown> | null;

interface UseHistoryOptions {
  getFabricState: GetFabricStateFn;
  restoreFromSnapshot: (snapshot: HistorySnapshot) => Promise<void>;
}

export function useHistory({
  getFabricState,
  restoreFromSnapshot,
}: UseHistoryOptions) {
  const managerRef = useRef(new HistoryManager());
  const isRestoringRef = useRef(false);

  const syncHistoryState = useCallback(() => {
    const state = managerRef.current.getState();
    usePlannerStore.getState().setHistoryState(state);
  }, []);

  const captureSnapshot = useCallback(async () => {
    if (isRestoringRef.current) return;

    const store = usePlannerStore.getState();
    const mode = store.mode;
    // Only capture in normal or cleanup modes
    if (mode !== "normal" && mode !== "cleanup") return;

    const manager = managerRef.current;
    const objects = Array.from(store.objects.values());

    // Handle background image ref
    let backgroundImageRef: string | null = null;
    if (store.backgroundImageData) {
      backgroundImageRef = await manager.registerImage(
        store.backgroundImageData,
      );
    }

    // Handle image objects — register their imageData and store ref
    const clonedObjects: PlannerObject[] = objects.map((obj) => {
      if (
        (obj.type === "overlayImage" || obj.type === "backgroundImage") &&
        "imageData" in obj
      ) {
        // We store a ref instead of the full data in the snapshot
        const ref = manager.computeImageRef(obj.imageData);
        // Fire-and-forget registration
        manager.registerImage(obj.imageData).catch(() => {});
        return { ...obj, imageDataRef: ref } as unknown as PlannerObject;
      }
      return { ...obj };
    });

    const storeSnapshot: StoreSnapshot = {
      pixelsPerMeter: store.pixelsPerMeter,
      backgroundImageRef,
      objects: clonedObjects,
      objectIdCounter: store.objectIdCounter,
    };

    // Capture Fabric state for each object
    const fabricSnapshots: FabricObjectSnapshot[] = [];
    for (const obj of objects) {
      const state = getFabricState(obj.id);
      if (state) {
        fabricSnapshots.push({
          id: obj.id,
          type: obj.type,
          fabricState: { ...state },
        });
      }
    }

    const snapshot: HistorySnapshot = {
      storeSnapshot,
      fabricSnapshots,
      timestamp: Date.now(),
    };

    manager.push(snapshot);
    syncHistoryState();
  }, [getFabricState, syncHistoryState]);

  const undo = useCallback(async () => {
    if (isRestoringRef.current) return;
    const snapshot = managerRef.current.undo();
    if (!snapshot) return;
    isRestoringRef.current = true;
    try {
      await restoreFromSnapshot(snapshot);
      syncHistoryState();
    } finally {
      isRestoringRef.current = false;
    }
  }, [restoreFromSnapshot, syncHistoryState]);

  const redo = useCallback(async () => {
    if (isRestoringRef.current) return;
    const snapshot = managerRef.current.redo();
    if (!snapshot) return;
    isRestoringRef.current = true;
    try {
      await restoreFromSnapshot(snapshot);
      syncHistoryState();
    } finally {
      isRestoringRef.current = false;
    }
  }, [restoreFromSnapshot, syncHistoryState]);

  const resetHistory = useCallback(async () => {
    await managerRef.current.reset();
    syncHistoryState();
  }, [syncHistoryState]);

  return {
    captureSnapshot,
    undo,
    redo,
    resetHistory,
    isRestoringRef,
    managerRef,
  };
}
