import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { usePlannerStore, selectVisibleObjects } from "@/lib/store";
import { HistoryManager } from "@/lib/history";
import {
  serializeProject,
  deserializeProject,
  validateProjectData,
} from "@/components/canvas/utils/serialization";
import {
  saveProject,
  loadProject,
  clearProject,
  loadImageData,
} from "@/lib/storage/indexeddb";
import type {
  ShapeObject,
  LineObject,
  HistorySnapshot,
  SerializedProjectV3,
} from "@/lib/types";

// ============================================
// Helpers
// ============================================

/** Build a mock Fabric state lookup function for the objects we create. */
function makeFabricStateLookup(
  entries: Record<number, Record<string, unknown>>,
) {
  return (id: number) => {
    const state = entries[id];
    if (!state) return null;
    return {
      left: (state.left as number) ?? 0,
      top: (state.top as number) ?? 0,
      scaleX: (state.scaleX as number) ?? 1,
      scaleY: (state.scaleY as number) ?? 1,
      angle: (state.angle as number) ?? 0,
      width: state.width as number | undefined,
      height: state.height as number | undefined,
      baseWidthPx: state.baseWidthPx as number | undefined,
      baseHeightPx: state.baseHeightPx as number | undefined,
      x1: state.x1 as number | undefined,
      y1: state.y1 as number | undefined,
      x2: state.x2 as number | undefined,
      y2: state.y2 as number | undefined,
      strokeWidth: state.strokeWidth as number | undefined,
      originX: state.originX as string | undefined,
      originY: state.originY as string | undefined,
    };
  };
}

/** Create a HistorySnapshot from the current Zustand store state. */
function captureSnapshot(
  fabricEntries: Record<number, Record<string, unknown>>,
): HistorySnapshot {
  const state = usePlannerStore.getState();
  const objects = Array.from(state.objects.values());
  return {
    storeSnapshot: {
      pixelsPerMeter: state.pixelsPerMeter,
      backgroundImageRef: null,
      objects: JSON.parse(JSON.stringify(objects)),
      objectIdCounter: state.objectIdCounter,
    },
    fabricSnapshots: objects.map((obj) => ({
      id: obj.id,
      type: obj.type,
      fabricState: fabricEntries[obj.id] ?? {},
    })),
    timestamp: Date.now(),
  };
}

// ============================================
// Setup
// ============================================

let historyManager: HistoryManager;

beforeEach(async () => {
  usePlannerStore.getState().reset();

  // Clear all IndexedDB databases between tests
  const databases = await indexedDB.databases();
  for (const db of databases) {
    if (db.name) indexedDB.deleteDatabase(db.name);
  }

  historyManager = new HistoryManager();
});

// ============================================
// Integration test
// ============================================

describe("Full user workflow integration", () => {
  it("exercises store, calibration, history, serialization, IDB round-trip", async () => {
    const store = usePlannerStore;

    // ------------------------------------------------------------------
    // Step 1: Initial state verification
    // ------------------------------------------------------------------
    const initial = store.getState();
    expect(initial.mode).toBe("normal");
    expect(initial.pixelsPerMeter).toBeNull();
    expect(initial.objects.size).toBe(0);
    expect(initial.objectIdCounter).toBe(0);
    expect(initial.autoSaveEnabled).toBe(true);

    // ------------------------------------------------------------------
    // Step 2: Simulate calibration (user draws a reference line, enters
    //         a known real-world distance, app computes pixels-per-meter)
    // ------------------------------------------------------------------
    store.getState().setMode("calibrating");
    expect(store.getState().mode).toBe("calibrating");

    // User draws a calibration line that is 200 pixels long
    const calibrationPixelLength = 200;
    store.getState().setCalibrationPixelLength(calibrationPixelLength);
    expect(store.getState().calibrationPixelLength).toBe(200);

    // User enters "2 meters" as the real-world length
    // => pixelsPerMeter = 200 / 2 = 100
    const realWorldMeters = 2;
    const pixelsPerMeter = calibrationPixelLength / realWorldMeters;
    store.getState().setPixelsPerMeter(pixelsPerMeter);
    expect(store.getState().pixelsPerMeter).toBe(100);

    // Calibration complete, return to normal mode
    store.getState().setMode("normal");
    expect(store.getState().mode).toBe("normal");

    // Capture initial history snapshot (empty canvas, calibrated)
    const fabricStates: Record<number, Record<string, unknown>> = {};
    historyManager.push(captureSnapshot(fabricStates));

    // ------------------------------------------------------------------
    // Step 3: Add shapes and lines to the store
    // ------------------------------------------------------------------

    // Add a shape: "Patio" 3m x 4m
    const patioId = store.getState().nextObjectId();
    expect(patioId).toBe(0);
    const patio: ShapeObject = {
      id: patioId,
      type: "shape",
      name: "Patio",
      widthM: 3,
      heightM: 4,
      color: "rgba(76, 175, 80, 0.6)",
    };
    store.getState().addObject(patio);

    // Record its mock Fabric placement
    fabricStates[patioId] = {
      left: 100,
      top: 150,
      scaleX: 1,
      scaleY: 1,
      angle: 0,
      width: 300, // 3m * 100 px/m
      height: 400, // 4m * 100 px/m
      baseWidthPx: 300,
      baseHeightPx: 400,
    };

    // Capture snapshot after adding patio
    historyManager.push(captureSnapshot(fabricStates));

    // Add a line: "Fence" 5m
    const fenceId = store.getState().nextObjectId();
    expect(fenceId).toBe(1);
    const fence: LineObject = {
      id: fenceId,
      type: "line",
      name: "Fence",
      lengthM: 5,
      color: "rgba(244, 67, 54, 1)",
    };
    store.getState().addObject(fence);

    fabricStates[fenceId] = {
      left: 50,
      top: 50,
      scaleX: 1,
      scaleY: 1,
      angle: 0,
      x1: 0,
      y1: 0,
      x2: 500, // 5m * 100 px/m
      y2: 0,
      strokeWidth: 3,
    };

    // Add a second shape: "Shed" 2m x 2.5m
    const shedId = store.getState().nextObjectId();
    expect(shedId).toBe(2);
    const shed: ShapeObject = {
      id: shedId,
      type: "shape",
      name: "Shed",
      widthM: 2,
      heightM: 2.5,
      color: "rgba(33, 150, 243, 0.6)",
    };
    store.getState().addObject(shed);

    fabricStates[shedId] = {
      left: 450,
      top: 300,
      scaleX: 1,
      scaleY: 1,
      angle: 30,
      width: 200,
      height: 250,
      baseWidthPx: 200,
      baseHeightPx: 250,
    };

    // Capture snapshot after adding fence + shed
    historyManager.push(captureSnapshot(fabricStates));

    // Verify store state
    expect(store.getState().objects.size).toBe(3);
    expect(store.getState().objectIdCounter).toBe(3);

    // Verify selectVisibleObjects returns shapes and lines (no masks)
    const visible = selectVisibleObjects(store.getState());
    expect(visible).toHaveLength(3);
    expect(visible.map((o) => o.type).sort()).toEqual([
      "line",
      "shape",
      "shape",
    ]);

    // ------------------------------------------------------------------
    // Step 4: Undo/redo with HistoryManager
    // ------------------------------------------------------------------

    // We have 3 snapshots: [empty+calibrated, +patio, +fence+shed]
    // Pointer is at index 2 (latest)
    let histState = historyManager.getState();
    expect(histState.canUndo).toBe(true);
    expect(histState.undoCount).toBe(2);
    expect(histState.canRedo).toBe(false);

    // Undo once: should return snapshot at index 1 (just the patio)
    const undoResult1 = historyManager.undo();
    expect(undoResult1).not.toBeNull();
    expect(undoResult1!.storeSnapshot.objects).toHaveLength(1);
    expect(undoResult1!.storeSnapshot.objects[0].name).toBe("Patio");

    // Apply the undo to the store
    store.getState().loadProject({
      pixelsPerMeter: undoResult1!.storeSnapshot.pixelsPerMeter,
      backgroundImageData: null,
      objects: undoResult1!.storeSnapshot.objects,
    });
    expect(store.getState().objects.size).toBe(1);
    expect(store.getState().objects.get(patioId)?.name).toBe("Patio");

    // History state after undo
    histState = historyManager.getState();
    expect(histState.canUndo).toBe(true);
    expect(histState.undoCount).toBe(1);
    expect(histState.canRedo).toBe(true);
    expect(histState.redoCount).toBe(1);

    // Redo: should return snapshot at index 2 (patio + fence + shed)
    const redoResult = historyManager.redo();
    expect(redoResult).not.toBeNull();
    expect(redoResult!.storeSnapshot.objects).toHaveLength(3);

    // Apply the redo to the store
    store.getState().loadProject({
      pixelsPerMeter: redoResult!.storeSnapshot.pixelsPerMeter,
      backgroundImageData: null,
      objects: redoResult!.storeSnapshot.objects,
    });
    expect(store.getState().objects.size).toBe(3);

    // Undo twice and push a new snapshot (should truncate redo branch)
    historyManager.undo();
    historyManager.undo();
    expect(historyManager.getState().redoCount).toBe(2);

    // Push a new snapshot — redo branch should be discarded
    const replacementShape: ShapeObject = {
      id: 10,
      type: "shape",
      name: "Gazebo",
      widthM: 4,
      heightM: 4,
      color: "rgba(255, 152, 0, 0.6)",
    };
    // Simulate applying the replacement state
    store.getState().loadProject({
      pixelsPerMeter: 100,
      backgroundImageData: null,
      objects: [replacementShape],
    });

    fabricStates[10] = {
      left: 200,
      top: 200,
      scaleX: 1,
      scaleY: 1,
      angle: 0,
      width: 400,
      height: 400,
      baseWidthPx: 400,
      baseHeightPx: 400,
    };

    historyManager.push(captureSnapshot(fabricStates));
    histState = historyManager.getState();
    expect(histState.canRedo).toBe(false);
    expect(histState.redoCount).toBe(0);

    // Sync the history state with the store (like useHistory does)
    store.getState().setHistoryState(histState);
    expect(store.getState().historyState.canRedo).toBe(false);

    // ------------------------------------------------------------------
    // Step 5: Restore the full workspace for serialization
    //         (3 objects: patio, fence, shed)
    // ------------------------------------------------------------------
    store.getState().loadProject({
      pixelsPerMeter: 100,
      backgroundImageData: "data:image/png;base64,floorplan",
      objects: [patio, fence, shed],
    });

    // ------------------------------------------------------------------
    // Step 6: Serialize project and verify round-trip fidelity
    // ------------------------------------------------------------------
    const allObjects = Array.from(store.getState().objects.values());
    const getFabricState = makeFabricStateLookup(fabricStates);

    const serialized = serializeProject(
      store.getState().pixelsPerMeter,
      store.getState().backgroundImageData,
      allObjects,
      getFabricState,
    );

    // Verify serialized structure
    expect(serialized.version).toBe(3);
    expect(serialized.pixelsPerMeter).toBe(100);
    expect(serialized.backgroundImage).toBe("data:image/png;base64,floorplan");
    expect(serialized.objects).toHaveLength(3);
    expect((serialized as SerializedProjectV3).metadata?.exportedFrom).toBe(
      "plan-the-space",
    );

    // Validate the serialized data
    expect(validateProjectData(serialized)).toBe(true);

    // Verify specific serialized objects
    const serializedPatio = serialized.objects.find((o) => o.name === "Patio");
    expect(serializedPatio).toBeDefined();
    expect(serializedPatio!.type).toBe("shape");
    if (serializedPatio!.type === "shape") {
      expect(serializedPatio!.widthM).toBe(3);
      expect(serializedPatio!.heightM).toBe(4);
      expect(serializedPatio!.left).toBe(100);
      expect(serializedPatio!.top).toBe(150);
      expect(serializedPatio!.baseWidthPx).toBe(300);
      expect(serializedPatio!.baseHeightPx).toBe(400);
    }

    const serializedFence = serialized.objects.find((o) => o.name === "Fence");
    expect(serializedFence).toBeDefined();
    expect(serializedFence!.type).toBe("line");
    if (serializedFence!.type === "line") {
      expect(serializedFence!.lengthM).toBe(5);
      expect(serializedFence!.x2).toBe(500);
      expect(serializedFence!.strokeWidth).toBe(3);
    }

    const serializedShed = serialized.objects.find((o) => o.name === "Shed");
    expect(serializedShed).toBeDefined();
    if (serializedShed!.type === "shape") {
      expect(serializedShed!.angle).toBe(30);
      expect(serializedShed!.widthM).toBe(2);
      expect(serializedShed!.heightM).toBe(2.5);
    }

    // Deserialize and verify round-trip fidelity
    const deserialized = deserializeProject(serialized);
    expect(deserialized.pixelsPerMeter).toBe(100);
    expect(deserialized.backgroundImageData).toBe(
      "data:image/png;base64,floorplan",
    );
    expect(deserialized.objects).toHaveLength(3);

    // Verify store-level object metadata survives the round-trip
    const dPatio = deserialized.objects.find((o) => o.name === "Patio");
    expect(dPatio).toBeDefined();
    expect(dPatio!.type).toBe("shape");
    if (dPatio!.type === "shape") {
      expect(dPatio!.widthM).toBe(3);
      expect(dPatio!.heightM).toBe(4);
      expect(dPatio!.color).toBe("rgba(76, 175, 80, 0.6)");
    }

    const dFence = deserialized.objects.find((o) => o.name === "Fence");
    expect(dFence).toBeDefined();
    if (dFence!.type === "line") {
      expect(dFence!.lengthM).toBe(5);
      expect(dFence!.color).toBe("rgba(244, 67, 54, 1)");
    }

    // Verify Fabric state is preserved in serializedObjects (for canvas reconstruction)
    const dSerializedPatio = deserialized.serializedObjects.find(
      (o) => o.name === "Patio",
    );
    expect(dSerializedPatio).toBeDefined();
    if (dSerializedPatio!.type === "shape") {
      expect(dSerializedPatio!.left).toBe(100);
      expect(dSerializedPatio!.baseWidthPx).toBe(300);
    }

    // ------------------------------------------------------------------
    // Step 7: Save to IndexedDB and reload (auto-save simulation)
    // ------------------------------------------------------------------
    await saveProject(serialized);

    // Load from IDB — should come back migrated to v3
    const loadedFromIDB = await loadProject();
    expect(loadedFromIDB).not.toBeNull();
    expect(loadedFromIDB!.version).toBe(3);
    expect(loadedFromIDB!.pixelsPerMeter).toBe(100);
    expect(loadedFromIDB!.backgroundImage).toBe(
      "data:image/png;base64,floorplan",
    );
    expect(loadedFromIDB!.objects).toHaveLength(3);

    // Deserialize the IDB data and load into a fresh store (simulate page reload)
    const reloaded = deserializeProject(loadedFromIDB!);
    store.getState().reset();
    expect(store.getState().objects.size).toBe(0);

    store.getState().loadProject({
      pixelsPerMeter: reloaded.pixelsPerMeter,
      backgroundImageData: reloaded.backgroundImageData,
      objects: reloaded.objects,
    });

    // Verify restored state matches original
    expect(store.getState().pixelsPerMeter).toBe(100);
    expect(store.getState().backgroundImageData).toBe(
      "data:image/png;base64,floorplan",
    );
    expect(store.getState().objects.size).toBe(3);
    expect(store.getState().objects.get(patioId)?.name).toBe("Patio");
    expect(store.getState().objects.get(fenceId)?.name).toBe("Fence");
    expect(store.getState().objects.get(shedId)?.name).toBe("Shed");

    // objectIdCounter should be set to max(id) + 1
    expect(store.getState().objectIdCounter).toBe(3);

    // Verify the visible objects selector still works after reload
    const reloadedVisible = selectVisibleObjects(store.getState());
    expect(reloadedVisible).toHaveLength(3);

    // ------------------------------------------------------------------
    // Step 8: Image pool round-trip via IDB
    // ------------------------------------------------------------------
    const imageData =
      "data:image/png;base64,longimagedata_for_floorplan_image_test_1234567890";
    const imageRef = await historyManager.registerImage(imageData);
    expect(imageRef).toBeTruthy();

    // Image should be resolvable from pool
    const resolved = await historyManager.resolveImage(imageRef);
    expect(resolved).toBe(imageData);

    // Image should also be in raw IDB
    const fromIDB = await loadImageData(imageRef);
    expect(fromIDB).toBe(imageData);

    // Register same image again (increases refcount)
    const sameRef = await historyManager.registerImage(imageData);
    expect(sameRef).toBe(imageRef);

    // Release once — refcount drops to 1, still available
    await historyManager.releaseImage(imageRef);
    const stillAvailable = await loadImageData(imageRef);
    expect(stillAvailable).toBe(imageData);

    // Release again — refcount drops to 0, removed from IDB
    await historyManager.releaseImage(imageRef);
    const afterFullRelease = await loadImageData(imageRef);
    expect(afterFullRelease).toBeNull();

    // ------------------------------------------------------------------
    // Step 9: Overwrite and clear IDB project
    // ------------------------------------------------------------------
    // Modify the store and save again (simulates overwrite)
    store.getState().updateObject(patioId, { name: "Big Patio" });
    const updatedObjects = Array.from(store.getState().objects.values());
    const updatedSerialized = serializeProject(
      store.getState().pixelsPerMeter,
      store.getState().backgroundImageData,
      updatedObjects,
      getFabricState,
    );
    await saveProject(updatedSerialized);

    const reloadedAgain = await loadProject();
    const updatedPatio = reloadedAgain!.objects.find(
      (o) => o.name === "Big Patio",
    );
    expect(updatedPatio).toBeDefined();
    expect(updatedPatio!.type).toBe("shape");

    // Clear the project from IDB
    await clearProject();
    const afterClear = await loadProject();
    expect(afterClear).toBeNull();

    // ------------------------------------------------------------------
    // Step 10: Final store reset and cleanup
    // ------------------------------------------------------------------
    await historyManager.reset();
    expect(historyManager.getState().canUndo).toBe(false);
    expect(historyManager.getState().canRedo).toBe(false);
    expect(historyManager.getCurrentSnapshot()).toBeNull();

    store.getState().reset();
    expect(store.getState().mode).toBe("normal");
    expect(store.getState().pixelsPerMeter).toBeNull();
    expect(store.getState().objects.size).toBe(0);
    expect(store.getState().objectIdCounter).toBe(0);
  });
});
