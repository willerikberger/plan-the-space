"use client";

import { useRef, useState, useCallback } from "react";
import {
  PlannerCanvas,
  type PlannerCanvasHandle,
} from "./canvas/PlannerCanvas";
import { Sidebar } from "./sidebar/Sidebar";
import { Toolbar } from "./ui/Toolbar";
import { StatusBar } from "./ui/StatusBar";
import { ErrorBoundary } from "./ErrorBoundary";

export default function PlannerApp() {
  const canvasRef = useRef<PlannerCanvasHandle>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<number | null>(null);

  // Track selection changes via periodic check (lightweight)
  const handleSelectObject = useCallback((id: number) => {
    canvasRef.current?.selectObject(id);
    setSelectedObjectId(id);
  }, []);

  const handleDeleteObject = useCallback((id: number) => {
    canvasRef.current?.deleteObject(id);
    setSelectedObjectId(null);
  }, []);

  const handleDeleteSelected = useCallback(() => {
    canvasRef.current?.deleteSelected();
    setSelectedObjectId(null);
  }, []);

  const handleClearAll = useCallback(() => {
    if (
      window.confirm(
        "Clear all shapes, lines and images? (Background and masks will be kept)",
      )
    ) {
      canvasRef.current?.clearAll();
      setSelectedObjectId(null);
    }
  }, []);

  const handleClearStorage = useCallback(() => {
    if (window.confirm("Clear saved project from browser storage?")) {
      canvasRef.current?.clearStorage();
    }
  }, []);

  return (
    <ErrorBoundary>
      <div className="flex h-screen">
        <Sidebar
          // Images
          onLoadImage={(f) => canvasRef.current?.loadBackgroundImage(f)}
          // Calibration
          onStartCalibration={() => canvasRef.current?.startCalibration()}
          onCancelCalibration={() => canvasRef.current?.cancelCalibration()}
          onApplyCalibration={(m) => canvasRef.current?.applyCalibration(m)}
          // Shapes
          onAddShape={(n, w, h) => canvasRef.current?.addShape(n, w, h)}
          // Lines
          onStartDrawLine={() => canvasRef.current?.startLineDrawing()}
          onCancelDrawLine={() => canvasRef.current?.cancelLineDrawing()}
          // Overlay images
          onAddOverlayImage={(f) => canvasRef.current?.addOverlayImage(f)}
          // Cleanup
          onEnterCleanupMode={() => canvasRef.current?.enterCleanupMode()}
          onExitCleanupMode={() => canvasRef.current?.exitCleanupMode()}
          onDrawMask={() => canvasRef.current?.startDrawingMask()}
          onAddCleanupImage={(f) => canvasRef.current?.addCleanupImage(f)}
          // Objects
          selectedObjectId={selectedObjectId}
          onSelectObject={handleSelectObject}
          onDeleteObject={handleDeleteObject}
          onDeleteSelected={handleDeleteSelected}
          onClearAll={handleClearAll}
          onMoveObjectUp={(id) => canvasRef.current?.moveObjectUp(id)}
          onMoveObjectDown={(id) => canvasRef.current?.moveObjectDown(id)}
          // Storage
          onSave={() => canvasRef.current?.save()}
          onLoad={() => canvasRef.current?.load()}
          onClear={handleClearStorage}
          onExport={() => canvasRef.current?.exportJson()}
          onImport={(f) => canvasRef.current?.importJson(f)}
          onToggleAutoSave={() => canvasRef.current?.toggleAutoSave()}
        />
        <main className="flex-1 flex flex-col bg-planner-canvas">
          <Toolbar
            onUndo={() => canvasRef.current?.undo()}
            onRedo={() => canvasRef.current?.redo()}
          />
          <PlannerCanvas ref={canvasRef} />
          <StatusBar />
        </main>
      </div>
    </ErrorBoundary>
  );
}
