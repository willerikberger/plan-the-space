import type { HistorySnapshot, HistoryState, ImageRef } from './types'
import { HISTORY_LIMIT, IMAGE_LRU_SIZE } from './constants'
import { saveImageData, loadImageData, deleteImageData, clearImagePool } from './storage/indexeddb'

export class HistoryManager {
  private stack: HistorySnapshot[] = []
  private pointer = -1 // index of current state
  private imageRefCounts = new Map<string, number>()
  private lruCache = new Map<string, string>() // ref -> data (last N images)

  // ============================================
  // Image pool
  // ============================================

  /** Fast fingerprint: length + first/last 64 chars */
  computeImageRef(data: string): ImageRef {
    const len = data.length
    const first = data.slice(0, 64)
    const last = data.slice(-64)
    return `img_${len}_${first}_${last}`
  }

  /** Store image data in IDB, increment refcount. Returns the ref. */
  async registerImage(data: string): Promise<ImageRef> {
    const ref = this.computeImageRef(data)
    const count = this.imageRefCounts.get(ref) ?? 0
    this.imageRefCounts.set(ref, count + 1)

    if (count === 0) {
      // First registration — store in IDB
      await saveImageData(ref, data)
    }

    // Add to LRU
    this.addToLru(ref, data)

    return ref
  }

  /** Decrement refcount. If zero, delete from IDB. */
  async releaseImage(ref: ImageRef): Promise<void> {
    const count = this.imageRefCounts.get(ref) ?? 0
    if (count <= 1) {
      this.imageRefCounts.delete(ref)
      await deleteImageData(ref)
      this.lruCache.delete(ref)
    } else {
      this.imageRefCounts.set(ref, count - 1)
    }
  }

  /** Resolve ref to data. LRU hit = instant, miss = IDB read. */
  async resolveImage(ref: ImageRef): Promise<string> {
    // Check LRU first
    const cached = this.lruCache.get(ref)
    if (cached !== undefined) {
      // Move to end (most recently used)
      this.lruCache.delete(ref)
      this.lruCache.set(ref, cached)
      return cached
    }

    // Fallback to IDB
    const data = await loadImageData(ref)
    if (!data) return ''
    this.addToLru(ref, data)
    return data
  }

  private addToLru(ref: string, data: string): void {
    if (this.lruCache.has(ref)) {
      this.lruCache.delete(ref)
    }
    this.lruCache.set(ref, data)
    // Evict oldest if over limit
    while (this.lruCache.size > IMAGE_LRU_SIZE) {
      const oldest = this.lruCache.keys().next().value
      if (oldest !== undefined) {
        this.lruCache.delete(oldest)
      }
    }
  }

  clearLruCache(): void {
    this.lruCache.clear()
  }

  // ============================================
  // Stack operations
  // ============================================

  push(snapshot: HistorySnapshot): void {
    // Truncate redo branch
    if (this.pointer < this.stack.length - 1) {
      const discarded = this.stack.splice(this.pointer + 1)
      // Fire-and-forget: release image refs from discarded snapshots
      for (const s of discarded) {
        this.releaseSnapshotImages(s)
      }
    }

    this.stack.push(snapshot)
    this.pointer = this.stack.length - 1

    // Enforce limit
    while (this.stack.length > HISTORY_LIMIT) {
      const evicted = this.stack.shift()!
      this.pointer--
      this.releaseSnapshotImages(evicted)
    }
  }

  undo(): HistorySnapshot | null {
    if (this.pointer <= 0) return null
    this.pointer--
    return this.stack[this.pointer]
  }

  redo(): HistorySnapshot | null {
    if (this.pointer >= this.stack.length - 1) return null
    this.pointer++
    return this.stack[this.pointer]
  }

  getState(): HistoryState {
    return {
      canUndo: this.pointer > 0,
      canRedo: this.pointer < this.stack.length - 1,
      undoCount: Math.max(0, this.pointer),
      redoCount: Math.max(0, this.stack.length - 1 - this.pointer),
    }
  }

  getCurrentSnapshot(): HistorySnapshot | null {
    if (this.pointer < 0 || this.pointer >= this.stack.length) return null
    return this.stack[this.pointer]
  }

  async reset(): Promise<void> {
    this.stack = []
    this.pointer = -1
    this.imageRefCounts.clear()
    this.lruCache.clear()
    await clearImagePool()
  }

  // ============================================
  // Internal helpers
  // ============================================

  private releaseSnapshotImages(snapshot: HistorySnapshot): void {
    const bgRef = snapshot.storeSnapshot.backgroundImageRef
    if (bgRef) {
      this.releaseImage(bgRef).catch(() => {})
    }
    // Release image refs from overlay/background image objects
    for (const obj of snapshot.storeSnapshot.objects) {
      const o = obj as unknown as Record<string, unknown>
      if ((o.type === 'overlayImage' || o.type === 'backgroundImage') && typeof o.imageDataRef === 'string') {
        this.releaseImage(o.imageDataRef as string).catch(() => {})
      }
    }
  }
}
