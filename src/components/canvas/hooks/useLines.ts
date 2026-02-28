/**
 * @module useLines
 * @description Handles drawing, snapping, and managing measurement lines on the Fabric canvas.
 * Lines snap to 45-degree angles and display real-world length labels computed from the calibration scale.
 * @dependencies fabricHelpers (createDrawingLine, createLineLabel, getFabricProp, setFabricProps), geometry (snapTo45Degrees, distance, roundToDecimal, midpoint), store, constants (MIN_LINE_LENGTH_PX), types (LineFabricRefs)
 * @usage Called from PlannerCanvas; line-drawing callbacks are routed through useCanvasEvents and startLineDrawing is exposed via the imperative handle.
 */
"use client";

import { useRef, useCallback } from "react";
import { Line as FabricLine } from "fabric";
import type { Canvas, Line, FabricText } from "fabric";
import { usePlannerStore } from "@/lib/store";
import {
  createDrawingLine,
  createLineLabel,
  getFabricProp,
  setFabricProps,
} from "@/components/canvas/utils/fabricHelpers";
import {
  snapTo45Degrees,
  distance,
  roundToDecimal,
  midpoint,
} from "@/components/canvas/utils/geometry";
import {
  canvasToWorld,
  worldToCanvas,
} from "@/components/canvas/utils/coordinates";
import { MIN_LINE_LENGTH_PX } from "@/lib/constants";
import type { Point, LineFabricRefs } from "@/lib/types";

export interface UseLinesReturn {
  lineStartRef: React.RefObject<Point | null>;
  startLineDrawing: () => void;
  cancelLineDrawing: () => void;
  handleLineDrawStart: (pointer: Point) => void;
  updateDrawingLine: (pointer: Point) => void;
  finishDrawingLine: () => void;
  updateLineLabel: (line: Line) => void;
  loadLine: (data: {
    left: number;
    top: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    lengthM: number;
    color: string;
    strokeWidth?: number;
    scaleX?: number;
    scaleY?: number;
    angle?: number;
    name: string;
    worldX1?: number;
    worldY1?: number;
    worldX2?: number;
    worldY2?: number;
  }) => void;
}

export function useLines(
  fabricCanvasRef: React.RefObject<Canvas | null>,
  fabricRefsRef: React.RefObject<Map<number, LineFabricRefs>>,
): UseLinesReturn {
  const lineStartRef = useRef<Point | null>(null);
  const currentLineRef = useRef<Line | null>(null);
  const currentLabelRef = useRef<FabricText | null>(null);

  const setObjectsSelectable = useCallback(
    (selectable: boolean) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;
      const store = usePlannerStore.getState();
      for (const obj of store.objects.values()) {
        if (obj.type !== "mask" && obj.type !== "backgroundImage") {
          for (const fo of canvas.getObjects()) {
            if (getFabricProp(fo, "objectId") === obj.id) {
              fo.set("selectable", selectable);
            }
          }
        }
      }
    },
    [fabricCanvasRef],
  );

  const startLineDrawing = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    lineStartRef.current = null;
    currentLineRef.current = null;
    currentLabelRef.current = null;

    usePlannerStore.getState().setMode("drawing-line");
    usePlannerStore
      .getState()
      .setStatusMessage(
        "Click and drag to draw. Lines snap to 45\u00b0 angles.",
      );
    canvas.defaultCursor = "crosshair";
    canvas.selection = false;
    setObjectsSelectable(false);
  }, [fabricCanvasRef, setObjectsSelectable]);

  const cancelLineDrawing = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    if (currentLineRef.current) canvas.remove(currentLineRef.current);
    if (currentLabelRef.current) canvas.remove(currentLabelRef.current);
    currentLineRef.current = null;
    currentLabelRef.current = null;
    lineStartRef.current = null;

    usePlannerStore.getState().setMode("normal");
    usePlannerStore.getState().setStatusMessage("Ready");
    canvas.defaultCursor = "default";
    canvas.selection = true;
    setObjectsSelectable(true);
  }, [fabricCanvasRef, setObjectsSelectable]);

  const handleLineDrawStart = useCallback(
    (pointer: Point) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;
      const store = usePlannerStore.getState();

      lineStartRef.current = { x: pointer.x, y: pointer.y };

      const line = createDrawingLine({
        x1: pointer.x,
        y1: pointer.y,
        x2: pointer.x,
        y2: pointer.y,
        stroke: store.selectedLineColor,
        strokeWidth: store.lineWidth,
      });

      const label = createLineLabel({
        text: "0.0m",
        left: pointer.x,
        top: pointer.y - 20,
        fill: store.selectedLineColor,
      });

      currentLineRef.current = line;
      currentLabelRef.current = label;
      canvas.add(line, label);
    },
    [fabricCanvasRef],
  );

  const updateDrawingLine = useCallback(
    (pointer: Point) => {
      const canvas = fabricCanvasRef.current;
      const line = currentLineRef.current;
      const label = currentLabelRef.current;
      const start = lineStartRef.current;
      if (!canvas || !line || !label || !start) return;

      const snapped = snapTo45Degrees(start.x, start.y, pointer.x, pointer.y);
      line.set({ x2: snapped.x, y2: snapped.y });

      const pxLen = distance(start, snapped);
      const store = usePlannerStore.getState();
      const meterLen = store.pixelsPerMeter
        ? roundToDecimal(pxLen / store.pixelsPerMeter, 1)
        : 0;
      const mid = midpoint(start, snapped);

      label.set({ text: `${meterLen}m`, left: mid.x, top: mid.y - 15 });
      canvas.renderAll();
      store.setStatusMessage(`Line length: ${meterLen}m`);
    },
    [fabricCanvasRef],
  );

  const finishDrawingLine = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    const line = currentLineRef.current;
    const label = currentLabelRef.current;
    const start = lineStartRef.current;
    if (!canvas || !line || !label || !start) return;

    const x1 = line.x1!;
    const y1 = line.y1!;
    const x2 = line.x2!;
    const y2 = line.y2!;
    const pxLen = distance({ x: x1, y: y1 }, { x: x2, y: y2 });

    if (pxLen < MIN_LINE_LENGTH_PX) {
      canvas.remove(line);
      canvas.remove(label);
      currentLineRef.current = null;
      currentLabelRef.current = null;
      lineStartRef.current = null;
      usePlannerStore.getState().setStatusMessage("Line too short, cancelled");
      return;
    }

    const store = usePlannerStore.getState();
    const meterLen = store.pixelsPerMeter
      ? roundToDecimal(pxLen / store.pixelsPerMeter, 1)
      : 0;
    const id = store.nextObjectId();
    const lineName = `Line ${id + 1}`;
    const lineColor = store.selectedLineColor;

    line.set({ selectable: true, evented: true });
    setFabricProps(line, {
      objectId: id,
      objectType: "line",
      lineName,
      lineColor,
      lengthM: meterLen,
    });

    label.set({ text: `${meterLen}m` });
    setFabricProps(label, {
      objectType: "lineLabel",
      parentId: id,
    });

    fabricRefsRef.current.set(id, { type: "line", line, label });

    // Compute world coordinates if camera is available
    const camera = store.camera;
    const worldCoords = camera
      ? {
          worldX1: canvasToWorld(x1, y1, camera).x,
          worldY1: canvasToWorld(x1, y1, camera).y,
          worldX2: canvasToWorld(x2, y2, camera).x,
          worldY2: canvasToWorld(x2, y2, camera).y,
        }
      : {};

    store.addObject({
      id,
      type: "line",
      name: lineName,
      lengthM: meterLen,
      color: lineColor,
      ...worldCoords,
    });

    currentLineRef.current = null;
    currentLabelRef.current = null;
    lineStartRef.current = null;

    store.setStatusMessage(
      `Added "${lineName}" (${meterLen}m) - Click to draw another line`,
    );
  }, [fabricCanvasRef, fabricRefsRef]);

  const updateLineLabel = useCallback(
    (line: Line) => {
      const id = getFabricProp(line, "objectId");
      if (id == null) return;
      const refs = fabricRefsRef.current.get(id);
      if (!refs || refs.type !== "line") return;

      const x1 = (line.x1 ?? 0) + (line.left ?? 0);
      const y1 = (line.y1 ?? 0) + (line.top ?? 0);
      const x2 = (line.x2 ?? 0) + (line.left ?? 0);
      const y2 = (line.y2 ?? 0) + (line.top ?? 0);
      const mid = midpoint({ x: x1, y: y1 }, { x: x2, y: y2 });

      refs.label.set({ left: mid.x, top: mid.y - 15 });
    },
    [fabricRefsRef],
  );

  const loadLine = useCallback(
    (data: {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      left: number;
      top: number;
      color: string;
      strokeWidth?: number;
      scaleX?: number;
      scaleY?: number;
      angle?: number;
      name: string;
      lengthM: number;
      worldX1?: number;
      worldY1?: number;
      worldX2?: number;
      worldY2?: number;
    }) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;
      const store = usePlannerStore.getState();
      const camera = store.camera;
      const id = store.nextObjectId();

      // If world coords available and camera exists, compute pixel positions
      let lineX1 = data.x1;
      let lineY1 = data.y1;
      let lineX2 = data.x2;
      let lineY2 = data.y2;
      let lineLeft = data.left;
      let lineTop = data.top;

      if (
        data.worldX1 != null &&
        data.worldY1 != null &&
        data.worldX2 != null &&
        data.worldY2 != null &&
        camera
      ) {
        const p1 = worldToCanvas({ x: data.worldX1, y: data.worldY1 }, camera);
        const p2 = worldToCanvas({ x: data.worldX2, y: data.worldY2 }, camera);
        // Fabric lines: x1/y1/x2/y2 are relative to left/top
        lineLeft = Math.min(p1.x, p2.x);
        lineTop = Math.min(p1.y, p2.y);
        lineX1 = p1.x - lineLeft;
        lineY1 = p1.y - lineTop;
        lineX2 = p2.x - lineLeft;
        lineY2 = p2.y - lineTop;
      }

      const line = new FabricLine([lineX1, lineY1, lineX2, lineY2], {
        left: lineLeft,
        top: lineTop,
        stroke: data.color,
        strokeWidth: data.strokeWidth ?? 3,
        strokeLineCap: "round",
        scaleX: data.scaleX ?? 1,
        scaleY: data.scaleY ?? 1,
        angle: data.angle ?? 0,
        objectId: id,
        objectType: "line",
        lineName: data.name,
        lineColor: data.color,
        lengthM: data.lengthM,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const absX1 = lineX1 + lineLeft;
      const absY1 = lineY1 + lineTop;
      const absX2 = lineX2 + lineLeft;
      const absY2 = lineY2 + lineTop;
      const mid = midpoint({ x: absX1, y: absY1 }, { x: absX2, y: absY2 });

      const label = createLineLabel({
        text: `${data.lengthM}m`,
        left: mid.x,
        top: mid.y - 15,
        fill: data.color,
        parentId: id,
      });

      canvas.add(line, label);
      fabricRefsRef.current.set(id, { type: "line", line, label });

      store.addObject({
        id,
        type: "line",
        name: data.name,
        lengthM: data.lengthM,
        color: data.color,
        ...(data.worldX1 != null ? { worldX1: data.worldX1 } : {}),
        ...(data.worldY1 != null ? { worldY1: data.worldY1 } : {}),
        ...(data.worldX2 != null ? { worldX2: data.worldX2 } : {}),
        ...(data.worldY2 != null ? { worldY2: data.worldY2 } : {}),
      });
    },
    [fabricCanvasRef, fabricRefsRef],
  );

  return {
    lineStartRef,
    startLineDrawing,
    cancelLineDrawing,
    handleLineDrawStart,
    updateDrawingLine,
    finishDrawingLine,
    updateLineLabel,
    loadLine,
  };
}
