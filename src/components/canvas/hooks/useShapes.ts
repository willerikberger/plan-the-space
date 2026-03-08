/**
 * @module useShapes
 * @description Manages creation, update, and loading of rectangular shape objects on the Fabric canvas.
 * Syncs MeasuredRect objects with Zustand store metadata and converts between meters and pixels.
 * @dependencies fabricHelpers (createMeasuredRect), geometry (roundToDecimal), store, types (ShapeFabricRefs)
 * @usage Called from PlannerCanvas to provide shape CRUD operations; addShape is exposed via the imperative handle to the sidebar.
 */
"use client";

import { useCallback } from "react";
import type { Canvas } from "fabric";
import type { MeasuredRect } from "@/components/canvas/fabricClasses/MeasuredRect";
import { usePlannerStore } from "@/lib/store";

import {
  createMeasuredRect,
  getFabricProp,
} from "@/components/canvas/utils/fabricHelpers";
import { roundToDecimal } from "@/components/canvas/utils/geometry";
import {
  canvasToWorld,
  worldCenterRectToObjectSpace,
} from "@/components/canvas/utils/coordinates";
import type { ShapeFabricRefs } from "@/lib/types";

export interface UseShapesReturn {
  addShape: (name: string, widthM: number, heightM: number) => void;
  updateShapeDimensions: (rect: MeasuredRect, finalize: boolean) => void;
  loadShape: (data: {
    left: number;
    top: number;
    width?: number;
    height?: number;
    widthM: number;
    heightM: number;
    color: string;
    scaleX?: number;
    scaleY?: number;
    angle?: number;
    baseWidthPx?: number;
    baseHeightPx?: number;
    name: string;
    worldX?: number;
    worldY?: number;
  }) => void;
}

export function useShapes(
  fabricCanvasRef: React.RefObject<Canvas | null>,
  fabricRefsRef: React.RefObject<Map<number, ShapeFabricRefs>>,
): UseShapesReturn {
  const addShape = useCallback(
    (name: string, widthM: number, heightM: number) => {
      const canvas = fabricCanvasRef.current;
      const store = usePlannerStore.getState();
      if (!canvas || !store.pixelsPerMeter) return;

      const widthPx = widthM * store.pixelsPerMeter;
      const heightPx = heightM * store.pixelsPerMeter;
      const id = store.nextObjectId();
      const centerX = canvas.getWidth() / 2;
      const centerY = canvas.getHeight() / 2;
      const color = store.selectedColor;

      const rect = createMeasuredRect({
        left: centerX - widthPx / 2,
        top: centerY - heightPx / 2,
        width: widthPx,
        height: heightPx,
        fill: color,
        stroke: color.replace("0.6", "1"),
        objectId: id,
        shapeName: name,
        shapeWidthM: widthM,
        shapeHeightM: heightM,
        baseWidthPx: widthPx,
        baseHeightPx: heightPx,
      });

      canvas.add(rect);
      canvas.setActiveObject(rect);

      fabricRefsRef.current.set(id, { type: "shape", rect });

      // Compute world coordinates if camera is available
      const camera = store.camera;
      const worldCoords = camera
        ? canvasToWorld(centerX, centerY, camera)
        : undefined;

      store.addObject({
        id,
        type: "shape",
        name,
        widthM,
        heightM,
        color,
        ...(worldCoords
          ? { worldX: worldCoords.x, worldY: worldCoords.y }
          : {}),
      });

      store.setStatusMessage(`Added "${name}" (${widthM}m \u00d7 ${heightM}m)`);
    },
    [fabricCanvasRef, fabricRefsRef],
  );

  const updateShapeDimensions = useCallback(
    (rect: MeasuredRect, finalize: boolean) => {
      const store = usePlannerStore.getState();
      if (!store.pixelsPerMeter) return;

      const scaleX = rect.scaleX ?? 1;
      const scaleY = rect.scaleY ?? 1;
      const baseWidthPx = getFabricProp(rect, "baseWidthPx") ?? rect.width;
      const baseHeightPx = getFabricProp(rect, "baseHeightPx") ?? rect.height;
      const currentWidthPx = baseWidthPx * scaleX;
      const currentHeightPx = baseHeightPx * scaleY;
      const newWidthM = roundToDecimal(
        currentWidthPx / store.pixelsPerMeter,
        1,
      );
      const newHeightM = roundToDecimal(
        currentHeightPx / store.pixelsPerMeter,
        1,
      );

      // Update the self-rendering label directly on the MeasuredRect
      rect.updateDimensions(newWidthM, newHeightM);

      const id = getFabricProp(rect, "objectId");
      if (id == null) return;

      if (finalize) {
        const camera = store.camera;
        const center = rect.getCenterPoint();
        const worldCoords = camera
          ? canvasToWorld(center.x, center.y, camera)
          : undefined;

        store.updateObject(id, {
          widthM: newWidthM,
          heightM: newHeightM,
          ...(worldCoords
            ? { worldX: worldCoords.x, worldY: worldCoords.y }
            : {}),
        } as Partial<{
          widthM: number;
          heightM: number;
          worldX: number;
          worldY: number;
        }>);
      }
    },
    [],
  );

  const loadShape = useCallback(
    (data: {
      left: number;
      top: number;
      width?: number;
      height?: number;
      widthM: number;
      heightM: number;
      color: string;
      scaleX?: number;
      scaleY?: number;
      angle?: number;
      baseWidthPx?: number;
      baseHeightPx?: number;
      name: string;
      worldX?: number;
      worldY?: number;
    }) => {
      const canvas = fabricCanvasRef.current;
      const store = usePlannerStore.getState();
      if (!canvas || !store.pixelsPerMeter) return;

      // If world coords available and camera exists, compute pixel position from world space
      let left = data.left;
      let top = data.top;
      let widthPx = data.width ?? data.widthM * store.pixelsPerMeter;
      let heightPx = data.height ?? data.heightM * store.pixelsPerMeter;

      if (data.width == null && data.worldX != null && data.worldY != null) {
        const objectRect = worldCenterRectToObjectSpace(
          data.worldX,
          data.worldY,
          data.widthM,
          data.heightM,
          store.pixelsPerMeter,
        );
        left = objectRect.left;
        top = objectRect.top;
        widthPx = objectRect.width;
        heightPx = objectRect.height;
      }

      const id = store.nextObjectId();

      const rect = createMeasuredRect({
        left,
        top,
        width: widthPx,
        height: heightPx,
        fill: data.color,
        stroke: data.color.replace("0.6", "1"),
        scaleX: data.scaleX,
        scaleY: data.scaleY,
        angle: data.angle,
        objectId: id,
        shapeName: data.name,
        shapeWidthM: data.widthM,
        shapeHeightM: data.heightM,
        baseWidthPx: data.baseWidthPx ?? widthPx,
        baseHeightPx: data.baseHeightPx ?? heightPx,
      });

      canvas.add(rect);
      fabricRefsRef.current.set(id, { type: "shape", rect });

      store.addObject({
        id,
        type: "shape",
        name: data.name,
        widthM: data.widthM,
        heightM: data.heightM,
        color: data.color,
        ...(data.worldX != null ? { worldX: data.worldX } : {}),
        ...(data.worldY != null ? { worldY: data.worldY } : {}),
        ...(data.angle != null && data.angle !== 0
          ? { angle: data.angle }
          : {}),
      });
    },
    [fabricCanvasRef, fabricRefsRef],
  );

  return { addShape, updateShapeDimensions, loadShape };
}
