import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { usePlannerStore } from "@/lib/store";
import { AUTOSAVE_DEBOUNCE_MS } from "@/lib/constants";
import {
  scheduleAutoSave,
  handleBeforeUnload,
} from "@/components/canvas/utils/autoSave";
import type { ScheduleAutoSaveOptions } from "@/components/canvas/utils/autoSave";
import type { SerializedProject } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a fresh timerRef for each test. */
function makeTimerRef(): { current: ReturnType<typeof setTimeout> | null } {
  return { current: null };
}

/** Creates a mock serialized project. */
function makeMockProject(): SerializedProject {
  return {
    version: 3,
    pixelsPerMeter: 50,
    backgroundImage: null,
    savedAt: new Date().toISOString(),
    objects: [],
  };
}

/** Builds a default options object with mocked functions. */
function makeOptions(
  overrides: Partial<ScheduleAutoSaveOptions> = {},
): ScheduleAutoSaveOptions {
  return {
    isRestoring: false,
    timerRef: makeTimerRef(),
    getFabricState: vi.fn().mockReturnValue(null),
    serializeProject: vi.fn().mockReturnValue(makeMockProject()),
    saveToIDB: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers();
  usePlannerStore.getState().reset();
  // autoSaveEnabled defaults to true after reset
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// scheduleAutoSave
// ---------------------------------------------------------------------------
describe("scheduleAutoSave", () => {
  it("fires saveToIDB after debounce period", async () => {
    const opts = makeOptions();
    scheduleAutoSave(opts);

    // Should not fire immediately
    expect(opts.saveToIDB).not.toHaveBeenCalled();

    // Advance past the debounce period
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);

    expect(opts.serializeProject).toHaveBeenCalledTimes(1);
    expect(opts.saveToIDB).toHaveBeenCalledTimes(1);
  });

  it("does not fire before debounce period elapses", () => {
    const opts = makeOptions();
    scheduleAutoSave(opts);

    vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS - 100);

    expect(opts.saveToIDB).not.toHaveBeenCalled();
  });

  it("skips entirely when isRestoring is true", async () => {
    const opts = makeOptions({ isRestoring: true });
    scheduleAutoSave(opts);

    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS + 1000);

    expect(opts.serializeProject).not.toHaveBeenCalled();
    expect(opts.saveToIDB).not.toHaveBeenCalled();
  });

  it("skips when autoSaveEnabled is false in the store", async () => {
    usePlannerStore.getState().setAutoSaveEnabled(false);
    const opts = makeOptions();
    scheduleAutoSave(opts);

    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS + 1000);

    expect(opts.serializeProject).not.toHaveBeenCalled();
    expect(opts.saveToIDB).not.toHaveBeenCalled();
  });

  it("cancels a previously scheduled save when called again", async () => {
    const timerRef = makeTimerRef();
    const saveToIDB1 = vi.fn().mockResolvedValue(undefined);
    const saveToIDB2 = vi.fn().mockResolvedValue(undefined);

    // Schedule first save
    scheduleAutoSave(makeOptions({ timerRef, saveToIDB: saveToIDB1 }));

    // Advance partway
    vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS - 500);

    // Schedule second save with same timerRef (cancels the first)
    scheduleAutoSave(makeOptions({ timerRef, saveToIDB: saveToIDB2 }));

    // Advance to when the first would have fired
    vi.advanceTimersByTime(500);
    expect(saveToIDB1).not.toHaveBeenCalled();

    // Advance to when the second fires
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS - 500);

    expect(saveToIDB1).not.toHaveBeenCalled();
    expect(saveToIDB2).toHaveBeenCalledTimes(1);
  });

  it("sets timerRef.current while pending", () => {
    const opts = makeOptions();
    expect(opts.timerRef.current).toBeNull();

    scheduleAutoSave(opts);

    expect(opts.timerRef.current).not.toBeNull();
  });

  it("calls serializeProject with current store state", async () => {
    // Seed the store
    usePlannerStore.getState().setPixelsPerMeter(75);
    usePlannerStore.getState().setBackgroundImageData("data:image/test");
    usePlannerStore
      .getState()
      .addObject({
        id: 0,
        type: "shape",
        name: "S",
        widthM: 1,
        heightM: 1,
        color: "r",
      });

    const opts = makeOptions();
    scheduleAutoSave(opts);

    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);

    expect(opts.serializeProject).toHaveBeenCalledTimes(1);
    const callArgs = (opts.serializeProject as ReturnType<typeof vi.fn>).mock
      .calls[0];
    // First arg: pixelsPerMeter
    expect(callArgs[0]).toBe(75);
    // Second arg: backgroundImageData
    expect(callArgs[1]).toBe("data:image/test");
    // Third arg: objects array
    expect(callArgs[2]).toHaveLength(1);
    expect(callArgs[2][0].name).toBe("S");
  });

  it('sets status message to "Saved to browser storage" on success', async () => {
    const opts = makeOptions();
    scheduleAutoSave(opts);

    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);

    expect(usePlannerStore.getState().statusMessage).toBe(
      "Saved to browser storage",
    );
  });

  it('sets status message to "Auto-save failed" on error', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const opts = makeOptions({
      saveToIDB: vi.fn().mockRejectedValue(new Error("IDB write failed")),
    });
    scheduleAutoSave(opts);

    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);

    expect(usePlannerStore.getState().statusMessage).toBe("Auto-save failed");
    consoleErrorSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// handleBeforeUnload
// ---------------------------------------------------------------------------
describe("handleBeforeUnload", () => {
  it("calls serializeProject and saveToIDB with current state", () => {
    usePlannerStore.getState().setPixelsPerMeter(100);
    usePlannerStore.getState().setBackgroundImageData("data:bg");
    usePlannerStore
      .getState()
      .addObject({
        id: 0,
        type: "shape",
        name: "S",
        widthM: 2,
        heightM: 3,
        color: "r",
      });

    const getFabricState = vi.fn().mockReturnValue(null);
    const serializeProject = vi.fn().mockReturnValue(makeMockProject());
    const saveToIDB = vi.fn().mockResolvedValue(undefined);

    handleBeforeUnload(getFabricState, serializeProject, saveToIDB);

    expect(serializeProject).toHaveBeenCalledTimes(1);
    const callArgs = serializeProject.mock.calls[0];
    expect(callArgs[0]).toBe(100);
    expect(callArgs[1]).toBe("data:bg");
    expect(callArgs[2]).toHaveLength(1);

    expect(saveToIDB).toHaveBeenCalledTimes(1);
  });

  it("does not call save when autoSaveEnabled is false", () => {
    usePlannerStore.getState().setAutoSaveEnabled(false);

    const getFabricState = vi.fn();
    const serializeProject = vi.fn();
    const saveToIDB = vi.fn();

    handleBeforeUnload(getFabricState, serializeProject, saveToIDB);

    expect(serializeProject).not.toHaveBeenCalled();
    expect(saveToIDB).not.toHaveBeenCalled();
  });

  it("does not throw when saveToIDB rejects", () => {
    const getFabricState = vi.fn().mockReturnValue(null);
    const serializeProject = vi.fn().mockReturnValue(makeMockProject());
    const saveToIDB = vi.fn().mockRejectedValue(new Error("fail"));

    // Should not throw — the rejection is caught internally
    expect(() =>
      handleBeforeUnload(getFabricState, serializeProject, saveToIDB),
    ).not.toThrow();
  });

  it("passes getFabricState through to serializeProject", () => {
    const getFabricState = vi
      .fn()
      .mockReturnValue({ left: 10, top: 20, scaleX: 1, scaleY: 1, angle: 0 });
    const serializeProject = vi.fn().mockReturnValue(makeMockProject());
    const saveToIDB = vi.fn().mockResolvedValue(undefined);

    handleBeforeUnload(getFabricState, serializeProject, saveToIDB);

    // The fourth argument to serializeProject should be the getFabricState function
    const callArgs = serializeProject.mock.calls[0];
    expect(callArgs[3]).toBe(getFabricState);
  });
});
