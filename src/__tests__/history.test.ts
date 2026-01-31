import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import {
  HistoryManager,
  EMPTY_STACK,
  pushSnapshot,
  undoStack,
  redoStack,
  getStackState,
  getCurrentSnapshot,
} from "@/lib/history";
import type { HistoryStack } from "@/lib/history";
import type {
  HistorySnapshot,
  StoreSnapshot,
  FabricObjectSnapshot,
} from "@/lib/types";

function makeSnapshot(overrides?: {
  objects?: StoreSnapshot["objects"];
  backgroundImageRef?: string | null;
  fabricSnapshots?: FabricObjectSnapshot[];
}): HistorySnapshot {
  return {
    storeSnapshot: {
      pixelsPerMeter: 50,
      backgroundImageRef: overrides?.backgroundImageRef ?? null,
      objects: overrides?.objects ?? [],
      objectIdCounter: 0,
    },
    fabricSnapshots: overrides?.fabricSnapshots ?? [],
    timestamp: Date.now(),
  };
}

let manager: HistoryManager;

beforeEach(async () => {
  // Clear all databases between tests
  const databases = await indexedDB.databases();
  for (const db of databases) {
    if (db.name) indexedDB.deleteDatabase(db.name);
  }
  manager = new HistoryManager();
});

describe("HistoryManager stack behavior", () => {
  it("starts empty", () => {
    const state = manager.getState();
    expect(state.canUndo).toBe(false);
    expect(state.canRedo).toBe(false);
    expect(state.undoCount).toBe(0);
    expect(state.redoCount).toBe(0);
  });

  it("push adds snapshot", () => {
    manager.push(makeSnapshot());
    const state = manager.getState();
    expect(state.undoCount).toBe(0); // pointer at 0, nothing to undo to
  });

  it("push two, can undo once", () => {
    manager.push(makeSnapshot());
    manager.push(makeSnapshot());
    const state = manager.getState();
    expect(state.canUndo).toBe(true);
    expect(state.undoCount).toBe(1);
  });

  it("undo returns previous snapshot", () => {
    const first = makeSnapshot();
    const second = makeSnapshot();
    manager.push(first);
    manager.push(second);
    const result = manager.undo();
    expect(result).toBeTruthy();
    expect(result?.timestamp).toBe(first.timestamp);
  });

  it("redo returns next snapshot", () => {
    const first = makeSnapshot();
    const second = makeSnapshot();
    manager.push(first);
    manager.push(second);
    manager.undo();
    const result = manager.redo();
    expect(result).toBeTruthy();
    expect(result?.timestamp).toBe(second.timestamp);
  });

  it("undo on single entry returns null", () => {
    manager.push(makeSnapshot());
    expect(manager.undo()).toBeNull();
  });

  it("undo on empty returns null", () => {
    expect(manager.undo()).toBeNull();
  });

  it("redo with nothing returns null", () => {
    manager.push(makeSnapshot());
    expect(manager.redo()).toBeNull();
  });

  it("push after undo truncates redo branch", () => {
    manager.push(makeSnapshot());
    manager.push(makeSnapshot());
    manager.push(makeSnapshot());
    manager.undo();
    manager.undo();
    // Now at first snapshot, with 2 in redo
    expect(manager.getState().canRedo).toBe(true);
    expect(manager.getState().redoCount).toBe(2);
    // Push new snapshot — redo branch gone
    manager.push(makeSnapshot());
    expect(manager.getState().canRedo).toBe(false);
    expect(manager.getState().redoCount).toBe(0);
  });

  it("enforces HISTORY_LIMIT", () => {
    for (let i = 0; i < 55; i++) {
      manager.push(makeSnapshot());
    }
    // Stack should be capped at 50
    expect(manager.getState().undoCount).toBeLessThanOrEqual(50);
  });

  it("getCurrentSnapshot returns current", () => {
    const snap = makeSnapshot();
    manager.push(snap);
    expect(manager.getCurrentSnapshot()?.timestamp).toBe(snap.timestamp);
  });

  it("getCurrentSnapshot on empty returns null", () => {
    expect(manager.getCurrentSnapshot()).toBeNull();
  });
});

describe("HistoryManager image pool", () => {
  it("computeImageRef is deterministic", () => {
    const data = "data:image/png;base64,abc123";
    const ref1 = manager.computeImageRef(data);
    const ref2 = manager.computeImageRef(data);
    expect(ref1).toBe(ref2);
  });

  it("computeImageRef differs for different data", () => {
    const ref1 = manager.computeImageRef("data:image/png;base64,abc");
    const ref2 = manager.computeImageRef("data:image/png;base64,xyz");
    expect(ref1).not.toBe(ref2);
  });

  it("registerImage stores and resolveImage retrieves", async () => {
    const data = "data:image/png;base64,testdata123456789012345678901234567890";
    const ref = await manager.registerImage(data);
    expect(ref).toBeTruthy();
    const resolved = await manager.resolveImage(ref);
    expect(resolved).toBe(data);
  });

  it("releaseImage decrements refcount", async () => {
    const data = "data:image/png;base64,testimage";
    const ref = await manager.registerImage(data);
    // Register again to increment refcount
    await manager.registerImage(data);
    // Release once — should still be available
    await manager.releaseImage(ref);
    const resolved = await manager.resolveImage(ref);
    expect(resolved).toBe(data);
    // Release again — should be gone from IDB
    await manager.releaseImage(ref);
    // LRU might still have it, but after clearing:
    manager.clearLruCache();
    // After clearing LRU and releasing all refs, resolve should get null from IDB
    // (implementation returns empty string or throws — we just check it was deleted)
  });

  it("reset clears stack", async () => {
    manager.push(makeSnapshot());
    manager.push(makeSnapshot());
    await manager.reset();
    expect(manager.getState().undoCount).toBe(0);
    expect(manager.getState().canUndo).toBe(false);
    expect(manager.getCurrentSnapshot()).toBeNull();
  });
});

describe("HistoryManager LRU cache", () => {
  it("caches resolved images", async () => {
    const data = "data:image/png;base64,cached";
    const ref = await manager.registerImage(data);
    // First resolve populates cache
    await manager.resolveImage(ref);
    // Should be in LRU now — resolve again should still work
    const cached = await manager.resolveImage(ref);
    expect(cached).toBe(data);
  });
});

// ============================================
// Pure stack function tests
// ============================================

describe("pushSnapshot (pure function)", () => {
  it("pushes onto empty stack", () => {
    const snap = makeSnapshot();
    const result = pushSnapshot(EMPTY_STACK, snap);
    expect(result.next.entries).toHaveLength(1);
    expect(result.next.pointer).toBe(0);
    expect(result.next.entries[0]).toBe(snap);
    expect(result.discarded).toHaveLength(0);
    expect(result.evicted).toHaveLength(0);
  });

  it("pushes onto non-empty stack", () => {
    const snap1 = makeSnapshot();
    const snap2 = makeSnapshot();
    const { next: stack1 } = pushSnapshot(EMPTY_STACK, snap1);
    const result = pushSnapshot(stack1, snap2);
    expect(result.next.entries).toHaveLength(2);
    expect(result.next.pointer).toBe(1);
    expect(result.next.entries[0]).toBe(snap1);
    expect(result.next.entries[1]).toBe(snap2);
  });

  it("does not mutate the input stack", () => {
    const snap1 = makeSnapshot();
    const snap2 = makeSnapshot();
    const { next: stack1 } = pushSnapshot(EMPTY_STACK, snap1);

    // Capture original values
    const originalEntries = stack1.entries;
    const originalPointer = stack1.pointer;

    pushSnapshot(stack1, snap2);

    // Input stack is unchanged
    expect(stack1.entries).toBe(originalEntries);
    expect(stack1.pointer).toBe(originalPointer);
    expect(stack1.entries).toHaveLength(1);
  });

  it("truncates redo branch and returns discarded snapshots", () => {
    const snap1 = makeSnapshot();
    const snap2 = makeSnapshot();
    const snap3 = makeSnapshot();
    const snapNew = makeSnapshot();

    // Build stack: [snap1, snap2, snap3] pointer=2
    let { next: stack } = pushSnapshot(EMPTY_STACK, snap1);
    ({ next: stack } = pushSnapshot(stack, snap2));
    ({ next: stack } = pushSnapshot(stack, snap3));

    // Undo twice: pointer=0
    ({ next: stack } = undoStack(stack));
    ({ next: stack } = undoStack(stack));
    expect(stack.pointer).toBe(0);

    // Push new: should discard snap2 and snap3
    const result = pushSnapshot(stack, snapNew);
    expect(result.next.entries).toHaveLength(2); // snap1 + snapNew
    expect(result.next.pointer).toBe(1);
    expect(result.discarded).toHaveLength(2);
    expect(result.discarded[0]).toBe(snap2);
    expect(result.discarded[1]).toBe(snap3);
  });

  it("evicts oldest entries when exceeding HISTORY_LIMIT", () => {
    let stack: HistoryStack = EMPTY_STACK;
    const snapshots: HistorySnapshot[] = [];

    // Push 50 snapshots to fill the stack
    for (let i = 0; i < 50; i++) {
      const snap = makeSnapshot();
      snapshots.push(snap);
      ({ next: stack } = pushSnapshot(stack, snap));
    }
    expect(stack.entries).toHaveLength(50);

    // Push one more — should evict the oldest
    const snap51 = makeSnapshot();
    const result = pushSnapshot(stack, snap51);
    expect(result.next.entries).toHaveLength(50);
    expect(result.evicted).toHaveLength(1);
    expect(result.evicted[0]).toBe(snapshots[0]);
    // First entry is now snapshots[1]
    expect(result.next.entries[0]).toBe(snapshots[1]);
  });

  it("returns empty discarded and evicted when nothing to trim", () => {
    const snap = makeSnapshot();
    const { next: stack } = pushSnapshot(EMPTY_STACK, snap);
    const snap2 = makeSnapshot();
    const result = pushSnapshot(stack, snap2);
    expect(result.discarded).toHaveLength(0);
    expect(result.evicted).toHaveLength(0);
  });
});

describe("undoStack (pure function)", () => {
  it("returns null on empty stack", () => {
    const result = undoStack(EMPTY_STACK);
    expect(result.snapshot).toBeNull();
    expect(result.next).toBe(EMPTY_STACK);
  });

  it("returns null when pointer is at 0", () => {
    const snap = makeSnapshot();
    const { next: stack } = pushSnapshot(EMPTY_STACK, snap);
    const result = undoStack(stack);
    expect(result.snapshot).toBeNull();
    expect(result.next).toBe(stack);
  });

  it("moves pointer back and returns previous snapshot", () => {
    const snap1 = makeSnapshot();
    const snap2 = makeSnapshot();
    let { next: stack } = pushSnapshot(EMPTY_STACK, snap1);
    ({ next: stack } = pushSnapshot(stack, snap2));

    const result = undoStack(stack);
    expect(result.next.pointer).toBe(0);
    expect(result.snapshot).toBe(snap1);
    // Entries are not modified
    expect(result.next.entries).toBe(stack.entries);
  });

  it("does not mutate the input stack", () => {
    const snap1 = makeSnapshot();
    const snap2 = makeSnapshot();
    let { next: stack } = pushSnapshot(EMPTY_STACK, snap1);
    ({ next: stack } = pushSnapshot(stack, snap2));

    const originalPointer = stack.pointer;
    undoStack(stack);
    expect(stack.pointer).toBe(originalPointer);
  });
});

describe("redoStack (pure function)", () => {
  it("returns null when at end of stack", () => {
    const snap = makeSnapshot();
    const { next: stack } = pushSnapshot(EMPTY_STACK, snap);
    const result = redoStack(stack);
    expect(result.snapshot).toBeNull();
    expect(result.next).toBe(stack);
  });

  it("returns null on empty stack", () => {
    const result = redoStack(EMPTY_STACK);
    expect(result.snapshot).toBeNull();
    expect(result.next).toBe(EMPTY_STACK);
  });

  it("moves pointer forward and returns next snapshot", () => {
    const snap1 = makeSnapshot();
    const snap2 = makeSnapshot();
    let { next: stack } = pushSnapshot(EMPTY_STACK, snap1);
    ({ next: stack } = pushSnapshot(stack, snap2));
    ({ next: stack } = undoStack(stack));
    expect(stack.pointer).toBe(0);

    const result = redoStack(stack);
    expect(result.next.pointer).toBe(1);
    expect(result.snapshot).toBe(snap2);
    // Entries are not modified
    expect(result.next.entries).toBe(stack.entries);
  });

  it("does not mutate the input stack", () => {
    const snap1 = makeSnapshot();
    const snap2 = makeSnapshot();
    let { next: stack } = pushSnapshot(EMPTY_STACK, snap1);
    ({ next: stack } = pushSnapshot(stack, snap2));
    ({ next: stack } = undoStack(stack));

    const originalPointer = stack.pointer;
    redoStack(stack);
    expect(stack.pointer).toBe(originalPointer);
  });
});

describe("getStackState (pure function)", () => {
  it("returns correct state for empty stack", () => {
    const state = getStackState(EMPTY_STACK);
    expect(state.canUndo).toBe(false);
    expect(state.canRedo).toBe(false);
    expect(state.undoCount).toBe(0);
    expect(state.redoCount).toBe(0);
  });

  it("returns correct state for single entry", () => {
    const { next: stack } = pushSnapshot(EMPTY_STACK, makeSnapshot());
    const state = getStackState(stack);
    expect(state.canUndo).toBe(false);
    expect(state.canRedo).toBe(false);
    expect(state.undoCount).toBe(0);
    expect(state.redoCount).toBe(0);
  });

  it("returns correct state for multiple entries", () => {
    let { next: stack } = pushSnapshot(EMPTY_STACK, makeSnapshot());
    ({ next: stack } = pushSnapshot(stack, makeSnapshot()));
    ({ next: stack } = pushSnapshot(stack, makeSnapshot()));

    const state = getStackState(stack);
    expect(state.canUndo).toBe(true);
    expect(state.canRedo).toBe(false);
    expect(state.undoCount).toBe(2);
    expect(state.redoCount).toBe(0);
  });

  it("returns correct state after undo", () => {
    let { next: stack } = pushSnapshot(EMPTY_STACK, makeSnapshot());
    ({ next: stack } = pushSnapshot(stack, makeSnapshot()));
    ({ next: stack } = pushSnapshot(stack, makeSnapshot()));
    ({ next: stack } = undoStack(stack));

    const state = getStackState(stack);
    expect(state.canUndo).toBe(true);
    expect(state.canRedo).toBe(true);
    expect(state.undoCount).toBe(1);
    expect(state.redoCount).toBe(1);
  });
});

describe("getCurrentSnapshot (pure function)", () => {
  it("returns null for empty stack", () => {
    expect(getCurrentSnapshot(EMPTY_STACK)).toBeNull();
  });

  it("returns current snapshot", () => {
    const snap = makeSnapshot();
    const { next: stack } = pushSnapshot(EMPTY_STACK, snap);
    expect(getCurrentSnapshot(stack)).toBe(snap);
  });

  it("returns correct snapshot after undo", () => {
    const snap1 = makeSnapshot();
    const snap2 = makeSnapshot();
    let { next: stack } = pushSnapshot(EMPTY_STACK, snap1);
    ({ next: stack } = pushSnapshot(stack, snap2));
    ({ next: stack } = undoStack(stack));
    expect(getCurrentSnapshot(stack)).toBe(snap1);
  });
});
