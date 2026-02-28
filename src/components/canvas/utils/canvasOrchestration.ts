/**
 * @module canvasOrchestration
 * @description Provides canvas-level orchestration utilities: reading Fabric state for serialization,
 * clearing the canvas, reordering objects by layer, deleting individual objects, and loading a full project from serialized data.
 * @dependencies fabricHelpers (getFabricProp), store (clearObjects, removeObject), types (ShapeFabricRefs, LineFabricRefs, MaskFabricRefs, ImageFabricRefs, SerializedObject subtypes)
 * @usage Called from PlannerCanvas for project load/clear/reorder and from the imperative handle for delete operations.
 */
import type { Canvas } from "fabric";
import type {
  ShapeFabricRefs,
  LineFabricRefs,
  MaskFabricRefs,
  ImageFabricRefs,
  SerializedObject,
  SerializedShape,
  SerializedLine,
  SerializedMask,
  SerializedImage,
  LayerVisibility,
} from "@/lib/types";
import { layerGroupForType } from "@/lib/types";
import { usePlannerStore } from "@/lib/store";
import { getFabricProp } from "./fabricHelpers";

// Union type for all fabric refs (mirrors the one in PlannerCanvas)
type AnyFabricRefs =
  | ShapeFabricRefs
  | LineFabricRefs
  | MaskFabricRefs
  | ImageFabricRefs;

// Return type for getFabricState — the serialized Fabric-level properties
export type FabricStateResult = {
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
} | null;

/**
 * Read the current Fabric-level properties for a tracked object.
 * Pure function: takes an id and the refs Map, returns serialized state.
 */
export function getFabricState(
  id: number,
  allFabricRefsRef: React.RefObject<Map<number, AnyFabricRefs>>,
): FabricStateResult {
  const refs = allFabricRefsRef.current.get(id);
  if (!refs) return null;

  switch (refs.type) {
    case "mask": {
      const r = refs.rect;
      return {
        left: r.left ?? 0,
        top: r.top ?? 0,
        scaleX: r.scaleX ?? 1,
        scaleY: r.scaleY ?? 1,
        angle: r.angle ?? 0,
        width: r.width,
        height: r.height,
      };
    }
    case "shape": {
      const r = refs.rect;
      return {
        left: r.left ?? 0,
        top: r.top ?? 0,
        scaleX: r.scaleX ?? 1,
        scaleY: r.scaleY ?? 1,
        angle: r.angle ?? 0,
        width: r.width,
        height: r.height,
        baseWidthPx: getFabricProp(r, "baseWidthPx"),
        baseHeightPx: getFabricProp(r, "baseHeightPx"),
      };
    }
    case "line": {
      const l = refs.line;
      return {
        left: l.left ?? 0,
        top: l.top ?? 0,
        scaleX: l.scaleX ?? 1,
        scaleY: l.scaleY ?? 1,
        angle: l.angle ?? 0,
        x1: l.x1,
        y1: l.y1,
        x2: l.x2,
        y2: l.y2,
        strokeWidth: l.strokeWidth,
      };
    }
    case "image": {
      const img = refs.image;
      return {
        left: img.left ?? 0,
        top: img.top ?? 0,
        scaleX: img.scaleX ?? 1,
        scaleY: img.scaleY ?? 1,
        angle: img.angle ?? 0,
        originX: String(img.originX ?? "left"),
        originY: String(img.originY ?? "top"),
      };
    }
  }
}

/**
 * Remove all tracked Fabric objects from the canvas and clear the refs map.
 */
export function clearCanvas(
  fabricCanvas: Canvas,
  allFabricRefsRef: React.RefObject<Map<number, AnyFabricRefs>>,
): void {
  // Remove all tracked objects from canvas (one Fabric object per refs entry)
  for (const [, refs] of allFabricRefsRef.current) {
    switch (refs.type) {
      case "shape":
      case "mask":
        fabricCanvas.remove(refs.rect);
        break;
      case "line":
        fabricCanvas.remove(refs.line);
        break;
      case "image":
        fabricCanvas.remove(refs.image);
        break;
    }
  }
  allFabricRefsRef.current.clear();
  usePlannerStore.getState().clearObjects();
}

/**
 * Re-order Fabric objects on the canvas using the store-driven layer system.
 * Order: background group → masks group → content group.
 */
export function reorderObjects(
  fabricCanvas: Canvas,
  allFabricRefsRef: React.RefObject<Map<number, AnyFabricRefs>>,
): void {
  let idx = 0;

  const store = usePlannerStore.getState();
  const renderOrder = store.getRenderOrder();

  for (const objectId of renderOrder) {
    const refs = allFabricRefsRef.current.get(objectId);
    if (!refs) continue;

    switch (refs.type) {
      case "shape":
      case "mask":
        fabricCanvas.moveObjectTo(refs.rect, idx++);
        break;
      case "line":
        fabricCanvas.moveObjectTo(refs.line, idx++);
        break;
      case "image":
        fabricCanvas.moveObjectTo(refs.image, idx++);
        break;
    }
  }
  fabricCanvas.renderAll();
}

/**
 * Apply layer visibility to all tracked Fabric objects in O(n).
 * Each object's visibility and interactivity is set based on its layer group.
 */
export function applyLayerVisibility(
  fabricCanvas: Canvas,
  allFabricRefsRef: React.RefObject<Map<number, AnyFabricRefs>>,
  visibility: LayerVisibility,
): void {
  const store = usePlannerStore.getState();

  for (const [id, refs] of allFabricRefsRef.current) {
    const obj = store.objects.get(id);
    if (!obj) continue;

    const group = layerGroupForType(obj.type);
    const visible = visibility[group];

    let fabricObj;
    switch (refs.type) {
      case "shape":
      case "mask":
        fabricObj = refs.rect;
        break;
      case "line":
        fabricObj = refs.line;
        break;
      case "image":
        fabricObj = refs.image;
        break;
    }

    fabricObj.set({
      visible,
      selectable: visible,
      evented: visible,
    });
  }
  fabricCanvas.renderAll();
}

/**
 * Delete a single tracked object from the canvas and the store.
 */
export function deleteObject(
  id: number,
  fabricCanvas: Canvas,
  allFabricRefsRef: React.RefObject<Map<number, AnyFabricRefs>>,
): void {
  const refs = allFabricRefsRef.current.get(id);
  if (refs) {
    switch (refs.type) {
      case "shape":
      case "mask":
        fabricCanvas.remove(refs.rect);
        break;
      case "line":
        fabricCanvas.remove(refs.line);
        break;
      case "image":
        fabricCanvas.remove(refs.image);
        break;
    }
    allFabricRefsRef.current.delete(id);
  }
  usePlannerStore.getState().removeObject(id);
  fabricCanvas.renderAll();
}

/** Hook functions needed by loadProjectFromData */
export interface LoadProjectHooks {
  loadShape: (sObj: SerializedShape) => void;
  loadLine: (sObj: SerializedLine) => void;
  loadMask: (sObj: SerializedMask) => void;
  loadImageObject: (sObj: SerializedImage) => Promise<void>;
}

/**
 * Load serialized objects into the canvas via the hook loaders,
 * then reorder and render.
 */
export async function loadProjectFromData(
  serializedObjects: SerializedObject[],
  fabricCanvas: Canvas,
  allFabricRefsRef: React.RefObject<Map<number, AnyFabricRefs>>,
  hooks: LoadProjectHooks,
): Promise<void> {
  for (const sObj of serializedObjects) {
    switch (sObj.type) {
      case "shape":
        hooks.loadShape(sObj);
        break;
      case "line":
        hooks.loadLine(sObj);
        break;
      case "mask":
        hooks.loadMask(sObj);
        break;
      case "backgroundImage":
      case "overlayImage":
        await hooks.loadImageObject(sObj);
        break;
    }
  }
  reorderObjects(fabricCanvas, allFabricRefsRef);
  fabricCanvas.renderAll();
}
