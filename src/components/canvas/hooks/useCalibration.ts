/**
 * @module useCalibration
 * @description Manages the calibration workflow for setting the pixels-per-meter scale.
 * Lets the user draw a reference line on the canvas, then input the real-world length to compute scale.
 * @dependencies fabricHelpers (createCalibrationLine, createCalibrationEndpoint, getFabricProp), geometry (distance), store, constants (MIN_LINE_LENGTH_PX)
 * @usage Called from PlannerCanvas; calibration callbacks are routed through useCanvasEvents and exposed via the imperative handle to the sidebar.
 */
"use client";

import { useRef, useCallback } from "react";
import type { Canvas, Line, Circle } from "fabric";
import { usePlannerStore } from "@/lib/store";
import {
  createCalibrationLine,
  createCalibrationEndpoint,
  getFabricProp,
} from "@/components/canvas/utils/fabricHelpers";
import { distance } from "@/components/canvas/utils/geometry";
import { MIN_LINE_LENGTH_PX } from "@/lib/constants";
import type { Point } from "@/lib/types";

export function useCalibration(
  fabricCanvasRef: React.RefObject<Canvas | null>,
) {
  const startPointRef = useRef<Point | null>(null);
  const lineRef = useRef<Line | null>(null);
  const startCircleRef = useRef<Circle | null>(null);
  const endCircleRef = useRef<Circle | null>(null);

  const setObjectsSelectable = useCallback(
    (selectable: boolean) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;
      const store = usePlannerStore.getState();
      for (const obj of store.objects.values()) {
        if (obj.type !== "mask" && obj.type !== "backgroundImage") {
          // Find fabric objects by objectId
          const fabObjs = canvas.getObjects();
          for (const fo of fabObjs) {
            if (getFabricProp(fo, "objectId") === obj.id) {
              fo.set("selectable", selectable);
            }
          }
        }
      }
    },
    [fabricCanvasRef],
  );

  const startCalibration = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    startPointRef.current = null;
    lineRef.current = null;

    usePlannerStore.getState().setMode("calibrating");
    usePlannerStore.getState().setStatusMessage("Calibrating - Click and drag");
    canvas.defaultCursor = "crosshair";
    canvas.selection = false;
    setObjectsSelectable(false);
  }, [fabricCanvasRef, setObjectsSelectable]);

  const cancelCalibration = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    if (startCircleRef.current) canvas.remove(startCircleRef.current);
    if (endCircleRef.current) canvas.remove(endCircleRef.current);
    if (lineRef.current) canvas.remove(lineRef.current);
    startCircleRef.current = null;
    endCircleRef.current = null;
    lineRef.current = null;
    startPointRef.current = null;

    const store = usePlannerStore.getState();
    store.setMode("normal");
    store.setShowCalibrationInput(false);
    store.setCalibrationPixelLength(null);
    store.setStatusMessage(store.pixelsPerMeter ? "Ready" : "No Scale Set");
    canvas.defaultCursor = "default";
    canvas.selection = true;
    setObjectsSelectable(true);
  }, [fabricCanvasRef, setObjectsSelectable]);

  const handleCalibrationClick = useCallback(
    (pointer: Point) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas || startPointRef.current) return;

      startPointRef.current = { x: pointer.x, y: pointer.y };
      const line = createCalibrationLine({
        x1: pointer.x,
        y1: pointer.y,
        x2: pointer.x,
        y2: pointer.y,
      });
      lineRef.current = line;
      canvas.add(line);
    },
    [fabricCanvasRef],
  );

  const updateCalibrationLine = useCallback(
    (pointer: Point) => {
      const canvas = fabricCanvasRef.current;
      const line = lineRef.current;
      const start = startPointRef.current;
      if (!canvas || !line || !start) return;

      line.set({ x2: pointer.x, y2: pointer.y });
      canvas.renderAll();
      const pxLen = distance(start, pointer);
      usePlannerStore
        .getState()
        .setStatusMessage(
          `Drawing calibration line: ${Math.round(pxLen)} pixels`,
        );
    },
    [fabricCanvasRef],
  );

  const finishCalibrationLine = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    const line = lineRef.current;
    if (!canvas || !line) return;

    const x1 = line.x1!;
    const y1 = line.y1!;
    const x2 = line.x2!;
    const y2 = line.y2!;
    const pxLen = distance({ x: x1, y: y1 }, { x: x2, y: y2 });

    if (pxLen < MIN_LINE_LENGTH_PX) {
      canvas.remove(line);
      lineRef.current = null;
      startPointRef.current = null;
      usePlannerStore.getState().setStatusMessage("Line too short. Try again.");
      return;
    }

    const sc = createCalibrationEndpoint(x1, y1);
    const ec = createCalibrationEndpoint(x2, y2);
    startCircleRef.current = sc;
    endCircleRef.current = ec;
    canvas.add(sc, ec);

    const store = usePlannerStore.getState();
    store.setCalibrationPixelLength(pxLen);
    store.setShowCalibrationInput(true);
    store.setStatusMessage(`Line: ${Math.round(pxLen)}px. Enter meters.`);
  }, [fabricCanvasRef]);

  const applyCalibration = useCallback(
    (realLengthMeters: number) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      const store = usePlannerStore.getState();
      const pxLen = store.calibrationPixelLength;
      if (!pxLen || realLengthMeters <= 0) return;

      const ppm = pxLen / realLengthMeters;
      store.setPixelsPerMeter(ppm);

      // Clean up calibration visuals
      if (startCircleRef.current) canvas.remove(startCircleRef.current);
      if (endCircleRef.current) canvas.remove(endCircleRef.current);
      if (lineRef.current) canvas.remove(lineRef.current);
      startCircleRef.current = null;
      endCircleRef.current = null;
      lineRef.current = null;
      startPointRef.current = null;

      store.setMode("normal");
      store.setShowCalibrationInput(false);
      store.setCalibrationPixelLength(null);
      store.setStatusMessage(`Scale: 1m = ${Math.round(ppm)}px`);
      canvas.defaultCursor = "default";
      canvas.selection = true;
      setObjectsSelectable(true);
    },
    [fabricCanvasRef, setObjectsSelectable],
  );

  return {
    startPointRef,
    startCalibration,
    cancelCalibration,
    handleCalibrationClick,
    updateCalibrationLine,
    finishCalibrationLine,
    applyCalibration,
  };
}
