/**
 * @module canvasOrchestration
 * @description Provides canvas-level orchestration utilities: reading Fabric state for serialization,
 * clearing the canvas, reordering objects by layer, deleting individual objects, and loading a full project from serialized data.
 * @dependencies fabricHelpers (getFabricProp), store (clearObjects, removeObject), types (ShapeFabricRefs, LineFabricRefs, MaskFabricRefs, ImageFabricRefs, SerializedObject subtypes)
 * @usage Called from PlannerCanvas for project load/clear/reorder and from the imperative handle for delete operations.
 */
import type { Canvas, FabricImage } from "fabric";
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
} from "@/lib/types";
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

  if ("rect" in refs && !("label" in refs)) {
    // mask
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
  if ("rect" in refs && "label" in refs) {
    // shape
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
  if ("line" in refs) {
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
  if ("image" in refs) {
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
  return null;
}

/**
 * Remove all tracked Fabric objects from the canvas and clear the refs map.
 * Also removes the background image if present.
 */
export function clearCanvas(
  fabricCanvas: Canvas,
  allFabricRefsRef: React.RefObject<Map<number, AnyFabricRefs>>,
  backgroundRef: React.MutableRefObject<FabricImage | null>,
): void {
  // Remove all tracked objects from canvas
  for (const [, refs] of allFabricRefsRef.current) {
    if ("rect" in refs) fabricCanvas.remove(refs.rect);
    if ("label" in refs) fabricCanvas.remove(refs.label);
    if ("dims" in refs) fabricCanvas.remove(refs.dims);
    if ("line" in refs) {
      fabricCanvas.remove(refs.line);
      if ("label" in refs) fabricCanvas.remove(refs.label);
    }
    if ("image" in refs) fabricCanvas.remove(refs.image);
  }
  allFabricRefsRef.current.clear();
  if (backgroundRef.current) {
    fabricCanvas.remove(backgroundRef.current);
    backgroundRef.current = null;
  }
  usePlannerStore.getState().clearObjects();
}

/**
 * Re-order Fabric objects on the canvas so masks and background images
 * are rendered behind all other objects.
 */
export function reorderObjects(
  fabricCanvas: Canvas,
  allFabricRefsRef: React.RefObject<Map<number, AnyFabricRefs>>,
  backgroundRef: React.RefObject<FabricImage | null>,
): void {
  let idx = 0;

  // Background image first
  if (backgroundRef.current) {
    fabricCanvas.moveObjectTo(backgroundRef.current, 0);
    idx = 1;
  }

  const store = usePlannerStore.getState();
  // Masks
  for (const obj of store.objects.values()) {
    if (obj.type === "mask") {
      const refs = allFabricRefsRef.current.get(obj.id);
      if (refs && "rect" in refs) {
        fabricCanvas.moveObjectTo(refs.rect, idx++);
      }
    }
  }
  // Background images
  for (const obj of store.objects.values()) {
    if (obj.type === "backgroundImage") {
      const refs = allFabricRefsRef.current.get(obj.id);
      if (refs && "image" in refs) {
        fabricCanvas.moveObjectTo(refs.image, idx++);
      }
    }
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
    if ("rect" in refs) fabricCanvas.remove(refs.rect);
    if ("label" in refs) fabricCanvas.remove(refs.label);
    if ("dims" in refs) fabricCanvas.remove(refs.dims);
    if ("line" in refs) {
      fabricCanvas.remove(refs.line);
      if ("label" in refs) fabricCanvas.remove(refs.label);
    }
    if ("image" in refs) fabricCanvas.remove(refs.image);
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
  backgroundRef: React.RefObject<FabricImage | null>,
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
  reorderObjects(fabricCanvas, allFabricRefsRef, backgroundRef);
  fabricCanvas.renderAll();
}
