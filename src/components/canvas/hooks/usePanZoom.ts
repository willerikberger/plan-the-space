/**
 * @module usePanZoom
 * @description Handles canvas panning via click-drag and zooming via mouse wheel.
 * Mutates the Fabric viewport transform and zoom level, and updates the Zustand status message.
 * @dependencies fabric (Canvas, Point), constants (ZOOM_MIN, ZOOM_MAX), store
 * @usage Called from PlannerCanvas; pan/zoom callbacks are wired into useCanvasEvents.
 */
"use client";

import { useRef, useEffect } from "react";
import { Point as FabricPoint } from "fabric";
import type { Canvas, TPointerEventInfo } from "fabric";
import { ZOOM_MIN, ZOOM_MAX } from "@/lib/constants";
import { usePlannerStore, selectVisibleObjects } from "@/lib/store";

export function usePanZoom(fabricCanvasRef: React.RefObject<Canvas | null>) {
  const isPanningRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const wheelDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const handleWheel = (opt: TPointerEventInfo<WheelEvent>) => {
      const e = opt.e;
      const delta = e.deltaY;
      let zoom = canvas.getZoom();
      zoom *= 0.999 ** delta;
      zoom = Math.min(Math.max(ZOOM_MIN, zoom), ZOOM_MAX);
      canvas.zoomToPoint(new FabricPoint(e.offsetX, e.offsetY), zoom);
      e.preventDefault();
      e.stopPropagation();

      // Debounce status message updates during rapid scrolling
      if (wheelDebounceRef.current) clearTimeout(wheelDebounceRef.current);
      const capturedZoom = zoom;
      wheelDebounceRef.current = setTimeout(() => {
        const pct = Math.round(capturedZoom * 100);
        const state = usePlannerStore.getState();
        const count = selectVisibleObjects(state).length;
        state.setStatusMessage(`Zoom: ${pct}% | ${count} object(s)`);
      }, 100);
    };

    canvas.on("mouse:wheel", handleWheel as never);
    return () => {
      canvas.off("mouse:wheel", handleWheel as never);
      if (wheelDebounceRef.current) clearTimeout(wheelDebounceRef.current);
    };
  }, [fabricCanvasRef]);

  const startPan = (clientX: number, clientY: number) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    isPanningRef.current = true;
    canvas.selection = false;
    lastPosRef.current = { x: clientX, y: clientY };
  };

  const movePan = (clientX: number, clientY: number) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !isPanningRef.current) return;
    const vpt = canvas.viewportTransform!;
    vpt[4] += clientX - lastPosRef.current.x;
    vpt[5] += clientY - lastPosRef.current.y;
    canvas.requestRenderAll();
    lastPosRef.current = { x: clientX, y: clientY };
  };

  const endPan = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    isPanningRef.current = false;
    canvas.selection = true;
  };

  return { isPanningRef, startPan, movePan, endPan };
}
