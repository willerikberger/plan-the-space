/**
 * @module useCanvasEvents
 * @description Routes Fabric mouse and object events to the appropriate mode-specific handlers.
 * Acts as the central event dispatcher, delegating to calibration, line, mask, shape, pan, and auto-save callbacks based on the current PlannerMode.
 * @dependencies fabricHelpers (getFabricProp), store (mode), types (Point)
 * @usage Called from PlannerCanvas with a CanvasEventHandlers bag assembled from all other hooks.
 */
"use client";

import { useEffect, useCallback } from "react";
import type { Canvas, TPointerEventInfo, Rect, Line } from "fabric";
import { usePlannerStore } from "@/lib/store";
import { getFabricProp } from "@/components/canvas/utils/fabricHelpers";
import type { Point } from "@/lib/types";

interface CanvasEventHandlers {
  // Calibration
  handleCalibrationClick: (pointer: Point) => void;
  updateCalibrationLine: (pointer: Point) => void;
  finishCalibrationLine: () => void;
  startPointRef: React.RefObject<Point | null>;

  // Lines
  handleLineDrawStart: (pointer: Point) => void;
  updateDrawingLine: (pointer: Point) => void;
  finishDrawingLine: () => void;
  lineStartRef: React.RefObject<Point | null>;
  updateLineLabel: (line: Line) => void;

  // Masks
  handleMaskDrawStart: (pointer: Point) => void;
  updateMaskRect: (pointer: Point) => void;
  finishMaskRect: () => void;

  // Shapes
  updateShapeLabels: (rect: Rect) => void;
  updateShapeDimensions: (rect: Rect, finalize: boolean) => void;

  // Pan
  startPan: (clientX: number, clientY: number) => void;
  movePan: (clientX: number, clientY: number) => void;
  endPan: () => void;
  isPanningRef: React.RefObject<boolean>;

  // Objects
  deleteSelected: () => void;
  reorderObjects: () => void;
  triggerAutoSave: () => void;
}

export function useCanvasEvents(
  fabricCanvasRef: React.RefObject<Canvas | null>,
  handlers: CanvasEventHandlers,
) {
  const handleMouseDown = useCallback(
    (opt: TPointerEventInfo<MouseEvent>) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;
      const mode = usePlannerStore.getState().mode;
      const pointer = canvas.getScenePoint(opt.e);

      if (mode === "calibrating") {
        handlers.handleCalibrationClick(pointer);
        return;
      }

      if (mode === "drawing-mask") {
        handlers.handleMaskDrawStart(pointer);
        return;
      }

      if (mode === "drawing-line") {
        handlers.handleLineDrawStart(pointer);
        return;
      }

      // Pan: alt key or click on empty space
      if (opt.e.altKey || (!opt.target && opt.e.button === 0)) {
        if (!opt.target) {
          handlers.startPan(opt.e.clientX, opt.e.clientY);
        }
      }
    },
    [fabricCanvasRef, handlers],
  );

  const handleMouseMove = useCallback(
    (opt: TPointerEventInfo<MouseEvent>) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;
      const mode = usePlannerStore.getState().mode;
      const pointer = canvas.getScenePoint(opt.e);

      if (mode === "calibrating" && handlers.startPointRef.current) {
        handlers.updateCalibrationLine(pointer);
        return;
      }

      if (mode === "drawing-mask") {
        handlers.updateMaskRect(pointer);
        return;
      }

      if (mode === "drawing-line" && handlers.lineStartRef.current) {
        handlers.updateDrawingLine(pointer);
        return;
      }

      if (handlers.isPanningRef.current) {
        handlers.movePan(opt.e.clientX, opt.e.clientY);
      }
    },
    [fabricCanvasRef, handlers],
  );

  const handleMouseUp = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const mode = usePlannerStore.getState().mode;

    if (mode === "calibrating" && handlers.startPointRef.current) {
      handlers.finishCalibrationLine();
      return;
    }

    if (mode === "drawing-mask") {
      handlers.finishMaskRect();
      return;
    }

    if (mode === "drawing-line" && handlers.lineStartRef.current) {
      handlers.finishDrawingLine();
      return;
    }

    handlers.endPan();
  }, [fabricCanvasRef, handlers]);

  const handleObjectModified = useCallback(
    (opt: { target: unknown }) => {
      const obj = opt.target;
      if (!obj) return;
      const objectType = getFabricProp(obj as Rect, "objectType");
      if (objectType === "shape") {
        handlers.updateShapeDimensions(obj as Rect, true);
        handlers.updateShapeLabels(obj as Rect);
      }
      if (objectType === "line") {
        handlers.updateLineLabel(obj as Line);
      }
      handlers.triggerAutoSave();
    },
    [handlers],
  );

  const handleObjectScaling = useCallback(
    (opt: { target: unknown }) => {
      const obj = opt.target;
      if (!obj) return;
      const objectType = getFabricProp(obj as Rect, "objectType");
      if (objectType === "shape") {
        handlers.updateShapeDimensions(obj as Rect, false);
        handlers.updateShapeLabels(obj as Rect);
      }
    },
    [handlers],
  );

  const handleObjectMoving = useCallback(
    (opt: { target: unknown }) => {
      const obj = opt.target;
      if (!obj) return;
      const objectType = getFabricProp(obj as Rect, "objectType");
      if (objectType === "shape") {
        handlers.updateShapeLabels(obj as Rect);
      }
      if (objectType === "line") {
        handlers.updateLineLabel(obj as Line);
      }
    },
    [handlers],
  );

  const handleObjectRotating = useCallback(
    (opt: { target: unknown }) => {
      const obj = opt.target;
      if (!obj) return;
      const objectType = getFabricProp(obj as Rect, "objectType");
      if (objectType === "shape") {
        handlers.updateShapeLabels(obj as Rect);
      }
    },
    [handlers],
  );

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    canvas.on("mouse:down", handleMouseDown as never);
    canvas.on("mouse:move", handleMouseMove as never);
    canvas.on("mouse:up", handleMouseUp as never);
    canvas.on("object:modified", handleObjectModified as never);
    canvas.on("object:scaling", handleObjectScaling as never);
    canvas.on("object:moving", handleObjectMoving as never);
    canvas.on("object:rotating", handleObjectRotating as never);

    return () => {
      canvas.off("mouse:down", handleMouseDown as never);
      canvas.off("mouse:move", handleMouseMove as never);
      canvas.off("mouse:up", handleMouseUp as never);
      canvas.off("object:modified", handleObjectModified as never);
      canvas.off("object:scaling", handleObjectScaling as never);
      canvas.off("object:moving", handleObjectMoving as never);
      canvas.off("object:rotating", handleObjectRotating as never);
    };
  }, [
    fabricCanvasRef,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleObjectModified,
    handleObjectScaling,
    handleObjectMoving,
    handleObjectRotating,
  ]);
}
