/**
 * @module useFabricCanvas
 * @description Initializes and manages the Fabric.js canvas instance lifecycle.
 * Creates the Canvas on mount, handles window resize, and disposes on unmount.
 * @dependencies fabric (Canvas), constants (CANVAS_BG)
 * @usage Called from PlannerCanvas as the foundational hook; provides fabricCanvasRef consumed by all other canvas hooks.
 */
"use client";

import { useRef, useEffect, useCallback } from "react";
import { Canvas } from "fabric";
import { CANVAS_BG } from "@/lib/constants";

export function useFabricCanvas() {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<Canvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const initCanvas = useCallback(() => {
    if (!canvasElRef.current || !containerRef.current) return null;
    if (fabricCanvasRef.current) return fabricCanvasRef.current;

    const container = containerRef.current;
    const canvas = new Canvas(canvasElRef.current, {
      width: container.clientWidth,
      height: container.clientHeight,
      backgroundColor: CANVAS_BG,
      selection: true,
      preserveObjectStacking: true,
    });

    fabricCanvasRef.current = canvas;
    return canvas;
  }, []);

  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      const canvas = fabricCanvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      canvas.setDimensions({
        width: container.clientWidth,
        height: container.clientHeight,
      });
      canvas.renderAll();
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      fabricCanvasRef.current?.dispose();
      fabricCanvasRef.current = null;
    };
  }, []);

  return {
    canvasElRef,
    containerRef,
    fabricCanvasRef,
    initCanvas,
  };
}
