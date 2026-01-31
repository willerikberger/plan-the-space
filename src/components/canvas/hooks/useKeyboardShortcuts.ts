/**
 * @module useKeyboardShortcuts
 * @description Binds global keyboard shortcuts for Delete, Escape, Undo (Ctrl/Cmd+Z), and Redo (Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y).
 * Uses a ref-based pattern so the event listener always sees the latest closure without re-subscribing.
 * @dependencies store (mode)
 * @usage Called from PlannerCanvas with action callbacks for delete, cancel, undo, and redo.
 */
"use client";

import { useEffect, useRef } from "react";
import type { Canvas } from "fabric";
import { usePlannerStore } from "@/lib/store";

export function useKeyboardShortcuts(
  fabricCanvasRef: React.RefObject<Canvas | null>,
  actions: {
    cancelCalibration: () => void;
    cancelLineDrawing: () => void;
    deleteSelected: () => void;
    undo: () => Promise<void>;
    redo: () => Promise<void>;
  },
) {
  // Register a single stable keydown listener once on mount.
  // The handler reads the latest actions/refs via the closure captured
  // by actionsRef, which is updated in the effect below every render cycle.
  const actionsRef = useRef(actions);
  const canvasRef = useRef(fabricCanvasRef);

  useEffect(() => {
    actionsRef.current = actions;
    canvasRef.current = fabricCanvasRef;
  });

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      const canvas = canvasRef.current.current;
      if (!canvas) return;
      const target = e.target as HTMLElement;

      // Skip when focused on input elements
      const isInputFocused =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA";

      if ((e.key === "Delete" || e.key === "Backspace") && !isInputFocused) {
        e.preventDefault();
        actionsRef.current.deleteSelected();
      }

      if (e.key === "Escape") {
        const mode = usePlannerStore.getState().mode;
        if (mode === "calibrating") actionsRef.current.cancelCalibration();
        if (mode === "drawing-line") actionsRef.current.cancelLineDrawing();
        if (mode === "drawing-mask") {
          usePlannerStore.getState().setMode("cleanup");
          canvas.defaultCursor = "default";
          canvas.selection = true;
        }
        canvas.discardActiveObject();
        canvas.renderAll();
      }

      // Undo: Ctrl+Z / Cmd+Z
      if (
        e.key === "z" &&
        (e.metaKey || e.ctrlKey) &&
        !e.shiftKey &&
        !isInputFocused
      ) {
        e.preventDefault();
        actionsRef.current.undo();
      }

      // Redo: Ctrl+Shift+Z / Cmd+Shift+Z or Ctrl+Y / Cmd+Y
      if (
        ((e.key === "z" || e.key === "Z") &&
          (e.metaKey || e.ctrlKey) &&
          e.shiftKey &&
          !isInputFocused) ||
        (e.key === "y" && (e.metaKey || e.ctrlKey) && !isInputFocused)
      ) {
        e.preventDefault();
        actionsRef.current.redo();
      }
    };

    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, []);
}
