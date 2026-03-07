"use client";

import { useEffect, useRef, useImperativeHandle, useCallback } from "react";
import { useFabricCanvas } from "./hooks/useFabricCanvas";
import { usePanZoom } from "./hooks/usePanZoom";
import { useCalibration } from "./hooks/useCalibration";
import { useShapes } from "./hooks/useShapes";
import { useLines } from "./hooks/useLines";
import { useImages } from "./hooks/useImages";
import { useCleanup } from "./hooks/useCleanup";
import { useCanvasEvents } from "./hooks/useCanvasEvents";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useHistory } from "./hooks/useHistory";
import { usePlannerStore } from "@/lib/store";
import type {
  ShapeFabricRefs,
  LineFabricRefs,
  MaskFabricRefs,
  ImageFabricRefs,
  SerializedObject,
  HistorySnapshot,
  PlannerObject,
  Camera,
  LayerGroup,
  LayerEntry,
} from "@/lib/types";
import { cameraToFabricViewport } from "@/components/canvas/utils/coordinates";
import type { TMat2D } from "fabric";
import {
  serializeProject,
  deserializeProject,
  serializeObject,
  validateProjectData,
} from "@/components/canvas/utils/serialization";
import { getFabricProp } from "@/components/canvas/utils/fabricHelpers";
import {
  saveProject as saveToIDB,
  loadProject as loadFromIDB,
  clearProject as clearIDB,
} from "@/lib/storage/indexeddb";
import {
  downloadProjectAsJson,
  importProjectFromFile,
} from "@/lib/storage/json-export";
import {
  getFabricState as getFabricStateUtil,
  clearCanvas as clearCanvasUtil,
  reorderObjects as reorderObjectsUtil,
  deleteObject as deleteObjectUtil,
  loadProjectFromData as loadProjectFromDataUtil,
} from "./utils/canvasOrchestration";
import {
  scheduleAutoSave,
  cancelAutoSave,
  handleBeforeUnload,
} from "./utils/autoSave";

export interface PlannerCanvasHandle {
  // Calibration
  startCalibration: () => void;
  cancelCalibration: () => void;
  applyCalibration: (meters: number) => void;
  // Shapes
  addShape: (name: string, widthM: number, heightM: number) => void;
  // Lines
  startLineDrawing: () => void;
  cancelLineDrawing: () => void;
  // Images
  loadBackgroundImage: (file: File) => void;
  addOverlayImage: (file: File) => void;
  // Cleanup
  enterCleanupMode: () => void;
  exitCleanupMode: () => void;
  startDrawingMask: () => void;
  addCleanupImage: (file: File) => void;
  // Objects
  selectObject: (id: number) => void;
  deleteObject: (id: number) => void;
  deleteSelected: () => void;
  clearAll: () => void;
  moveObjectUp: (id: number) => void;
  moveObjectDown: (id: number) => void;
  selectedObjectId: () => number | null;
  // Storage
  save: () => Promise<void>;
  load: () => Promise<void>;
  loadFromSerializedData: (
    serializedObjects: SerializedObject[],
    camera?: Camera,
    layers?: Record<LayerGroup, LayerEntry[]>,
  ) => Promise<void>;
  clearStorage: () => Promise<void>;
  exportJson: () => void;
  importJson: (file: File) => Promise<void>;
  toggleAutoSave: () => void;
  cancelPendingAutoSave: () => void;
  setLoadingProject: (loading: boolean) => void;
  // Reorder
  reorderObjects: () => void;
  // History
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

// Union type for all fabric refs
type AnyFabricRefs =
  | ShapeFabricRefs
  | LineFabricRefs
  | MaskFabricRefs
  | ImageFabricRefs;

/** Get the primary selectable Fabric object from any refs variant */
function primaryObject(refs: AnyFabricRefs) {
  switch (refs.type) {
    case "shape":
    case "mask":
      return refs.rect;
    case "line":
      return refs.line;
    case "image":
      return refs.image;
  }
}

export function PlannerCanvas({
  ref,
}: {
  ref?: React.Ref<PlannerCanvasHandle>;
}) {
  const { canvasElRef, containerRef, fabricCanvasRef, initCanvas } =
    useFabricCanvas();

  // Single shared Map for all fabric refs, cast as needed by hooks
  const allFabricRefsRef = useRef(new Map<number, AnyFabricRefs>());

  // Initialize canvas on mount
  useEffect(() => {
    initCanvas();
  }, [initCanvas]);

  // Hooks (pass fabricCanvasRef + fabricRefsRef)
  const panZoom = usePanZoom(fabricCanvasRef);
  const calibration = useCalibration(fabricCanvasRef);
  const shapes = useShapes(
    fabricCanvasRef,
    allFabricRefsRef as React.RefObject<Map<number, ShapeFabricRefs>>,
  );
  const lines = useLines(
    fabricCanvasRef,
    allFabricRefsRef as React.RefObject<Map<number, LineFabricRefs>>,
  );
  const images = useImages(
    fabricCanvasRef,
    allFabricRefsRef as React.RefObject<Map<number, ImageFabricRefs>>,
  );
  const cleanup = useCleanup(
    fabricCanvasRef,
    allFabricRefsRef as React.RefObject<
      Map<number, MaskFabricRefs | ImageFabricRefs>
    >,
    allFabricRefsRef,
  );

  // Thin wrappers that bind refs to the extracted pure functions
  const getFabricState = useCallback(
    (id: number) => getFabricStateUtil(id, allFabricRefsRef),
    [],
  );

  const clearCanvas = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    clearCanvasUtil(canvas, allFabricRefsRef);
  }, [fabricCanvasRef]);

  const reorderObjects = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    reorderObjectsUtil(canvas, allFabricRefsRef);
  }, [fabricCanvasRef]);

  const deleteObject = useCallback(
    (id: number) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;
      deleteObjectUtil(id, canvas, allFabricRefsRef);
    },
    [fabricCanvasRef],
  );

  const loadProjectFromData = useCallback(
    async (serializedObjects: SerializedObject[]) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;
      await loadProjectFromDataUtil(
        serializedObjects,
        canvas,
        allFabricRefsRef,
        {
          loadShape: shapes.loadShape,
          loadLine: lines.loadLine,
          loadMask: cleanup.loadMask,
          loadImageObject: images.loadImageObject,
        },
      );
    },
    [fabricCanvasRef, shapes, lines, cleanup, images],
  );

  // ============================================
  // History: restoreFromSnapshot + useHistory hook
  // ============================================

  // Stable ref for HistoryManager — used in restoreFromSnapshot
  const historyManagerRef = useRef<
    import("@/lib/history").HistoryManager | null
  >(null);

  const restoreFromSnapshot = useCallback(
    async (snapshot: HistorySnapshot) => {
      clearCanvas();

      const manager = historyManagerRef.current;
      const ss = snapshot.storeSnapshot;

      // Restore store objects — resolve image refs back to data
      const objects: PlannerObject[] = [];
      for (const obj of ss.objects) {
        const oAny = obj as unknown as Record<string, unknown>;
        if (
          (oAny.type === "overlayImage" || oAny.type === "backgroundImage") &&
          typeof oAny.imageDataRef === "string" &&
          manager
        ) {
          const imageData = await manager.resolveImage(
            oAny.imageDataRef as string,
          );
          const restored = { ...obj, imageData } as PlannerObject;
          // Remove the ref field
          delete (restored as unknown as Record<string, unknown>).imageDataRef;
          objects.push(restored);
        } else {
          objects.push({ ...obj });
        }
      }

      // Set calibration — hook loaders will re-add objects via addObject()
      usePlannerStore.getState().setPixelsPerMeter(ss.pixelsPerMeter);

      // Restore camera and Fabric viewport if present in snapshot
      if (ss.camera) {
        usePlannerStore.getState().setCamera(ss.camera);
        const vpt = cameraToFabricViewport(ss.camera) as TMat2D;
        fabricCanvasRef.current?.setViewportTransform(vpt);
      }

      // Reconstruct Fabric objects from snapshots
      const serializedObjects: SerializedObject[] = [];
      for (const fs of snapshot.fabricSnapshots) {
        const storeObj = objects.find((o) => o.id === fs.id);
        if (storeObj) {
          serializedObjects.push(
            serializeObject(
              storeObj,
              fs.fabricState as {
                left: number;
                top: number;
                scaleX: number;
                scaleY: number;
                angle: number;
                width?: number;
                height?: number;
                baseWidthPx?: number;
                baseHeightPx?: number;
                x1?: number;
                y1?: number;
                x2?: number;
                y2?: number;
                strokeWidth?: number;
                originX?: string;
                originY?: string;
              },
            ),
          );
        }
      }

      await loadProjectFromData(serializedObjects);

      // Restore saved layer ordering from snapshot
      if (ss.layers) {
        usePlannerStore.setState({ layers: ss.layers });
        reorderObjects();
      }
    },
    [clearCanvas, loadProjectFromData, reorderObjects],
  );

  const history = useHistory({
    getFabricState,
    restoreFromSnapshot,
  });
  const { captureSnapshot, undo, redo, resetHistory, isRestoringRef } = history;

  // Keep the manager ref in sync for restoreFromSnapshot to use
  useEffect(() => {
    historyManagerRef.current = history.managerRef.current;
  });

  // ============================================
  // Auto-save (extracted to autoSave.ts)
  // ============================================
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoadingProjectRef = useRef(false);

  // Cancel auto-save timer on unmount
  useEffect(() => () => cancelAutoSave(autoSaveTimerRef), []);

  const triggerAutoSave = useCallback(() => {
    scheduleAutoSave({
      isRestoring: isRestoringRef.current,
      timerRef: autoSaveTimerRef,
      getFabricState,
      serializeProject,
      saveToIDB,
      isLoadingProjectRef,
    });
  }, [getFabricState, isRestoringRef]);

  // beforeunload — best-effort save on page close
  useEffect(() => {
    const handler = () =>
      handleBeforeUnload(getFabricState, serializeProject, saveToIDB);
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [getFabricState]);

  // ============================================
  // Object management
  // ============================================
  const deleteSelected = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObjects();
    for (const fo of active) {
      const objType = getFabricProp(fo, "objectType");
      if (objType === "background" || objType === "backgroundImage") continue;
      const id = getFabricProp(fo, "objectId");
      if (id != null) {
        deleteObject(id as number);
      }
    }
    canvas.discardActiveObject();
    canvas.renderAll();
    captureSnapshot();
    triggerAutoSave();
  }, [fabricCanvasRef, deleteObject, captureSnapshot, triggerAutoSave]);

  const clearAll = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const store = usePlannerStore.getState();
    const toRemove: number[] = [];
    for (const [id, obj] of store.objects) {
      if (
        obj.type === "shape" ||
        obj.type === "overlayImage" ||
        obj.type === "line"
      ) {
        toRemove.push(id);
      }
    }
    for (const id of toRemove) {
      deleteObject(id);
    }
    canvas.renderAll();
    captureSnapshot();
    triggerAutoSave();
  }, [fabricCanvasRef, deleteObject, captureSnapshot, triggerAutoSave]);

  const selectObject = useCallback(
    (id: number) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;
      const refs = allFabricRefsRef.current.get(id);
      if (refs) {
        canvas.setActiveObject(primaryObject(refs));
        canvas.renderAll();
      }
    },
    [fabricCanvasRef],
  );

  const moveObjectUp = useCallback(
    (id: number) => {
      usePlannerStore.getState().moveUpInLayer(id);
      reorderObjects();
      captureSnapshot();
      triggerAutoSave();
    },
    [reorderObjects, captureSnapshot, triggerAutoSave],
  );

  const moveObjectDown = useCallback(
    (id: number) => {
      usePlannerStore.getState().moveDownInLayer(id);
      reorderObjects();
      captureSnapshot();
      triggerAutoSave();
    },
    [reorderObjects, captureSnapshot, triggerAutoSave],
  );

  // ============================================
  // Storage operations
  // ============================================
  const save = useCallback(async () => {
    const s = usePlannerStore.getState();
    const objects = Array.from(s.objects.values());
    const data = serializeProject(
      s.pixelsPerMeter,
      objects,
      getFabricState,
      s.camera,
      s.layers,
    );
    await saveToIDB(data);
    // Also save to per-project record if active
    if (s.activeProjectId) {
      const { saveCurrentProject } = await import("@/lib/projectOperations");
      const { getDefaultAdapter } = await import("@/lib/storage/indexeddb");
      await saveCurrentProject(getDefaultAdapter(), data);
    }
    s.setStatusMessage("Saved to browser storage");
  }, [getFabricState]);

  const load = useCallback(async () => {
    const data = await loadFromIDB();
    if (!data) {
      usePlannerStore.getState().setStatusMessage("No saved project found");
      return;
    }

    // Validate and deserialize BEFORE clearing canvas
    if (!validateProjectData(data)) {
      usePlannerStore
        .getState()
        .setStatusMessage("Saved project data is invalid");
      console.error("Invalid project data in storage:", data);
      return;
    }

    let deserialized;
    try {
      deserialized = deserializeProject(data);
    } catch (err) {
      usePlannerStore
        .getState()
        .setStatusMessage("Failed to parse saved project");
      console.error("Deserialization error:", err);
      return;
    }

    // Safe to clear now — data is validated
    try {
      clearCanvas();
      usePlannerStore.getState().setPixelsPerMeter(deserialized.pixelsPerMeter);

      // Restore camera and Fabric viewport if saved
      if (deserialized.camera) {
        usePlannerStore.getState().setCamera(deserialized.camera);
        const vpt = cameraToFabricViewport(deserialized.camera) as TMat2D;
        fabricCanvasRef.current?.setViewportTransform(vpt);
      }

      await loadProjectFromData(deserialized.serializedObjects);

      // Restore saved layer ordering (overrides addObject defaults)
      if (deserialized.layers) {
        usePlannerStore.setState({ layers: deserialized.layers });
        reorderObjects();
      }
      usePlannerStore
        .getState()
        .setStatusMessage("Loaded from browser storage");
      // Reset history and capture initial state after load
      await resetHistory();
      captureSnapshot();
    } catch (err) {
      usePlannerStore
        .getState()
        .setStatusMessage("Failed to load project onto canvas");
      console.error("Load error:", err);
    }
  }, [
    clearCanvas,
    loadProjectFromData,
    reorderObjects,
    resetHistory,
    captureSnapshot,
  ]);

  const loadFromSerializedData = useCallback(
    async (
      serializedObjects: SerializedObject[],
      camera?: Camera,
      layers?: Record<LayerGroup, LayerEntry[]>,
    ) => {
      try {
        clearCanvas();
        const store = usePlannerStore.getState();

        if (camera) {
          store.setCamera(camera);
          const vpt = cameraToFabricViewport(camera) as TMat2D;
          fabricCanvasRef.current?.setViewportTransform(vpt);
        }

        await loadProjectFromData(serializedObjects);

        if (layers) {
          usePlannerStore.setState({ layers });
          reorderObjects();
        }

        store.setStatusMessage("Project loaded");
        await resetHistory();
        captureSnapshot();
      } catch (err) {
        usePlannerStore
          .getState()
          .setStatusMessage("Failed to load project onto canvas");
        console.error("Load error:", err);
      }
    },
    [
      fabricCanvasRef,
      clearCanvas,
      loadProjectFromData,
      reorderObjects,
      resetHistory,
      captureSnapshot,
    ],
  );

  const clearStorage = useCallback(async () => {
    await clearIDB();
    usePlannerStore.getState().setStatusMessage("Browser storage cleared");
  }, []);

  const exportJson = useCallback(() => {
    const s = usePlannerStore.getState();
    const objects = Array.from(s.objects.values());
    const data = serializeProject(
      s.pixelsPerMeter,
      objects,
      getFabricState,
      s.camera,
      s.layers,
    );
    downloadProjectAsJson(data);
    s.setStatusMessage("Project exported successfully");
  }, [getFabricState]);

  const importJson = useCallback(
    async (file: File) => {
      // Parse and validate file BEFORE clearing canvas
      let data;
      try {
        data = await importProjectFromFile(file);
      } catch (err) {
        usePlannerStore
          .getState()
          .setStatusMessage("Failed to read import file");
        console.error("Import file error:", err);
        throw err;
      }

      if (!validateProjectData(data)) {
        usePlannerStore
          .getState()
          .setStatusMessage("Import file contains invalid project data");
        console.error("Invalid imported project data:", data);
        throw new Error("Import file contains invalid project data");
      }

      let deserialized;
      try {
        deserialized = deserializeProject(data);
      } catch (err) {
        usePlannerStore
          .getState()
          .setStatusMessage("Failed to parse imported project");
        console.error("Import deserialization error:", err);
        throw err;
      }

      // Safe to clear now — data is validated
      try {
        clearCanvas();
        usePlannerStore
          .getState()
          .setPixelsPerMeter(deserialized.pixelsPerMeter);

        // Restore camera and Fabric viewport if present in imported data
        if (deserialized.camera) {
          usePlannerStore.getState().setCamera(deserialized.camera);
          const vpt = cameraToFabricViewport(deserialized.camera) as TMat2D;
          fabricCanvasRef.current?.setViewportTransform(vpt);
        }

        await loadProjectFromData(deserialized.serializedObjects);

        // Restore saved layer ordering (overrides addObject defaults)
        if (deserialized.layers) {
          usePlannerStore.setState({ layers: deserialized.layers });
          reorderObjects();
        }
        usePlannerStore.getState().setStatusMessage("Project imported");
        // Reset history and capture initial state after import
        await resetHistory();
        captureSnapshot();
      } catch (err) {
        usePlannerStore
          .getState()
          .setStatusMessage("Failed to import project onto canvas");
        console.error("Import load error:", err);
        throw err;
      }
    },
    [
      clearCanvas,
      loadProjectFromData,
      reorderObjects,
      resetHistory,
      captureSnapshot,
    ],
  );

  const toggleAutoSave = useCallback(() => {
    const store = usePlannerStore.getState();
    const next = !store.autoSaveEnabled;
    store.setAutoSaveEnabled(next);
    if (next) {
      triggerAutoSave();
    }
  }, [triggerAutoSave]);

  const getSelectedObjectId = useCallback((): number | null => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return null;
    const active = canvas.getActiveObject();
    if (!active) return null;
    return (getFabricProp(active, "objectId") as number) ?? null;
  }, [fabricCanvasRef]);

  // ============================================
  // Canvas event handlers — with history capture
  // ============================================

  // Wrapping callbacks that need captureSnapshot after they fire
  const handleObjectModifiedWithHistory = useCallback(() => {
    if (!isRestoringRef.current) {
      captureSnapshot();
      triggerAutoSave();
    }
  }, [captureSnapshot, triggerAutoSave, isRestoringRef]);

  // Canvas events
  useCanvasEvents(fabricCanvasRef, {
    handleCalibrationClick: calibration.handleCalibrationClick,
    updateCalibrationLine: calibration.updateCalibrationLine,
    finishCalibrationLine: calibration.finishCalibrationLine,
    startPointRef: calibration.startPointRef,
    handleLineDrawStart: lines.handleLineDrawStart,
    updateDrawingLine: lines.updateDrawingLine,
    finishDrawingLine: useCallback(() => {
      lines.finishDrawingLine();
      captureSnapshot();
      triggerAutoSave();
    }, [lines, captureSnapshot, triggerAutoSave]),
    lineStartRef: lines.lineStartRef,
    handleMaskDrawStart: cleanup.handleMaskDrawStart,
    updateMaskRect: cleanup.updateMaskRect,
    finishMaskRect: useCallback(() => {
      cleanup.finishMaskRect();
      captureSnapshot();
      triggerAutoSave();
    }, [cleanup, captureSnapshot, triggerAutoSave]),
    updateShapeDimensions: shapes.updateShapeDimensions,
    startPan: panZoom.startPan,
    movePan: panZoom.movePan,
    endPan: panZoom.endPan,
    isPanningRef: panZoom.isPanningRef,
    deleteSelected,
    reorderObjects,
    triggerAutoSave: handleObjectModifiedWithHistory,
  });

  // Keyboard shortcuts
  useKeyboardShortcuts(fabricCanvasRef, {
    cancelCalibration: calibration.cancelCalibration,
    cancelLineDrawing: lines.cancelLineDrawing,
    cancelMaskDrawing: cleanup.cancelDrawingMask,
    deleteSelected,
    undo,
    redo,
  });

  // ============================================
  // Wrapped actions that capture history
  // ============================================
  const addShapeWithHistory = useCallback(
    (name: string, widthM: number, heightM: number) => {
      shapes.addShape(name, widthM, heightM);
      captureSnapshot();
      triggerAutoSave();
    },
    [shapes, captureSnapshot, triggerAutoSave],
  );

  const applyCalibrationWithHistory = useCallback(
    (meters: number) => {
      calibration.applyCalibration(meters);
      captureSnapshot();
      triggerAutoSave();
    },
    [calibration, captureSnapshot, triggerAutoSave],
  );

  const loadBackgroundImageWithHistory = useCallback(
    (file: File) => {
      images.loadBackgroundImage(file);
      // Background image loads async — capture on next tick
      setTimeout(() => {
        captureSnapshot();
        triggerAutoSave();
      }, 500);
    },
    [images, captureSnapshot, triggerAutoSave],
  );

  const addOverlayImageWithHistory = useCallback(
    (file: File) => {
      images.addOverlayImage(file);
      setTimeout(() => {
        captureSnapshot();
        triggerAutoSave();
      }, 500);
    },
    [images, captureSnapshot, triggerAutoSave],
  );

  const addCleanupImageWithHistory = useCallback(
    (file: File) => {
      cleanup.addCleanupImage(file);
      setTimeout(() => {
        captureSnapshot();
        triggerAutoSave();
      }, 500);
    },
    [cleanup, captureSnapshot, triggerAutoSave],
  );

  const deleteObjectWithHistory = useCallback(
    (id: number) => {
      deleteObject(id);
      captureSnapshot();
      triggerAutoSave();
    },
    [deleteObject, captureSnapshot, triggerAutoSave],
  );

  // Expose imperative handle
  useImperativeHandle(ref, () => ({
    startCalibration: calibration.startCalibration,
    cancelCalibration: calibration.cancelCalibration,
    applyCalibration: applyCalibrationWithHistory,
    addShape: addShapeWithHistory,
    startLineDrawing: lines.startLineDrawing,
    cancelLineDrawing: lines.cancelLineDrawing,
    loadBackgroundImage: loadBackgroundImageWithHistory,
    addOverlayImage: addOverlayImageWithHistory,
    enterCleanupMode: cleanup.enterCleanupMode,
    exitCleanupMode: cleanup.exitCleanupMode,
    startDrawingMask: cleanup.startDrawingMask,
    addCleanupImage: addCleanupImageWithHistory,
    selectObject,
    deleteObject: deleteObjectWithHistory,
    deleteSelected,
    clearAll,
    moveObjectUp,
    moveObjectDown,
    selectedObjectId: getSelectedObjectId,
    save,
    load,
    loadFromSerializedData,
    clearStorage,
    exportJson,
    importJson,
    toggleAutoSave,
    cancelPendingAutoSave: () => cancelAutoSave(autoSaveTimerRef),
    setLoadingProject: (loading: boolean) => {
      isLoadingProjectRef.current = loading;
    },
    reorderObjects,
    undo,
    redo,
  }));

  return (
    <div ref={containerRef} className="flex-1 relative overflow-hidden">
      <canvas ref={canvasElRef} aria-label="Floor plan design canvas" />
    </div>
  );
}
