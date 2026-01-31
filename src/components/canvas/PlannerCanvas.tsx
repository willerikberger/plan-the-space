"use client";

import {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from "react";
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
} from "@/lib/types";
import {
  serializeProject,
  deserializeProject,
  serializeObject,
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
import { scheduleAutoSave, handleBeforeUnload } from "./utils/autoSave";

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
  clearStorage: () => Promise<void>;
  exportJson: () => void;
  importJson: (file: File) => Promise<void>;
  toggleAutoSave: () => void;
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

export const PlannerCanvas = forwardRef<PlannerCanvasHandle>(
  function PlannerCanvas(_, ref) {
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
    );

    // Thin wrappers that bind refs to the extracted pure functions
    const getFabricState = useCallback(
      (id: number) => getFabricStateUtil(id, allFabricRefsRef),
      [],
    );

    const clearCanvas = useCallback(() => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;
      clearCanvasUtil(canvas, allFabricRefsRef, images.backgroundRef);
    }, [fabricCanvasRef, images.backgroundRef]);

    const reorderObjects = useCallback(() => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;
      reorderObjectsUtil(canvas, allFabricRefsRef, images.backgroundRef);
    }, [fabricCanvasRef, images.backgroundRef]);

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
          images.backgroundRef,
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

        // Resolve background image
        let backgroundImageData: string | null = null;
        if (ss.backgroundImageRef && manager) {
          backgroundImageData = await manager.resolveImage(
            ss.backgroundImageRef,
          );
        }

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
            delete (restored as unknown as Record<string, unknown>)
              .imageDataRef;
            objects.push(restored);
          } else {
            objects.push({ ...obj });
          }
        }

        // Load into store
        usePlannerStore.getState().loadProject({
          pixelsPerMeter: ss.pixelsPerMeter,
          backgroundImageData,
          objects,
        });

        // Reconstruct Fabric objects from snapshots
        // Build SerializedObject[] from fabricSnapshots + store objects
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

        if (backgroundImageData) {
          usePlannerStore
            .getState()
            .setBackgroundImageData(backgroundImageData);
          await images.loadBackgroundFromData(backgroundImageData, () => {
            loadProjectFromData(serializedObjects);
          });
        } else {
          await loadProjectFromData(serializedObjects);
        }
      },
      [clearCanvas, images, loadProjectFromData],
    );

    const history = useHistory({
      getFabricState,
      restoreFromSnapshot,
    });
    const { captureSnapshot, undo, redo, resetHistory, isRestoringRef } =
      history;

    // Keep the manager ref in sync for restoreFromSnapshot to use
    useEffect(() => {
      historyManagerRef.current = history.managerRef.current;
    });

    // ============================================
    // Auto-save (extracted to autoSave.ts)
    // ============================================
    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const triggerAutoSave = useCallback(() => {
      scheduleAutoSave({
        isRestoring: isRestoringRef.current,
        timerRef: autoSaveTimerRef,
        getFabricState,
        serializeProject,
        saveToIDB,
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
        if (getFabricProp(fo, "objectType") === "background") continue;
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
          const obj =
            "rect" in refs
              ? refs.rect
              : "line" in refs
                ? refs.line
                : "image" in refs
                  ? refs.image
                  : null;
          if (obj) {
            canvas.setActiveObject(obj);
            canvas.renderAll();
          }
        }
      },
      [fabricCanvasRef],
    );

    const moveObjectUp = useCallback(
      (id: number) => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;
        const refs = allFabricRefsRef.current.get(id);
        if (!refs) return;
        const obj =
          "rect" in refs
            ? refs.rect
            : "line" in refs
              ? refs.line
              : "image" in refs
                ? refs.image
                : null;
        if (!obj) return;
        const objects = canvas.getObjects();
        const currentIdx = objects.indexOf(obj);
        if (currentIdx < objects.length - 1) {
          canvas.moveObjectTo(obj, currentIdx + 1);
          canvas.renderAll();
          captureSnapshot();
          triggerAutoSave();
        }
      },
      [fabricCanvasRef, captureSnapshot, triggerAutoSave],
    );

    const moveObjectDown = useCallback(
      (id: number) => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;
        const refs = allFabricRefsRef.current.get(id);
        if (!refs) return;
        const obj =
          "rect" in refs
            ? refs.rect
            : "line" in refs
              ? refs.line
              : "image" in refs
                ? refs.image
                : null;
        if (!obj) return;
        const objects = canvas.getObjects();
        const currentIdx = objects.indexOf(obj);
        const store = usePlannerStore.getState();
        const minIdx =
          Array.from(store.objects.values()).filter(
            (o) => o.type === "mask" || o.type === "backgroundImage",
          ).length + (images.backgroundRef.current ? 1 : 0);
        if (currentIdx > minIdx) {
          canvas.moveObjectTo(obj, currentIdx - 1);
          canvas.renderAll();
          captureSnapshot();
          triggerAutoSave();
        }
      },
      [fabricCanvasRef, images.backgroundRef, captureSnapshot, triggerAutoSave],
    );

    // ============================================
    // Storage operations
    // ============================================
    const save = useCallback(async () => {
      const s = usePlannerStore.getState();
      const objects = Array.from(s.objects.values());
      const data = serializeProject(
        s.pixelsPerMeter,
        s.backgroundImageData,
        objects,
        getFabricState,
      );
      await saveToIDB(data);
      s.setStatusMessage("Saved to browser storage");
    }, [getFabricState]);

    const load = useCallback(async () => {
      const data = await loadFromIDB();
      if (!data) {
        usePlannerStore.getState().setStatusMessage("No saved project found");
        return;
      }
      clearCanvas();

      const deserialized = deserializeProject(data);
      usePlannerStore.getState().setPixelsPerMeter(deserialized.pixelsPerMeter);

      if (deserialized.backgroundImageData) {
        usePlannerStore
          .getState()
          .setBackgroundImageData(deserialized.backgroundImageData);
        await images.loadBackgroundFromData(
          deserialized.backgroundImageData,
          () => {
            loadProjectFromData(deserialized.serializedObjects);
          },
        );
      } else {
        await loadProjectFromData(deserialized.serializedObjects);
      }
      usePlannerStore
        .getState()
        .setStatusMessage("Loaded from browser storage");
      // Reset history and capture initial state after load
      await resetHistory();
      captureSnapshot();
    }, [
      clearCanvas,
      images,
      loadProjectFromData,
      resetHistory,
      captureSnapshot,
    ]);

    const clearStorage = useCallback(async () => {
      await clearIDB();
      usePlannerStore.getState().setStatusMessage("Browser storage cleared");
    }, []);

    const exportJson = useCallback(() => {
      const s = usePlannerStore.getState();
      const objects = Array.from(s.objects.values());
      const data = serializeProject(
        s.pixelsPerMeter,
        s.backgroundImageData,
        objects,
        getFabricState,
      );
      downloadProjectAsJson(data);
      s.setStatusMessage("Project exported successfully");
    }, [getFabricState]);

    const importJson = useCallback(
      async (file: File) => {
        const data = await importProjectFromFile(file);
        clearCanvas();

        const deserialized = deserializeProject(data);
        usePlannerStore
          .getState()
          .setPixelsPerMeter(deserialized.pixelsPerMeter);

        if (deserialized.backgroundImageData) {
          usePlannerStore
            .getState()
            .setBackgroundImageData(deserialized.backgroundImageData);
          await images.loadBackgroundFromData(
            deserialized.backgroundImageData,
            () => {
              loadProjectFromData(deserialized.serializedObjects);
            },
          );
        } else {
          await loadProjectFromData(deserialized.serializedObjects);
        }
        usePlannerStore.getState().setStatusMessage("Project imported");
        // Reset history and capture initial state after import
        await resetHistory();
        captureSnapshot();
      },
      [clearCanvas, images, loadProjectFromData, resetHistory, captureSnapshot],
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
      updateLineLabel: lines.updateLineLabel,
      handleMaskDrawStart: cleanup.handleMaskDrawStart,
      updateMaskRect: cleanup.updateMaskRect,
      finishMaskRect: useCallback(() => {
        cleanup.finishMaskRect();
        captureSnapshot();
        triggerAutoSave();
      }, [cleanup, captureSnapshot, triggerAutoSave]),
      updateShapeLabels: shapes.updateShapeLabels,
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
      clearStorage,
      exportJson,
      importJson,
      toggleAutoSave,
      reorderObjects,
      undo,
      redo,
    }));

    return (
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <canvas ref={canvasElRef} />
      </div>
    );
  },
);
