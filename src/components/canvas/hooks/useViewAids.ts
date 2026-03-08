/**
 * @module useViewAids
 * @description Draws grid/rulers/guides on an overlay canvas and provides
 * guide interactions + snapping helpers for shape/line transforms.
 */
"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Canvas, Rect, Line as FabricLine } from "fabric";
import { usePlannerStore } from "@/lib/store";
import type { GuideAxis } from "@/lib/types";
import { getFabricProp } from "@/components/canvas/utils/fabricHelpers";
import {
  resolveAxisSnap,
  screenAxisToWorld,
  worldAxisToScreen,
} from "@/components/canvas/utils/viewAids";

const RULER_SIZE = 22;
const GUIDE_HIT_PX = 6;

type DraggingGuide = {
  id: string;
  axis: GuideAxis;
  dirty: boolean;
  created: boolean;
} | null;

export interface UseViewAidsReturn {
  overlayCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  handlePointerDown: (e: MouseEvent) => boolean;
  handlePointerMove: (e: MouseEvent) => boolean;
  handlePointerUp: (e: MouseEvent) => boolean;
  applyObjectMoveSnapping: (obj: unknown, e: MouseEvent) => void;
  applyObjectScaleSnapping: (obj: unknown, e: MouseEvent) => void;
  clearGuidesWithHistory: () => void;
}

export function useViewAids(
  fabricCanvasRef: React.RefObject<Canvas | null>,
  onCommittedChange: () => void,
): UseViewAidsReturn {
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const draggingGuideRef = useRef<DraggingGuide>(null);

  const drawOverlay = useCallback(() => {
    const overlay = overlayCanvasRef.current;
    const fabricCanvas = fabricCanvasRef.current;
    if (!overlay || !fabricCanvas) return;

    const width = fabricCanvas.getWidth();
    const height = fabricCanvas.getHeight();
    if (overlay.width !== width || overlay.height !== height) {
      overlay.width = width;
      overlay.height = height;
    }

    const ctx = overlay.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);

    const store = usePlannerStore.getState();
    const { viewAids, pixelsPerMeter } = store;
    if (!pixelsPerMeter || pixelsPerMeter <= 0) return;

    const vpt = fabricCanvas.viewportTransform ?? [1, 0, 0, 1, 0, 0];
    const zoom = fabricCanvas.getZoom();
    const panX = vpt[4];
    const panY = vpt[5];

    const axisX = { pixelsPerMeter, zoom, pan: panX };
    const axisY = { pixelsPerMeter, zoom, pan: panY };

    const contentTop = viewAids.showRulers ? RULER_SIZE : 0;
    const contentLeft = viewAids.showRulers ? RULER_SIZE : 0;

    if (viewAids.showGrid) {
      const step = viewAids.gridStepM;
      const majorEvery = Math.max(1, viewAids.majorEvery);
      const worldLeft = screenAxisToWorld(0, axisX);
      const worldRight = screenAxisToWorld(width, axisX);
      const worldTop = screenAxisToWorld(0, axisY);
      const worldBottom = screenAxisToWorld(height, axisY);

      const xStart = Math.floor(worldLeft / step);
      const xEnd = Math.ceil(worldRight / step);
      const yStart = Math.floor(worldTop / step);
      const yEnd = Math.ceil(worldBottom / step);

      for (let i = xStart; i <= xEnd; i++) {
        const isMajor = i % majorEvery === 0;
        const x = worldAxisToScreen(i * step, axisX);
        if (x < contentLeft - 1 || x > width + 1) continue;
        ctx.strokeStyle = isMajor
          ? "rgba(255,255,255,0.24)"
          : "rgba(255,255,255,0.10)";
        ctx.lineWidth = isMajor ? 1 : 0.5;
        ctx.beginPath();
        ctx.moveTo(x, contentTop);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      for (let i = yStart; i <= yEnd; i++) {
        const isMajor = i % majorEvery === 0;
        const y = worldAxisToScreen(i * step, axisY);
        if (y < contentTop - 1 || y > height + 1) continue;
        ctx.strokeStyle = isMajor
          ? "rgba(255,255,255,0.24)"
          : "rgba(255,255,255,0.10)";
        ctx.lineWidth = isMajor ? 1 : 0.5;
        ctx.beginPath();
        ctx.moveTo(contentLeft, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }

    // Guides
    ctx.strokeStyle = "rgba(243, 156, 18, 0.95)";
    ctx.lineWidth = 1;
    for (const guide of viewAids.guides) {
      if (guide.axis === "x") {
        const x = worldAxisToScreen(guide.valueM, axisX);
        if (x < contentLeft - 1 || x > width + 1) continue;
        ctx.beginPath();
        ctx.moveTo(x, contentTop);
        ctx.lineTo(x, height);
        ctx.stroke();
      } else {
        const y = worldAxisToScreen(guide.valueM, axisY);
        if (y < contentTop - 1 || y > height + 1) continue;
        ctx.beginPath();
        ctx.moveTo(contentLeft, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }

    if (!viewAids.showRulers) return;

    // Ruler backgrounds
    ctx.fillStyle = "rgba(9, 20, 52, 0.92)";
    ctx.fillRect(0, 0, width, RULER_SIZE);
    ctx.fillRect(0, 0, RULER_SIZE, height);
    ctx.fillStyle = "rgba(15, 52, 96, 0.95)";
    ctx.fillRect(0, 0, RULER_SIZE, RULER_SIZE);

    // Ruler ticks and labels
    const step = viewAids.gridStepM;
    const majorEvery = Math.max(1, viewAids.majorEvery);
    const worldLeft = screenAxisToWorld(0, axisX);
    const worldRight = screenAxisToWorld(width, axisX);
    const worldTop = screenAxisToWorld(0, axisY);
    const worldBottom = screenAxisToWorld(height, axisY);

    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.font = "10px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    const xStart = Math.floor(worldLeft / step);
    const xEnd = Math.ceil(worldRight / step);
    for (let i = xStart; i <= xEnd; i++) {
      const x = worldAxisToScreen(i * step, axisX);
      if (x < RULER_SIZE - 1 || x > width + 1) continue;
      const major = i % majorEvery === 0;
      const tick = major ? 10 : 5;
      ctx.beginPath();
      ctx.moveTo(x, RULER_SIZE);
      ctx.lineTo(x, RULER_SIZE - tick);
      ctx.stroke();
      if (major) {
        const value = (i * step).toFixed(step < 1 ? 1 : 0);
        ctx.fillText(value, x, 2);
      }
    }

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const yStart = Math.floor(worldTop / step);
    const yEnd = Math.ceil(worldBottom / step);
    for (let i = yStart; i <= yEnd; i++) {
      const y = worldAxisToScreen(i * step, axisY);
      if (y < RULER_SIZE - 1 || y > height + 1) continue;
      const major = i % majorEvery === 0;
      const tick = major ? 10 : 5;
      ctx.beginPath();
      ctx.moveTo(RULER_SIZE, y);
      ctx.lineTo(RULER_SIZE - tick, y);
      ctx.stroke();
      if (major) {
        const value = (i * step).toFixed(step < 1 ? 1 : 0);
        ctx.save();
        ctx.translate(2, y);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(value, 0, 0);
        ctx.restore();
      }
    }
  }, [fabricCanvasRef]);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    drawOverlay();
    const onRender = () => drawOverlay();
    canvas.on("after:render", onRender as never);
    const unsub = usePlannerStore.subscribe(() => drawOverlay());
    return () => {
      canvas.off("after:render", onRender as never);
      unsub();
    };
  }, [fabricCanvasRef, drawOverlay]);

  const toWorld = useCallback(
    (screenX: number, screenY: number, axis: GuideAxis): number | null => {
      const canvas = fabricCanvasRef.current;
      const store = usePlannerStore.getState();
      const ppm = store.pixelsPerMeter;
      if (!canvas || !ppm) return null;
      const vpt = canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0];
      const zoom = canvas.getZoom();
      if (axis === "x") {
        return screenAxisToWorld(screenX, {
          pixelsPerMeter: ppm,
          zoom,
          pan: vpt[4],
        });
      }
      return screenAxisToWorld(screenY, {
        pixelsPerMeter: ppm,
        zoom,
        pan: vpt[5],
      });
    },
    [fabricCanvasRef],
  );

  const findGuideNearPointer = useCallback(
    (
      screenX: number,
      screenY: number,
    ): { id: string; axis: GuideAxis } | null => {
      const canvas = fabricCanvasRef.current;
      const store = usePlannerStore.getState();
      const ppm = store.pixelsPerMeter;
      if (!canvas || !ppm) return null;
      const vpt = canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0];
      const zoom = canvas.getZoom();
      let best: { id: string; axis: GuideAxis; dist: number } | null = null;
      for (const guide of store.viewAids.guides) {
        const screenPos =
          guide.axis === "x"
            ? worldAxisToScreen(guide.valueM, {
                pixelsPerMeter: ppm,
                zoom,
                pan: vpt[4],
              })
            : worldAxisToScreen(guide.valueM, {
                pixelsPerMeter: ppm,
                zoom,
                pan: vpt[5],
              });
        const dist =
          guide.axis === "x"
            ? Math.abs(screenPos - screenX)
            : Math.abs(screenPos - screenY);
        if (dist <= GUIDE_HIT_PX && (!best || dist < best.dist)) {
          best = { id: guide.id, axis: guide.axis, dist };
        }
      }
      return best ? { id: best.id, axis: best.axis } : null;
    },
    [fabricCanvasRef],
  );

  const handlePointerDown = useCallback(
    (e: MouseEvent) => {
      const store = usePlannerStore.getState();
      if (store.viewAids.guideLock || !store.pixelsPerMeter) return false;
      const x = e.offsetX;
      const y = e.offsetY;

      if (store.viewAids.showRulers) {
        if (y <= RULER_SIZE && x > RULER_SIZE) {
          const valueM = toWorld(x, y, "x");
          if (valueM == null) return false;
          const id = store.addGuide("x", valueM);
          draggingGuideRef.current = {
            id,
            axis: "x",
            dirty: true,
            created: true,
          };
          drawOverlay();
          return true;
        }
        if (x <= RULER_SIZE && y > RULER_SIZE) {
          const valueM = toWorld(x, y, "y");
          if (valueM == null) return false;
          const id = store.addGuide("y", valueM);
          draggingGuideRef.current = {
            id,
            axis: "y",
            dirty: true,
            created: true,
          };
          drawOverlay();
          return true;
        }
      }

      const hit = findGuideNearPointer(x, y);
      if (!hit) return false;
      draggingGuideRef.current = {
        id: hit.id,
        axis: hit.axis,
        dirty: false,
        created: false,
      };
      return true;
    },
    [drawOverlay, findGuideNearPointer, toWorld],
  );

  const handlePointerMove = useCallback(
    (e: MouseEvent) => {
      const dragging = draggingGuideRef.current;
      if (!dragging) return false;
      const store = usePlannerStore.getState();
      const valueM = toWorld(e.offsetX, e.offsetY, dragging.axis);
      if (valueM == null) return false;
      store.updateGuide(dragging.id, valueM);
      draggingGuideRef.current = { ...dragging, dirty: true };
      drawOverlay();
      return true;
    },
    [drawOverlay, toWorld],
  );

  const handlePointerUp = useCallback(
    (e: MouseEvent) => {
      const dragging = draggingGuideRef.current;
      if (!dragging) return false;
      const store = usePlannerStore.getState();
      const overRuler =
        store.viewAids.showRulers &&
        ((dragging.axis === "x" && e.offsetY <= RULER_SIZE) ||
          (dragging.axis === "y" && e.offsetX <= RULER_SIZE));
      if (overRuler) {
        store.removeGuide(dragging.id);
      }
      const changed = dragging.dirty || overRuler || dragging.created;
      draggingGuideRef.current = null;
      drawOverlay();
      if (changed) {
        onCommittedChange();
      }
      return true;
    },
    [drawOverlay, onCommittedChange],
  );

  const applyObjectMoveSnapping = useCallback(
    (obj: unknown, e: MouseEvent) => {
      const canvas = fabricCanvasRef.current;
      const store = usePlannerStore.getState();
      const ppm = store.pixelsPerMeter;
      if (!canvas || !ppm || e.altKey || !store.viewAids.snapEnabled) return;
      if (store.mode !== "normal" && store.mode !== "cleanup") return;

      const objectType = getFabricProp(obj as Rect, "objectType");
      const zoom = canvas.getZoom();
      const settings = store.viewAids;

      if (objectType === "shape") {
        const rect = obj as Rect;
        const left = rect.left ?? 0;
        const top = rect.top ?? 0;
        const widthPx = (rect.width ?? 0) * (rect.scaleX ?? 1);
        const heightPx = (rect.height ?? 0) * (rect.scaleY ?? 1);

        const snapX = resolveAxisSnap({
          candidateValuesM: [
            left / ppm,
            (left + widthPx / 2) / ppm,
            (left + widthPx) / ppm,
          ],
          guides: settings.guides,
          axis: "x",
          gridStepM: settings.gridStepM,
          tolerancePx: settings.snapTolerancePx,
          pixelsPerMeter: ppm,
          zoom,
          snapEnabled: settings.snapEnabled,
        });
        if (snapX) rect.set("left", left + snapX.deltaM * ppm);

        const snapY = resolveAxisSnap({
          candidateValuesM: [
            top / ppm,
            (top + heightPx / 2) / ppm,
            (top + heightPx) / ppm,
          ],
          guides: settings.guides,
          axis: "y",
          gridStepM: settings.gridStepM,
          tolerancePx: settings.snapTolerancePx,
          pixelsPerMeter: ppm,
          zoom,
          snapEnabled: settings.snapEnabled,
        });
        if (snapY) rect.set("top", top + snapY.deltaM * ppm);
      }

      if (objectType === "line") {
        const line = obj as FabricLine;
        const left = line.left ?? 0;
        const top = line.top ?? 0;
        const scaleX = line.scaleX ?? 1;
        const scaleY = line.scaleY ?? 1;
        const p1x = left + (line.x1 ?? 0) * scaleX;
        const p2x = left + (line.x2 ?? 0) * scaleX;
        const p1y = top + (line.y1 ?? 0) * scaleY;
        const p2y = top + (line.y2 ?? 0) * scaleY;

        const snapX = resolveAxisSnap({
          candidateValuesM: [p1x / ppm, p2x / ppm, (p1x + p2x) / 2 / ppm],
          guides: settings.guides,
          axis: "x",
          gridStepM: settings.gridStepM,
          tolerancePx: settings.snapTolerancePx,
          pixelsPerMeter: ppm,
          zoom,
          snapEnabled: settings.snapEnabled,
        });
        if (snapX) line.set("left", left + snapX.deltaM * ppm);

        const snapY = resolveAxisSnap({
          candidateValuesM: [p1y / ppm, p2y / ppm, (p1y + p2y) / 2 / ppm],
          guides: settings.guides,
          axis: "y",
          gridStepM: settings.gridStepM,
          tolerancePx: settings.snapTolerancePx,
          pixelsPerMeter: ppm,
          zoom,
          snapEnabled: settings.snapEnabled,
        });
        if (snapY) line.set("top", top + snapY.deltaM * ppm);
      }
    },
    [fabricCanvasRef],
  );

  const applyObjectScaleSnapping = useCallback(
    (obj: unknown, e: MouseEvent) => {
      const canvas = fabricCanvasRef.current;
      const store = usePlannerStore.getState();
      const ppm = store.pixelsPerMeter;
      if (!canvas || !ppm || e.altKey || !store.viewAids.snapEnabled) return;
      if (store.mode !== "normal" && store.mode !== "cleanup") return;

      const objectType = getFabricProp(obj as Rect, "objectType");
      if (objectType !== "shape") return;

      const rect = obj as Rect;
      const left = rect.left ?? 0;
      const top = rect.top ?? 0;
      const baseW = getFabricProp(rect, "baseWidthPx") ?? rect.width ?? 0;
      const baseH = getFabricProp(rect, "baseHeightPx") ?? rect.height ?? 0;
      if (!baseW || !baseH) return;

      const widthPx = baseW * (rect.scaleX ?? 1);
      const heightPx = baseH * (rect.scaleY ?? 1);
      const zoom = canvas.getZoom();
      const settings = store.viewAids;

      const snapX = resolveAxisSnap({
        candidateValuesM: [(left + widthPx) / ppm],
        guides: settings.guides,
        axis: "x",
        gridStepM: settings.gridStepM,
        tolerancePx: settings.snapTolerancePx,
        pixelsPerMeter: ppm,
        zoom,
        snapEnabled: settings.snapEnabled,
      });
      if (snapX) {
        const nextWidth = widthPx + snapX.deltaM * ppm;
        if (nextWidth > 10) {
          rect.set("scaleX", nextWidth / baseW);
        }
      }

      const snapY = resolveAxisSnap({
        candidateValuesM: [(top + heightPx) / ppm],
        guides: settings.guides,
        axis: "y",
        gridStepM: settings.gridStepM,
        tolerancePx: settings.snapTolerancePx,
        pixelsPerMeter: ppm,
        zoom,
        snapEnabled: settings.snapEnabled,
      });
      if (snapY) {
        const nextHeight = heightPx + snapY.deltaM * ppm;
        if (nextHeight > 10) {
          rect.set("scaleY", nextHeight / baseH);
        }
      }
    },
    [fabricCanvasRef],
  );

  const clearGuidesWithHistory = useCallback(() => {
    const store = usePlannerStore.getState();
    if (store.viewAids.guides.length === 0) return;
    store.clearGuides();
    drawOverlay();
    onCommittedChange();
  }, [drawOverlay, onCommittedChange]);

  return {
    overlayCanvasRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    applyObjectMoveSnapping,
    applyObjectScaleSnapping,
    clearGuidesWithHistory,
  };
}
