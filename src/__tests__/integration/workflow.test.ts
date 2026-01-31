import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import {
  usePlannerStore,
  selectVisibleObjects,
  selectObjectById,
} from "@/lib/store";
import {
  EMPTY_STACK,
  pushSnapshot,
  undoStack,
  redoStack,
  getStackState,
  getCurrentSnapshot,
} from "@/lib/history";
import type { HistoryStack } from "@/lib/history";
import {
  serializeProject,
  deserializeProject,
  validateProjectData,
} from "@/components/canvas/utils/serialization";
import type {
  PlannerObject,
  ShapeObject,
  LineObject,
  MaskObject,
  HistorySnapshot,
  StoreSnapshot,
  FabricObjectSnapshot,
} from "@/lib/types";

// ============================================
// Helpers
// ============================================

/** Build a mock fabric state for a shape, suitable for serialization */
function mockShapeFabricState(opts: {
  left?: number;
  top?: number;
  scaleX?: number;
  scaleY?: number;
  angle?: number;
  width?: number;
  height?: number;
  baseWidthPx?: number;
  baseHeightPx?: number;
}) {
  return {
    left: opts.left ?? 100,
    top: opts.top ?? 200,
    scaleX: opts.scaleX ?? 1,
    scaleY: opts.scaleY ?? 1,
    angle: opts.angle ?? 0,
    width: opts.width ?? 150,
    height: opts.height ?? 100,
    baseWidthPx: opts.baseWidthPx ?? 150,
    baseHeightPx: opts.baseHeightPx ?? 100,
  };
}

/** Build a mock fabric state for a line */
function mockLineFabricState(opts: {
  left?: number;
  top?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  strokeWidth?: number;
}) {
  return {
    left: opts.left ?? 50,
    top: opts.top ?? 50,
    scaleX: 1,
    scaleY: 1,
    angle: 0,
    x1: opts.x1 ?? 0,
    y1: opts.y1 ?? 0,
    x2: opts.x2 ?? 200,
    y2: opts.y2 ?? 0,
    strokeWidth: opts.strokeWidth ?? 3,
  };
}

/** Create a history snapshot from the current store state */
function captureStoreSnapshot(
  fabricStates?: Map<number, Record<string, unknown>>,
): HistorySnapshot {
  const state = usePlannerStore.getState();
  const objects: PlannerObject[] = Array.from(state.objects.values());

  const storeSnapshot: StoreSnapshot = {
    pixelsPerMeter: state.pixelsPerMeter,
    backgroundImageRef: null,
    objects: structuredClone(objects),
    objectIdCounter: state.objectIdCounter,
  };

  const fabricSnapshots: FabricObjectSnapshot[] = objects.map((obj) => ({
    id: obj.id,
    type: obj.type,
    fabricState: fabricStates?.get(obj.id) ?? {},
  }));

  return {
    storeSnapshot,
    fabricSnapshots,
    timestamp: Date.now(),
  };
}

/** Restore a store snapshot by applying it to the Zustand store */
function restoreStoreSnapshot(snapshot: HistorySnapshot): void {
  const { storeSnapshot } = snapshot;
  const map = new Map<number, PlannerObject>();
  for (const obj of storeSnapshot.objects) {
    map.set(obj.id, obj);
  }
  usePlannerStore.setState({
    pixelsPerMeter: storeSnapshot.pixelsPerMeter,
    objects: map,
    objectIdCounter: storeSnapshot.objectIdCounter,
  });
}

// ============================================
// Tests
// ============================================

beforeEach(() => {
  usePlannerStore.getState().reset();
});

describe("Full workflow integration: store -> history -> serialization", () => {
  it("exercises the complete user workflow through data layer", () => {
    // ----- Step 1: Load a project into the store -----
    const initialObjects: PlannerObject[] = [];
    usePlannerStore.getState().loadProject({
      pixelsPerMeter: null,
      backgroundImageData: "data:image/png;base64,fakebgimage",
      objects: initialObjects,
    });

    let state = usePlannerStore.getState();
    expect(state.mode).toBe("normal");
    expect(state.pixelsPerMeter).toBeNull();
    expect(state.backgroundImageData).toBe("data:image/png;base64,fakebgimage");
    expect(state.objects.size).toBe(0);

    // ----- Step 2: Simulate calibration (set pixelsPerMeter) -----
    usePlannerStore.getState().setPixelsPerMeter(75);
    state = usePlannerStore.getState();
    expect(state.pixelsPerMeter).toBe(75);

    // ----- Step 3: Add a shape via store -----
    const shapeId = usePlannerStore.getState().nextObjectId();
    const shape: ShapeObject = {
      id: shapeId,
      type: "shape",
      name: "Living Room",
      widthM: 5,
      heightM: 4,
      color: "rgba(76, 175, 80, 0.6)",
    };
    usePlannerStore.getState().addObject(shape);

    state = usePlannerStore.getState();
    expect(state.objects.size).toBe(1);
    const addedShape = state.objects.get(shapeId);
    expect(addedShape).toBeDefined();
    expect(addedShape?.type).toBe("shape");
    if (addedShape?.type === "shape") {
      expect(addedShape.name).toBe("Living Room");
      expect(addedShape.widthM).toBe(5);
      expect(addedShape.heightM).toBe(4);
    }

    // Verify selector works
    const visible = selectVisibleObjects(state);
    expect(visible).toHaveLength(1);
    expect(visible[0].id).toBe(shapeId);

    const found = selectObjectById(state, shapeId);
    expect(found).toBeDefined();
    expect(found?.name).toBe("Living Room");

    // ----- Step 4: Capture a history snapshot -----
    let historyStack: HistoryStack = EMPTY_STACK;
    const snapshot1 = captureStoreSnapshot();
    const pushResult1 = pushSnapshot(historyStack, snapshot1);
    historyStack = pushResult1.next;

    let stackState = getStackState(historyStack);
    expect(stackState.canUndo).toBe(false); // Only 1 entry, nothing to undo to
    expect(stackState.canRedo).toBe(false);
    expect(
      getCurrentSnapshot(historyStack)?.storeSnapshot.objects,
    ).toHaveLength(1);
    expect(
      getCurrentSnapshot(historyStack)?.storeSnapshot.objects[0].name,
    ).toBe("Living Room");

    // ----- Step 5: Modify the shape -----
    usePlannerStore.getState().updateObject(shapeId, { name: "Kitchen" });
    state = usePlannerStore.getState();
    expect(state.objects.get(shapeId)?.name).toBe("Kitchen");

    // Capture snapshot after modification
    const snapshot2 = captureStoreSnapshot();
    const pushResult2 = pushSnapshot(historyStack, snapshot2);
    historyStack = pushResult2.next;

    stackState = getStackState(historyStack);
    expect(stackState.canUndo).toBe(true); // Now 2 entries, can undo
    expect(stackState.canRedo).toBe(false);
    expect(stackState.undoCount).toBe(1);
    expect(
      getCurrentSnapshot(historyStack)?.storeSnapshot.objects[0].name,
    ).toBe("Kitchen");

    // ----- Step 6: Test undo -----
    const undoResult = undoStack(historyStack);
    historyStack = undoResult.next;
    expect(undoResult.snapshot).not.toBeNull();

    // Apply the undo to the store
    restoreStoreSnapshot(undoResult.snapshot!);

    // ----- Step 7: Verify state matches step 3 after undo -----
    state = usePlannerStore.getState();
    expect(state.objects.size).toBe(1);
    const restoredShape = state.objects.get(shapeId);
    expect(restoredShape?.name).toBe("Living Room"); // Back to original name
    if (restoredShape?.type === "shape") {
      expect(restoredShape.widthM).toBe(5);
      expect(restoredShape.heightM).toBe(4);
      expect(restoredShape.color).toBe("rgba(76, 175, 80, 0.6)");
    }
    expect(state.pixelsPerMeter).toBe(75); // Calibration preserved in snapshot

    // Verify redo is available
    stackState = getStackState(historyStack);
    expect(stackState.canUndo).toBe(false); // At first entry
    expect(stackState.canRedo).toBe(true);
    expect(stackState.redoCount).toBe(1);

    // ----- Step 8: Export to JSON using serialization -----
    // Build a mock fabricState lookup for export
    const fabricLookup = new Map<
      number,
      ReturnType<typeof mockShapeFabricState>
    >();
    fabricLookup.set(
      shapeId,
      mockShapeFabricState({
        left: 120,
        top: 250,
        width: 375, // 5m * 75 ppm
        height: 300, // 4m * 75 ppm
        baseWidthPx: 375,
        baseHeightPx: 300,
      }),
    );

    const objects = Array.from(state.objects.values());
    const exportedProject = serializeProject(
      state.pixelsPerMeter,
      state.backgroundImageData,
      objects,
      (id) => fabricLookup.get(id) ?? null,
    );

    expect(exportedProject.version).toBe(3);
    expect(exportedProject.pixelsPerMeter).toBe(75);
    expect(exportedProject.backgroundImage).toBe(
      "data:image/png;base64,fakebgimage",
    );
    expect(exportedProject.objects).toHaveLength(1);
    expect(exportedProject.objects[0].type).toBe("shape");
    expect(exportedProject.objects[0].name).toBe("Living Room");
    expect(validateProjectData(exportedProject)).toBe(true);

    // Verify shape-specific serialized fields
    const serializedShape = exportedProject.objects[0];
    if (serializedShape.type === "shape") {
      expect(serializedShape.widthM).toBe(5);
      expect(serializedShape.heightM).toBe(4);
      expect(serializedShape.left).toBe(120);
      expect(serializedShape.top).toBe(250);
      expect(serializedShape.baseWidthPx).toBe(375);
      expect(serializedShape.baseHeightPx).toBe(300);
    }

    // ----- Step 9: Import JSON and verify round-trip integrity -----
    const imported = deserializeProject(exportedProject);

    expect(imported.pixelsPerMeter).toBe(75);
    expect(imported.backgroundImageData).toBe(
      "data:image/png;base64,fakebgimage",
    );
    expect(imported.objects).toHaveLength(1);

    const importedShape = imported.objects[0];
    expect(importedShape.type).toBe("shape");
    expect(importedShape.name).toBe("Living Room");
    if (importedShape.type === "shape") {
      expect(importedShape.widthM).toBe(5);
      expect(importedShape.heightM).toBe(4);
      expect(importedShape.color).toBe("rgba(76, 175, 80, 0.6)");
    }

    // Verify serialized objects preserve Fabric positioning data
    expect(imported.serializedObjects).toHaveLength(1);
    const importedSerializedShape = imported.serializedObjects[0];
    if (importedSerializedShape.type === "shape") {
      expect(importedSerializedShape.left).toBe(120);
      expect(importedSerializedShape.top).toBe(250);
    }

    // Load imported data back into the store
    usePlannerStore.getState().loadProject({
      pixelsPerMeter: imported.pixelsPerMeter,
      backgroundImageData: imported.backgroundImageData,
      objects: imported.objects,
    });

    state = usePlannerStore.getState();
    expect(state.pixelsPerMeter).toBe(75);
    expect(state.backgroundImageData).toBe("data:image/png;base64,fakebgimage");
    expect(state.objects.size).toBe(1);
    expect(state.objects.get(shapeId)?.name).toBe("Living Room");
  });
});

describe("Multi-object workflow with redo and history truncation", () => {
  it("handles add, modify, undo, redo, and new branch correctly", () => {
    // Set up project
    usePlannerStore.getState().setPixelsPerMeter(100);

    // Capture initial empty state
    let historyStack: HistoryStack = EMPTY_STACK;
    const snap0 = captureStoreSnapshot();
    ({ next: historyStack } = pushSnapshot(historyStack, snap0));

    // Add shape
    const shapeId = usePlannerStore.getState().nextObjectId();
    const shape: ShapeObject = {
      id: shapeId,
      type: "shape",
      name: "Bedroom",
      widthM: 3,
      heightM: 4,
      color: "rgba(33, 150, 243, 0.6)",
    };
    usePlannerStore.getState().addObject(shape);

    const snap1 = captureStoreSnapshot();
    ({ next: historyStack } = pushSnapshot(historyStack, snap1));

    // Add line
    const lineId = usePlannerStore.getState().nextObjectId();
    const line: LineObject = {
      id: lineId,
      type: "line",
      name: "Wall Segment",
      lengthM: 6,
      color: "rgba(244, 67, 54, 1)",
    };
    usePlannerStore.getState().addObject(line);

    const snap2 = captureStoreSnapshot();
    ({ next: historyStack } = pushSnapshot(historyStack, snap2));

    let state = usePlannerStore.getState();
    expect(state.objects.size).toBe(2);

    // Verify both are visible
    const visible = selectVisibleObjects(state);
    expect(visible).toHaveLength(2);
    expect(visible.map((o) => o.type)).toContain("shape");
    expect(visible.map((o) => o.type)).toContain("line");

    // Undo twice: back to empty state
    let undoResult = undoStack(historyStack);
    historyStack = undoResult.next;
    restoreStoreSnapshot(undoResult.snapshot!);

    undoResult = undoStack(historyStack);
    historyStack = undoResult.next;
    restoreStoreSnapshot(undoResult.snapshot!);

    state = usePlannerStore.getState();
    expect(state.objects.size).toBe(0);

    // Redo once: back to 1 shape
    const redoResult = redoStack(historyStack);
    historyStack = redoResult.next;
    restoreStoreSnapshot(redoResult.snapshot!);

    state = usePlannerStore.getState();
    expect(state.objects.size).toBe(1);
    expect(state.objects.get(shapeId)?.name).toBe("Bedroom");

    // Verify redo is still available (line add)
    let stackState = getStackState(historyStack);
    expect(stackState.canRedo).toBe(true);
    expect(stackState.redoCount).toBe(1);

    // Now push a new snapshot (add a mask), which should truncate the redo branch
    const maskId = usePlannerStore.getState().nextObjectId();
    const mask: MaskObject = { id: maskId, type: "mask", name: "Cleanup Area" };
    usePlannerStore.getState().addObject(mask);

    const snapNew = captureStoreSnapshot();
    const pushResult = pushSnapshot(historyStack, snapNew);
    historyStack = pushResult.next;

    // Redo branch (the line-add snapshot) was discarded
    expect(pushResult.discarded).toHaveLength(1);
    stackState = getStackState(historyStack);
    expect(stackState.canRedo).toBe(false);
    expect(stackState.redoCount).toBe(0);

    // Store now has shape + mask (not the line).
    // Note: maskId may numerically equal lineId because restoring from history
    // resets objectIdCounter to the snapshot value, so IDs from discarded
    // branches can be reused. We verify by content rather than raw ID.
    state = usePlannerStore.getState();
    expect(state.objects.size).toBe(2);
    expect(state.objects.has(shapeId)).toBe(true);
    expect(state.objects.has(maskId)).toBe(true);

    const objectTypes = Array.from(state.objects.values()).map((o) => o.type);
    expect(objectTypes).toContain("shape");
    expect(objectTypes).toContain("mask");
    expect(objectTypes).not.toContain("line");
  });
});

describe("Serialization round-trip with multiple object types", () => {
  it("preserves shapes and lines through serialize -> deserialize -> reload", () => {
    usePlannerStore.getState().setPixelsPerMeter(50);
    usePlannerStore
      .getState()
      .setBackgroundImageData("data:image/png;base64,bg");

    const shapeId = usePlannerStore.getState().nextObjectId();
    const shape: ShapeObject = {
      id: shapeId,
      type: "shape",
      name: "Patio",
      widthM: 2.5,
      heightM: 3.1,
      color: "rgba(76, 175, 80, 0.6)",
    };
    usePlannerStore.getState().addObject(shape);

    const lineId = usePlannerStore.getState().nextObjectId();
    const line: LineObject = {
      id: lineId,
      type: "line",
      name: "Fence",
      lengthM: 8.2,
      color: "rgba(244, 67, 54, 1)",
    };
    usePlannerStore.getState().addObject(line);

    const maskId = usePlannerStore.getState().nextObjectId();
    const mask: MaskObject = { id: maskId, type: "mask", name: "Hide Area" };
    usePlannerStore.getState().addObject(mask);

    // Build fabric state lookup
    const fabricLookup = new Map<number, Record<string, unknown>>();
    fabricLookup.set(
      shapeId,
      mockShapeFabricState({
        left: 100,
        top: 200,
        width: 125,
        height: 155,
        baseWidthPx: 125,
        baseHeightPx: 155,
        angle: 45,
      }),
    );
    fabricLookup.set(
      lineId,
      mockLineFabricState({
        left: 300,
        top: 100,
        x1: 0,
        y1: 0,
        x2: 410,
        y2: 0,
        strokeWidth: 5,
      }),
    );
    fabricLookup.set(maskId, {
      left: 10,
      top: 20,
      scaleX: 2,
      scaleY: 1.5,
      angle: 0,
      width: 60,
      height: 40,
    });

    const state = usePlannerStore.getState();
    const objects = Array.from(state.objects.values());

    const project = serializeProject(
      state.pixelsPerMeter,
      state.backgroundImageData,
      objects,
      (id) =>
        (fabricLookup.get(id) as Parameters<
          typeof serializeProject
        >[3] extends (id: number) => infer R
          ? NonNullable<R>
          : never) ?? null,
    );

    expect(project.version).toBe(3);
    expect(project.objects).toHaveLength(3);
    expect(validateProjectData(project)).toBe(true);

    // Verify each serialized type
    const sShape = project.objects.find((o) => o.type === "shape");
    const sLine = project.objects.find((o) => o.type === "line");
    const sMask = project.objects.find((o) => o.type === "mask");
    expect(sShape).toBeDefined();
    expect(sLine).toBeDefined();
    expect(sMask).toBeDefined();

    if (sShape?.type === "shape") {
      expect(sShape.widthM).toBe(2.5);
      expect(sShape.angle).toBe(45);
    }
    if (sLine?.type === "line") {
      expect(sLine.lengthM).toBe(8.2);
      expect(sLine.x2).toBe(410);
      expect(sLine.strokeWidth).toBe(5);
    }
    if (sMask?.type === "mask") {
      expect(sMask.width).toBe(120); // 60 * 2
      expect(sMask.height).toBe(60); // 40 * 1.5
    }

    // Deserialize and reload
    const imported = deserializeProject(project);
    expect(imported.objects).toHaveLength(3);
    expect(imported.pixelsPerMeter).toBe(50);
    expect(imported.backgroundImageData).toBe("data:image/png;base64,bg");

    // Reset store and reload
    usePlannerStore.getState().reset();
    usePlannerStore.getState().loadProject({
      pixelsPerMeter: imported.pixelsPerMeter,
      backgroundImageData: imported.backgroundImageData,
      objects: imported.objects,
    });

    const reloaded = usePlannerStore.getState();
    expect(reloaded.pixelsPerMeter).toBe(50);
    expect(reloaded.objects.size).toBe(3);

    const reloadedShape = reloaded.objects.get(shapeId);
    expect(reloadedShape?.type).toBe("shape");
    if (reloadedShape?.type === "shape") {
      expect(reloadedShape.name).toBe("Patio");
      expect(reloadedShape.widthM).toBe(2.5);
      expect(reloadedShape.heightM).toBe(3.1);
    }

    const reloadedLine = reloaded.objects.get(lineId);
    expect(reloadedLine?.type).toBe("line");
    if (reloadedLine?.type === "line") {
      expect(reloadedLine.name).toBe("Fence");
      expect(reloadedLine.lengthM).toBe(8.2);
    }

    // objectIdCounter should be set past the highest id
    expect(reloaded.objectIdCounter).toBe(maskId + 1);
  });
});

describe("History stack state synchronizes with store historyState", () => {
  it("keeps Zustand historyState in sync with pure stack state", () => {
    const store = usePlannerStore;

    // Initial state
    let historyStack: HistoryStack = EMPTY_STACK;
    store.getState().setHistoryState(getStackState(historyStack));
    expect(store.getState().historyState.canUndo).toBe(false);

    // Add shape and push snapshot
    const id = store.getState().nextObjectId();
    store.getState().addObject({
      id,
      type: "shape",
      name: "Room",
      widthM: 3,
      heightM: 3,
      color: "red",
    } satisfies ShapeObject);
    const snap1 = captureStoreSnapshot();
    ({ next: historyStack } = pushSnapshot(historyStack, snap1));
    store.getState().setHistoryState(getStackState(historyStack));

    // After one entry, still can't undo
    expect(store.getState().historyState.canUndo).toBe(false);
    expect(store.getState().historyState.undoCount).toBe(0);

    // Modify and push second snapshot
    store.getState().updateObject(id, { name: "Updated Room" });
    const snap2 = captureStoreSnapshot();
    ({ next: historyStack } = pushSnapshot(historyStack, snap2));
    store.getState().setHistoryState(getStackState(historyStack));

    // Now can undo
    expect(store.getState().historyState.canUndo).toBe(true);
    expect(store.getState().historyState.undoCount).toBe(1);
    expect(store.getState().historyState.canRedo).toBe(false);

    // Undo
    const undoResult = undoStack(historyStack);
    historyStack = undoResult.next;
    store.getState().setHistoryState(getStackState(historyStack));

    expect(store.getState().historyState.canUndo).toBe(false);
    expect(store.getState().historyState.canRedo).toBe(true);
    expect(store.getState().historyState.redoCount).toBe(1);

    // Redo
    const redoResult = redoStack(historyStack);
    historyStack = redoResult.next;
    store.getState().setHistoryState(getStackState(historyStack));

    expect(store.getState().historyState.canUndo).toBe(true);
    expect(store.getState().historyState.canRedo).toBe(false);
    expect(store.getState().historyState.undoCount).toBe(1);
    expect(store.getState().historyState.redoCount).toBe(0);
  });
});

describe("Edge cases", () => {
  it("updateObject on non-existent id is a no-op", () => {
    usePlannerStore.getState().updateObject(999, { name: "Ghost" });
    expect(usePlannerStore.getState().objects.size).toBe(0);
  });

  it("removeObject on non-existent id is a no-op", () => {
    const id = usePlannerStore.getState().nextObjectId();
    usePlannerStore.getState().addObject({
      id,
      type: "shape",
      name: "Real",
      widthM: 1,
      heightM: 1,
      color: "r",
    } satisfies ShapeObject);
    usePlannerStore.getState().removeObject(999);
    expect(usePlannerStore.getState().objects.size).toBe(1);
  });

  it("undo on empty stack is safe and returns null", () => {
    const result = undoStack(EMPTY_STACK);
    expect(result.snapshot).toBeNull();
    expect(result.next).toBe(EMPTY_STACK);
  });

  it("export empty project serializes correctly", () => {
    const project = serializeProject(null, null, [], () => null);
    expect(project.version).toBe(3);
    expect(project.pixelsPerMeter).toBeNull();
    expect(project.backgroundImage).toBeNull();
    expect(project.objects).toHaveLength(0);
    expect(validateProjectData(project)).toBe(true);

    const imported = deserializeProject(project);
    expect(imported.objects).toHaveLength(0);
    expect(imported.pixelsPerMeter).toBeNull();
    expect(imported.backgroundImageData).toBeNull();
  });

  it("loadProject sets objectIdCounter past highest object id", () => {
    usePlannerStore.getState().loadProject({
      pixelsPerMeter: 50,
      backgroundImageData: null,
      objects: [
        { id: 10, type: "shape", name: "A", widthM: 1, heightM: 1, color: "r" },
        { id: 3, type: "line", name: "B", lengthM: 2, color: "b" },
        { id: 7, type: "mask", name: "C" },
      ],
    });
    // Counter should be 11 (10 + 1)
    expect(usePlannerStore.getState().objectIdCounter).toBe(11);
    // Next id should continue from there
    const nextId = usePlannerStore.getState().nextObjectId();
    expect(nextId).toBe(11);
  });
});
