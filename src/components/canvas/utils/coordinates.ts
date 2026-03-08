/**
 * @module coordinates
 * @description Pure world↔canvas coordinate transforms. All positions stored in meters (world space).
 * The canvas acts as a camera/viewport. Resize = viewport change, not object repositioning.
 *
 * Core math:
 *   canvasX = worldX * ppm * zoom + panX
 *   canvasY = worldY * ppm * zoom + panY
 *   worldX  = (canvasX - panX) / (ppm * zoom)
 *   worldY  = (canvasY - panY) / (ppm * zoom)
 *
 * @dependencies types (WorldPoint, Camera)
 * @usage Consumed by useShapes, useLines, usePanZoom, useFabricCanvas, and serialization.
 */
import type { WorldPoint, Camera } from "@/lib/types";

// ============================================
// Point transforms
// ============================================

/** Convert a world-space point (meters) to canvas-space pixel coordinates */
export function worldToCanvas(
  world: WorldPoint,
  camera: Camera,
): { x: number; y: number } {
  return {
    x: world.x * camera.pixelsPerMeter * camera.zoom + camera.panX,
    y: world.y * camera.pixelsPerMeter * camera.zoom + camera.panY,
  };
}

/** Convert a canvas-space pixel coordinate to world-space (meters) */
export function canvasToWorld(
  canvasX: number,
  canvasY: number,
  camera: Camera,
): WorldPoint {
  const scale = camera.pixelsPerMeter * camera.zoom;
  return {
    x: (canvasX - camera.panX) / scale,
    y: (canvasY - camera.panY) / scale,
  };
}

// ============================================
// Length transforms
// ============================================

/** Convert a world-space length (meters) to canvas-space pixels */
export function worldLengthToCanvas(meters: number, camera: Camera): number {
  return meters * camera.pixelsPerMeter * camera.zoom;
}

/** Convert a canvas-space pixel length to world-space (meters) */
export function canvasLengthToWorld(pixels: number, camera: Camera): number {
  return pixels / (camera.pixelsPerMeter * camera.zoom);
}

// ============================================
// Rect transforms
// ============================================

/** Convert a world-space rect (x, y, width, height in meters) to canvas-space */
export function worldRectToCanvas(
  worldX: number,
  worldY: number,
  widthM: number,
  heightM: number,
  camera: Camera,
): { left: number; top: number; width: number; height: number } {
  const topLeft = worldToCanvas({ x: worldX, y: worldY }, camera);
  return {
    left: topLeft.x,
    top: topLeft.y,
    width: widthM * camera.pixelsPerMeter * camera.zoom,
    height: heightM * camera.pixelsPerMeter * camera.zoom,
  };
}

/**
 * Convert a world-space rect defined by center (meters) to Fabric object-space
 * (unzoomed/unpanned canvas coordinates). This is used when constructing objects:
 * viewport transform (zoom/pan) is applied by Fabric at render-time.
 */
export function worldCenterRectToObjectSpace(
  worldCenterX: number,
  worldCenterY: number,
  widthM: number,
  heightM: number,
  pixelsPerMeter: number,
): { left: number; top: number; width: number; height: number } {
  return {
    left: (worldCenterX - widthM / 2) * pixelsPerMeter,
    top: (worldCenterY - heightM / 2) * pixelsPerMeter,
    width: widthM * pixelsPerMeter,
    height: heightM * pixelsPerMeter,
  };
}

// ============================================
// Camera factory & viewport helpers
// ============================================

/** Create a default camera with the given pixelsPerMeter and viewport size */
export function createCamera(
  pixelsPerMeter: number,
  viewportWidth: number,
  viewportHeight: number,
): Camera {
  return {
    pixelsPerMeter,
    zoom: 1,
    panX: 0,
    panY: 0,
    viewportWidth,
    viewportHeight,
  };
}

/**
 * Update viewport dimensions on the camera (e.g. after window resize).
 * Preserves pan and zoom — the viewport just gets bigger/smaller.
 */
export function updateCameraViewport(
  camera: Camera,
  viewportWidth: number,
  viewportHeight: number,
): Camera {
  return {
    ...camera,
    viewportWidth,
    viewportHeight,
  };
}

/**
 * Extract a Camera from the Fabric.js viewport transform.
 * Fabric stores its viewport as a 6-element affine matrix [a, b, c, d, e, f]
 * where a = d = zoom, e = panX, f = panY (b = c = 0 for non-skewed).
 */
export function cameraFromFabricViewport(
  vpt: number[],
  pixelsPerMeter: number,
  viewportWidth: number,
  viewportHeight: number,
): Camera {
  return {
    pixelsPerMeter,
    zoom: vpt[0], // a = horizontal scale = zoom
    panX: vpt[4], // e = horizontal translation
    panY: vpt[5], // f = vertical translation
    viewportWidth,
    viewportHeight,
  };
}

/**
 * Convert a Camera back to a Fabric.js viewport transform (6-element array).
 * Returns [zoom, 0, 0, zoom, panX, panY].
 */
export function cameraToFabricViewport(camera: Camera): number[] {
  return [camera.zoom, 0, 0, camera.zoom, camera.panX, camera.panY];
}
