import type { HistorySnapshot, HistoryState, ImageRef } from "./types";
import type { StorageAdapter } from "./storage/storageAdapter";
import { HISTORY_LIMIT, IMAGE_LRU_SIZE } from "./constants";
import { getDefaultAdapter } from "./storage/indexeddb";

// ============================================
// Immutable HistoryStack type & constant
// ============================================

export interface HistoryStack {
  readonly entries: readonly HistorySnapshot[];
  readonly pointer: number; // -1 = empty
}

export const EMPTY_STACK: HistoryStack = { entries: [], pointer: -1 };

// ============================================
// Pure stack functions
// ============================================

/**
 * Push a snapshot onto the stack. Truncates the redo branch, enforces HISTORY_LIMIT.
 * Returns the new stack plus arrays of discarded (redo branch) and evicted (over limit) snapshots.
 * Never mutates the input stack.
 */
export function pushSnapshot(
  stack: HistoryStack,
  snapshot: HistorySnapshot,
): {
  next: HistoryStack;
  discarded: HistorySnapshot[];
  evicted: HistorySnapshot[];
} {
  // Truncate redo branch (entries after pointer)
  const discarded =
    stack.pointer < stack.entries.length - 1
      ? stack.entries.slice(stack.pointer + 1)
      : [];

  // Build new entries: keep up to pointer, then append the new snapshot
  const kept = stack.entries.slice(0, stack.pointer + 1);
  let newEntries = [...kept, snapshot];
  let newPointer = newEntries.length - 1;

  // Enforce limit — evict oldest entries from the front
  const evicted: HistorySnapshot[] = [];
  while (newEntries.length > HISTORY_LIMIT) {
    evicted.push(newEntries[0]);
    newEntries = newEntries.slice(1);
    newPointer--;
  }

  return {
    next: { entries: newEntries, pointer: newPointer },
    discarded,
    evicted,
  };
}

/**
 * Move the pointer back by one. Returns the new stack and the snapshot to restore (or null).
 * Never mutates the input stack.
 */
export function undoStack(stack: HistoryStack): {
  next: HistoryStack;
  snapshot: HistorySnapshot | null;
} {
  if (stack.pointer <= 0) {
    return { next: stack, snapshot: null };
  }
  const newPointer = stack.pointer - 1;
  return {
    next: { entries: stack.entries, pointer: newPointer },
    snapshot: stack.entries[newPointer],
  };
}

/**
 * Move the pointer forward by one. Returns the new stack and the snapshot to restore (or null).
 * Never mutates the input stack.
 */
export function redoStack(stack: HistoryStack): {
  next: HistoryStack;
  snapshot: HistorySnapshot | null;
} {
  if (stack.pointer >= stack.entries.length - 1) {
    return { next: stack, snapshot: null };
  }
  const newPointer = stack.pointer + 1;
  return {
    next: { entries: stack.entries, pointer: newPointer },
    snapshot: stack.entries[newPointer],
  };
}

/**
 * Derive the HistoryState (canUndo, canRedo, counts) from a stack.
 */
export function getStackState(stack: HistoryStack): HistoryState {
  return {
    canUndo: stack.pointer > 0,
    canRedo: stack.pointer < stack.entries.length - 1,
    undoCount: Math.max(0, stack.pointer),
    redoCount: Math.max(0, stack.entries.length - 1 - stack.pointer),
  };
}

/**
 * Get the current snapshot at the pointer (or null if empty).
 */
export function getCurrentSnapshot(
  stack: HistoryStack,
): HistorySnapshot | null {
  if (stack.pointer < 0 || stack.pointer >= stack.entries.length) return null;
  return stack.entries[stack.pointer];
}

// ============================================
// ImagePool — stateful (adapter + ref counting)
// ============================================

export class ImagePool {
  private imageRefCounts = new Map<string, number>();
  private lruCache = new Map<string, string>(); // ref -> data
  private adapter: StorageAdapter;

  constructor(adapter?: StorageAdapter) {
    this.adapter = adapter ?? getDefaultAdapter();
  }

  /** Fast fingerprint: length + first/last 64 chars */
  computeImageRef(data: string): ImageRef {
    const len = data.length;
    const first = data.slice(0, 64);
    const last = data.slice(-64);
    return `img_${len}_${first}_${last}`;
  }

  /** Store image data via adapter, increment refcount. Returns the ref. */
  async registerImage(data: string): Promise<ImageRef> {
    const ref = this.computeImageRef(data);
    const count = this.imageRefCounts.get(ref) ?? 0;
    this.imageRefCounts.set(ref, count + 1);

    if (count === 0) {
      // First registration — store via adapter
      await this.adapter.saveImage(ref, data);
    }

    // Add to LRU
    this.addToLru(ref, data);

    return ref;
  }

  /** Decrement refcount. If zero, delete via adapter. */
  async releaseImage(ref: ImageRef): Promise<void> {
    const count = this.imageRefCounts.get(ref) ?? 0;
    if (count <= 1) {
      this.imageRefCounts.delete(ref);
      await this.adapter.deleteImage(ref);
      this.lruCache.delete(ref);
    } else {
      this.imageRefCounts.set(ref, count - 1);
    }
  }

  /** Resolve ref to data. LRU hit = instant, miss = adapter read. */
  async resolveImage(ref: ImageRef): Promise<string> {
    // Check LRU first
    const cached = this.lruCache.get(ref);
    if (cached !== undefined) {
      // Move to end (most recently used)
      this.lruCache.delete(ref);
      this.lruCache.set(ref, cached);
      return cached;
    }

    // Fallback to adapter
    const data = await this.adapter.loadImage(ref);
    if (!data) return "";
    this.addToLru(ref, data);
    return data;
  }

  clearLruCache(): void {
    this.lruCache.clear();
  }

  async reset(): Promise<void> {
    this.imageRefCounts.clear();
    this.lruCache.clear();
    await this.adapter.clearImages();
  }

  private addToLru(ref: string, data: string): void {
    if (this.lruCache.has(ref)) {
      this.lruCache.delete(ref);
    }
    this.lruCache.set(ref, data);
    // Evict oldest if over limit
    while (this.lruCache.size > IMAGE_LRU_SIZE) {
      const oldest = this.lruCache.keys().next().value;
      if (oldest !== undefined) {
        this.lruCache.delete(oldest);
      }
    }
  }
}

// ============================================
// HistoryManager — composes HistoryStack + ImagePool
// Preserves the same public API as the original class.
// Accepts an optional StorageAdapter; defaults to the IDB adapter.
// ============================================

export class HistoryManager {
  private stack: HistoryStack = EMPTY_STACK;
  private pool: ImagePool;

  constructor(adapter?: StorageAdapter) {
    this.pool = new ImagePool(adapter);
  }

  // ============================================
  // Image pool (delegated to ImagePool)
  // ============================================

  computeImageRef(data: string): ImageRef {
    return this.pool.computeImageRef(data);
  }

  async registerImage(data: string): Promise<ImageRef> {
    return this.pool.registerImage(data);
  }

  async releaseImage(ref: ImageRef): Promise<void> {
    return this.pool.releaseImage(ref);
  }

  async resolveImage(ref: ImageRef): Promise<string> {
    return this.pool.resolveImage(ref);
  }

  clearLruCache(): void {
    this.pool.clearLruCache();
  }

  // ============================================
  // Stack operations (delegated to pure functions)
  // ============================================

  push(snapshot: HistorySnapshot): void {
    const result = pushSnapshot(this.stack, snapshot);
    this.stack = result.next;
    // Release images from discarded and evicted snapshots
    for (const s of [...result.discarded, ...result.evicted]) {
      this.releaseSnapshotImages(s);
    }
  }

  undo(): HistorySnapshot | null {
    const result = undoStack(this.stack);
    this.stack = result.next;
    return result.snapshot;
  }

  redo(): HistorySnapshot | null {
    const result = redoStack(this.stack);
    this.stack = result.next;
    return result.snapshot;
  }

  getState(): HistoryState {
    return getStackState(this.stack);
  }

  getCurrentSnapshot(): HistorySnapshot | null {
    return getCurrentSnapshot(this.stack);
  }

  async reset(): Promise<void> {
    this.stack = EMPTY_STACK;
    await this.pool.reset();
  }

  // ============================================
  // Internal helpers
  // ============================================

  private releaseSnapshotImages(snapshot: HistorySnapshot): void {
    const bgRef = snapshot.storeSnapshot.backgroundImageRef;
    if (bgRef) {
      this.pool.releaseImage(bgRef).catch(() => {});
    }
    // Release image refs from overlay/background image objects
    for (const obj of snapshot.storeSnapshot.objects) {
      const o = obj as unknown as Record<string, unknown>;
      if (
        (o.type === "overlayImage" || o.type === "backgroundImage") &&
        typeof o.imageDataRef === "string"
      ) {
        this.pool.releaseImage(o.imageDataRef as string).catch(() => {});
      }
    }
  }
}
