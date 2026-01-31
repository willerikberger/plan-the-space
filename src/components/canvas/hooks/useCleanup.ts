/**
 * @module useCleanup
 * @description Manages cleanup mode for drawing mask rectangles and adding background images.
 * Toggles visibility of normal objects so only masks and background images are shown and editable.
 * @dependencies fabric (FabricImage), fabricHelpers (createMaskRect, getFabricProp, setFabricProps), geometry (overlayImageScale), store, constants (MIN_MASK_SIZE_PX), types (MaskFabricRefs, ImageFabricRefs)
 * @usage Called from PlannerCanvas; enter/exit cleanup and mask-drawing callbacks are exposed via the imperative handle and routed through useCanvasEvents.
 */
"use client";

import { useRef, useCallback } from "react";
import { FabricImage } from "fabric";
import type { Canvas, Rect } from "fabric";
import { usePlannerStore } from "@/lib/store";
import {
  createMaskRect,
  getFabricProp,
  setFabricProps,
} from "@/components/canvas/utils/fabricHelpers";
import { overlayImageScale } from "@/components/canvas/utils/geometry";
import { MIN_MASK_SIZE_PX } from "@/lib/constants";
import type { Point, MaskFabricRefs, ImageFabricRefs } from "@/lib/types";

export function useCleanup(
  fabricCanvasRef: React.RefObject<Canvas | null>,
  fabricRefsRef: React.RefObject<Map<number, MaskFabricRefs | ImageFabricRefs>>,
) {
  const maskStartRef = useRef<Point | null>(null);
  const currentMaskRef = useRef<Rect | null>(null);

  const enterCleanupMode = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const store = usePlannerStore.getState();
    store.setMode("cleanup");
    store.setStatusMessage("Cleanup mode: Draw masks or add background images");

    // Hide normal objects, show masks/bg images
    for (const obj of store.objects.values()) {
      for (const fo of canvas.getObjects()) {
        if (getFabricProp(fo, "objectId") === obj.id) {
          if (obj.type !== "mask" && obj.type !== "backgroundImage") {
            fo.set("visible", false);
          } else {
            fo.set({ visible: true, selectable: true, evented: true });
          }
        }
        // Also hide labels/dims
        const parentId = getFabricProp(fo, "parentId");
        if (parentId != null) {
          const parent = store.objects.get(parentId);
          if (
            parent &&
            parent.type !== "mask" &&
            parent.type !== "backgroundImage"
          ) {
            fo.set("visible", false);
          }
        }
      }
    }
    canvas.renderAll();
  }, [fabricCanvasRef]);

  const exitCleanupMode = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const store = usePlannerStore.getState();
    store.setMode("normal");
    store.setStatusMessage("Back to normal mode");
    canvas.defaultCursor = "default";

    // Show all objects, lock masks/bg images
    for (const fo of canvas.getObjects()) {
      fo.set("visible", true);
      const objectType = getFabricProp(fo, "objectType");
      if (objectType === "mask" || objectType === "backgroundImage") {
        fo.set({ selectable: false, evented: false });
      }
    }
    canvas.renderAll();
  }, [fabricCanvasRef]);

  const startDrawingMask = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    usePlannerStore.getState().setMode("drawing-mask");
    canvas.defaultCursor = "crosshair";
    canvas.selection = false;
    usePlannerStore
      .getState()
      .setStatusMessage("Click and drag to draw a mask rectangle");
  }, [fabricCanvasRef]);

  const handleMaskDrawStart = useCallback(
    (pointer: Point) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;
      maskStartRef.current = { x: pointer.x, y: pointer.y };

      const rect = createMaskRect({
        left: pointer.x,
        top: pointer.y,
        width: 0,
        height: 0,
        showStroke: true,
      });

      currentMaskRef.current = rect;
      canvas.add(rect);
    },
    [fabricCanvasRef],
  );

  const updateMaskRect = useCallback(
    (pointer: Point) => {
      const canvas = fabricCanvasRef.current;
      const mask = currentMaskRef.current;
      const start = maskStartRef.current;
      if (!canvas || !mask || !start) return;

      const left = Math.min(start.x, pointer.x);
      const top = Math.min(start.y, pointer.y);
      const width = Math.abs(pointer.x - start.x);
      const height = Math.abs(pointer.y - start.y);

      mask.set({ left, top, width, height });
      canvas.renderAll();
    },
    [fabricCanvasRef],
  );

  const finishMaskRect = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    const mask = currentMaskRef.current;
    if (!canvas || !mask) return;

    if (mask.width! < MIN_MASK_SIZE_PX || mask.height! < MIN_MASK_SIZE_PX) {
      canvas.remove(mask);
      currentMaskRef.current = null;
      maskStartRef.current = null;
      usePlannerStore.getState().setMode("cleanup");
      usePlannerStore.getState().setStatusMessage("Mask too small, cancelled");
      canvas.defaultCursor = "default";
      canvas.selection = true;
      return;
    }

    // Finalize: remove stroke, make selectable
    mask.set({
      stroke: undefined,
      strokeDashArray: undefined,
      strokeWidth: 0,
      selectable: true,
      evented: true,
    });

    const store = usePlannerStore.getState();
    const id = store.nextObjectId();
    setFabricProps(mask, { objectId: id, objectType: "mask" });

    fabricRefsRef.current.set(id, { rect: mask });

    store.addObject({ id, type: "mask", name: `Mask ${id + 1}` });

    currentMaskRef.current = null;
    maskStartRef.current = null;
    store.setMode("cleanup");
    store.setStatusMessage("Added mask");
    canvas.defaultCursor = "default";
    canvas.selection = true;
  }, [fabricCanvasRef, fabricRefsRef]);

  const addCleanupImage = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;
        const dataUrl = e.target?.result as string;

        const img = await FabricImage.fromURL(dataUrl);
        const scale = overlayImageScale(
          img.width!,
          img.height!,
          canvas.getWidth(),
          canvas.getHeight(),
        );

        img.set({
          scaleX: scale,
          scaleY: scale,
          left: canvas.getWidth() / 2,
          top: canvas.getHeight() / 2,
          originX: "center",
          originY: "center",
          selectable: true,
          evented: true,
        });

        const store = usePlannerStore.getState();
        const id = store.nextObjectId();
        setFabricProps(img, {
          objectId: id,
          objectType: "backgroundImage",
          imageData: dataUrl,
        });

        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();

        fabricRefsRef.current.set(id, { image: img });

        store.addObject({
          id,
          type: "backgroundImage",
          name: `BG Image ${id + 1}`,
          imageData: dataUrl,
        });

        store.setStatusMessage("Added background image");
      };
      reader.readAsDataURL(file);
    },
    [fabricCanvasRef, fabricRefsRef],
  );

  const loadMask = useCallback(
    (data: {
      left: number;
      top: number;
      width: number;
      height: number;
      scaleX?: number;
      scaleY?: number;
      angle?: number;
      name: string;
    }) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;
      const store = usePlannerStore.getState();
      const id = store.nextObjectId();

      const rect = createMaskRect({
        left: data.left,
        top: data.top,
        width: data.width,
        height: data.height,
        scaleX: data.scaleX,
        scaleY: data.scaleY,
        angle: data.angle,
        objectId: id,
      });

      canvas.add(rect);
      fabricRefsRef.current.set(id, { rect });

      store.addObject({ id, type: "mask", name: data.name });
    },
    [fabricCanvasRef, fabricRefsRef],
  );

  return {
    enterCleanupMode,
    exitCleanupMode,
    startDrawingMask,
    handleMaskDrawStart,
    updateMaskRect,
    finishMaskRect,
    addCleanupImage,
    loadMask,
  };
}
