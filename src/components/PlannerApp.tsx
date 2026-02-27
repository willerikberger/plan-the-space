"use client";

import { useRef, useState, useCallback, useMemo } from "react";
import {
  PlannerCanvas,
  type PlannerCanvasHandle,
} from "./canvas/PlannerCanvas";
import { Sidebar } from "./sidebar/Sidebar";
import {
  SidebarProvider,
  type SidebarCallbacks,
} from "./sidebar/SidebarContext";
import { Toolbar } from "./ui/Toolbar";
import { StatusBar } from "./ui/StatusBar";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { ErrorBoundary } from "./ErrorBoundary";

export default function PlannerApp() {
  const canvasRef = useRef<PlannerCanvasHandle>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<number | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: "",
    description: "",
    confirmLabel: "",
    onConfirm: () => {},
  });

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
    setConfirmDialog({
      open: true,
      title: "Clear All Objects",
      description:
        "Clear all shapes, lines and images? Background and masks will be kept.",
      confirmLabel: "Clear All",
      onConfirm: () => {
        canvasRef.current?.clearAll();
        setSelectedObjectId(null);
      },
    });
  }, []);

  const handleClearStorage = useCallback(() => {
    setConfirmDialog({
      open: true,
      title: "Clear Storage",
      description: "Clear saved project from browser storage?",
      confirmLabel: "Clear Storage",
      onConfirm: () => {
        canvasRef.current?.clearStorage();
      },
    });
  }, []);

  const sidebarCallbacks = useMemo<SidebarCallbacks>(
    () => ({
      onLoadImage: (f) => canvasRef.current?.loadBackgroundImage(f),
      onStartCalibration: () => canvasRef.current?.startCalibration(),
      onCancelCalibration: () => canvasRef.current?.cancelCalibration(),
      onApplyCalibration: (m) => canvasRef.current?.applyCalibration(m),
      onAddShape: (n, w, h) => canvasRef.current?.addShape(n, w, h),
      onStartDrawLine: () => canvasRef.current?.startLineDrawing(),
      onCancelDrawLine: () => canvasRef.current?.cancelLineDrawing(),
      onAddOverlayImage: (f) => canvasRef.current?.addOverlayImage(f),
      onEnterCleanupMode: () => canvasRef.current?.enterCleanupMode(),
      onExitCleanupMode: () => canvasRef.current?.exitCleanupMode(),
      onDrawMask: () => canvasRef.current?.startDrawingMask(),
      onAddCleanupImage: (f) => canvasRef.current?.addCleanupImage(f),
      selectedObjectId,
      onSelectObject: handleSelectObject,
      onDeleteObject: handleDeleteObject,
      onDeleteSelected: handleDeleteSelected,
      onClearAll: handleClearAll,
      onMoveObjectUp: (id) => canvasRef.current?.moveObjectUp(id),
      onMoveObjectDown: (id) => canvasRef.current?.moveObjectDown(id),
      onSave: () => canvasRef.current?.save(),
      onLoad: () => canvasRef.current?.load(),
      onClear: handleClearStorage,
      onExport: () => canvasRef.current?.exportJson(),
      onImport: (f) => canvasRef.current?.importJson(f),
      onToggleAutoSave: () => canvasRef.current?.toggleAutoSave(),
    }),
    [
      selectedObjectId,
      handleSelectObject,
      handleDeleteObject,
      handleDeleteSelected,
      handleClearAll,
      handleClearStorage,
    ],
  );

  return (
    <ErrorBoundary>
      <div className="flex h-screen">
        <SidebarProvider value={sidebarCallbacks}>
          <Sidebar />
        </SidebarProvider>
        <main className="flex-1 flex flex-col bg-planner-canvas">
          <Toolbar
            onUndo={() => canvasRef.current?.undo()}
            onRedo={() => canvasRef.current?.redo()}
          />
          <PlannerCanvas ref={canvasRef} />
          <StatusBar />
        </main>
      </div>
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel={confirmDialog.confirmLabel}
        onConfirm={confirmDialog.onConfirm}
      />
    </ErrorBoundary>
  );
}
