/**
 * @module useCanvasEvents
 * @description Routes Fabric mouse and object events to the appropriate mode-specific handlers.
 * Acts as the central event dispatcher, delegating to calibration, line, mask, shape, pan, and auto-save callbacks based on the current PlannerMode.
 * @dependencies fabricHelpers (getFabricProp), store (mode), types (Point)
 * @usage Called from PlannerCanvas with a CanvasEventHandlers bag assembled from all other hooks.
 */
"use client";

import { useEffect, useRef } from "react";
import type { Canvas, TPointerEventInfo, Rect } from "fabric";
import type { MeasuredRect } from "@/components/canvas/fabricClasses/MeasuredRect";
import { usePlannerStore } from "@/lib/store";
import { getFabricProp } from "@/components/canvas/utils/fabricHelpers";
import type { Point } from "@/lib/types";

export interface CalibrationHandlers {
  handleCalibrationClick: (pointer: Point) => void;
  updateCalibrationLine: (pointer: Point) => void;
  finishCalibrationLine: () => void;
  startPointRef: React.RefObject<Point | null>;
}

export interface LineHandlers {
  handleLineDrawStart: (pointer: Point) => void;
  updateDrawingLine: (pointer: Point) => void;
  finishDrawingLine: () => void;
  lineStartRef: React.RefObject<Point | null>;
}

export interface MaskHandlers {
  handleMaskDrawStart: (pointer: Point) => void;
  updateMaskRect: (pointer: Point) => void;
  finishMaskRect: () => void;
}

export interface ShapeHandlers {
  updateShapeDimensions: (rect: MeasuredRect, finalize: boolean) => void;
}

export interface PanHandlers {
  startPan: (clientX: number, clientY: number) => void;
  movePan: (clientX: number, clientY: number) => void;
  endPan: () => void;
  isPanningRef: React.RefObject<boolean>;
}

export interface ObjectHandlers {
  deleteSelected: () => void;
  reorderObjects: () => void;
  triggerAutoSave: () => void;
}

type CanvasEventHandlers = CalibrationHandlers &
  LineHandlers &
  MaskHandlers &
  ShapeHandlers &
  PanHandlers &
  ObjectHandlers;

export function useCanvasEvents(
  fabricCanvasRef: React.RefObject<Canvas | null>,
  handlers: CanvasEventHandlers,
) {
  // Keep a ref to the latest handlers so Fabric listeners stay stable
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const onMouseDown = (opt: TPointerEventInfo<MouseEvent>) => {
      const h = handlersRef.current;
      if (!canvas) return;
      const mode = usePlannerStore.getState().mode;
      const pointer = canvas.getScenePoint(opt.e);

      if (mode === "calibrating") {
        h.handleCalibrationClick(pointer);
        return;
      }
      if (mode === "drawing-mask") {
        h.handleMaskDrawStart(pointer);
        return;
      }
      if (mode === "drawing-line") {
        h.handleLineDrawStart(pointer);
        return;
      }
      // Pan: click on empty space
      if (opt.e.altKey || (!opt.target && opt.e.button === 0)) {
        if (!opt.target) {
          h.startPan(opt.e.clientX, opt.e.clientY);
        }
      }
    };

    const onMouseMove = (opt: TPointerEventInfo<MouseEvent>) => {
      const h = handlersRef.current;
      if (!canvas) return;
      const mode = usePlannerStore.getState().mode;
      const pointer = canvas.getScenePoint(opt.e);

      if (mode === "calibrating" && h.startPointRef.current) {
        h.updateCalibrationLine(pointer);
        return;
      }
      if (mode === "drawing-mask") {
        h.updateMaskRect(pointer);
        return;
      }
      if (mode === "drawing-line" && h.lineStartRef.current) {
        h.updateDrawingLine(pointer);
        return;
      }
      if (h.isPanningRef.current) {
        h.movePan(opt.e.clientX, opt.e.clientY);
      }
    };

    const onMouseUp = () => {
      const h = handlersRef.current;
      if (!canvas) return;
      const mode = usePlannerStore.getState().mode;

      if (mode === "calibrating" && h.startPointRef.current) {
        h.finishCalibrationLine();
        return;
      }
      if (mode === "drawing-mask") {
        h.finishMaskRect();
        return;
      }
      if (mode === "drawing-line" && h.lineStartRef.current) {
        h.finishDrawingLine();
        return;
      }
      h.endPan();
    };

    const onObjectModified = (opt: { target: unknown }) => {
      const h = handlersRef.current;
      const obj = opt.target;
      if (!obj) return;
      const objectType = getFabricProp(obj as Rect, "objectType");
      if (objectType === "shape") {
        h.updateShapeDimensions(obj as unknown as MeasuredRect, true);
      }
      h.triggerAutoSave();
    };

    const onObjectScaling = (opt: { target: unknown }) => {
      const h = handlersRef.current;
      const obj = opt.target;
      if (!obj) return;
      const objectType = getFabricProp(obj as Rect, "objectType");
      if (objectType === "shape") {
        h.updateShapeDimensions(obj as unknown as MeasuredRect, false);
      }
    };

    canvas.on("mouse:down", onMouseDown as never);
    canvas.on("mouse:move", onMouseMove as never);
    canvas.on("mouse:up", onMouseUp as never);
    canvas.on("object:modified", onObjectModified as never);
    canvas.on("object:scaling", onObjectScaling as never);

    return () => {
      canvas.off("mouse:down", onMouseDown as never);
      canvas.off("mouse:move", onMouseMove as never);
      canvas.off("mouse:up", onMouseUp as never);
      canvas.off("object:modified", onObjectModified as never);
      canvas.off("object:scaling", onObjectScaling as never);
    };
    // Register once when the canvas is available — handlersRef keeps callbacks fresh
  }, [fabricCanvasRef]);
}
