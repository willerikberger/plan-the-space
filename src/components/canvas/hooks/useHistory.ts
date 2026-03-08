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

export interface UseHistoryReturn {
  captureSnapshot: () => Promise<void>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  resetHistory: () => Promise<void>;
  isRestoringRef: React.RefObject<boolean>;
  managerRef: React.RefObject<HistoryManager>;
}

export function useHistory({
  getFabricState,
  restoreFromSnapshot,
}: UseHistoryOptions): UseHistoryReturn {
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
      objects: clonedObjects,
      objectIdCounter: store.objectIdCounter,
      camera: store.camera,
      layers: {
        background: store.layers.background.map((e) => ({ ...e })),
        masks: store.layers.masks.map((e) => ({ ...e })),
        content: store.layers.content.map((e) => ({ ...e })),
      },
      viewAids: {
        ...store.viewAids,
        guides: store.viewAids.guides.map((guide) => ({ ...guide })),
      },
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

    // Avoid no-op history entries when multiple callbacks capture the same
    // state in quick succession (e.g. add flows + Fabric modified events).
    const current = manager.getCurrentSnapshot();
    if (current) {
      const sameStore =
        JSON.stringify(current.storeSnapshot) ===
        JSON.stringify(snapshot.storeSnapshot);
      const sameFabric =
        JSON.stringify(current.fabricSnapshots) ===
        JSON.stringify(snapshot.fabricSnapshots);
      if (sameStore && sameFabric) {
        syncHistoryState();
        return;
      }
    }

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
