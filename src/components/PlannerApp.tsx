"use client";

import { useRef, useState, useCallback, useMemo, useEffect } from "react";
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
import { ProjectPicker } from "./project/ProjectPicker";
import {
  NewProjectWizard,
  type NewProjectResult,
} from "./project/NewProjectWizard";
import { usePlannerStore } from "@/lib/store";
import { getDefaultAdapter } from "@/lib/storage/indexeddb";
import {
  initializeApp,
  createProject,
  openProject,
  renameProject,
  duplicateProject,
  softDeleteProjectOp,
  permanentDeleteProjectOp,
  restoreProjectOp,
} from "@/lib/projectOperations";

export default function PlannerApp() {
  const canvasRef = useRef<PlannerCanvasHandle>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<number | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
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

  const activeView = usePlannerStore((s) => s.activeView);
  const projects = usePlannerStore((s) => s.projects);
  const activeProjectId = usePlannerStore((s) => s.activeProjectId);

  const activeProjectName = useMemo(() => {
    if (!activeProjectId) return null;
    return projects.find((p) => p.id === activeProjectId)?.name ?? null;
  }, [activeProjectId, projects]);

  const adapter = useMemo(() => getDefaultAdapter(), []);

  // Initialize app on mount
  useEffect(() => {
    initializeApp(adapter);
  }, [adapter]);

  const handleCreateProject = useCallback(() => {
    setWizardOpen(true);
  }, []);

  const handleWizardComplete = useCallback(
    async (result: NewProjectResult) => {
      setWizardOpen(false);
      await createProject(adapter, {
        name: result.name,
        description: result.description,
      });
      // If a background image was selected, load it after the canvas mounts
      if (result.backgroundImage) {
        // Small delay to let canvas mount
        setTimeout(() => {
          canvasRef.current?.loadBackgroundImage(result.backgroundImage!);
        }, 100);
      }
    },
    [adapter],
  );

  const handleOpenProject = useCallback(
    async (id: string) => {
      await openProject(adapter, id);
      // Load project data onto canvas after view switches
      setTimeout(() => {
        canvasRef.current?.load();
      }, 100);
    },
    [adapter],
  );

  const handleGoHome = useCallback(() => {
    usePlannerStore.getState().setActiveView("picker");
    usePlannerStore.getState().setActiveProjectId(null);
  }, []);

  const handleRenameProject = useCallback(
    (id: string) => {
      const project = projects.find((p) => p.id === id);
      if (!project) return;
      const newName = prompt("Rename project:", project.name);
      if (newName && newName.trim()) {
        renameProject(adapter, id, newName.trim());
      }
    },
    [adapter, projects],
  );

  const handleDuplicateProject = useCallback(
    async (id: string) => {
      await duplicateProject(adapter, id);
    },
    [adapter],
  );

  const handleDeleteProject = useCallback(
    async (id: string) => {
      await softDeleteProjectOp(adapter, id);
    },
    [adapter],
  );

  const handleRestoreProject = useCallback(
    async (id: string) => {
      await restoreProjectOp(adapter, id);
    },
    [adapter],
  );

  const handlePermanentDeleteProject = useCallback(
    async (id: string) => {
      await permanentDeleteProjectOp(adapter, id);
    },
    [adapter],
  );

  // Canvas callbacks
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

  // Render based on activeView
  if (activeView === "picker") {
    return (
      <ErrorBoundary>
        <ProjectPicker
          projects={projects}
          onCreateProject={handleCreateProject}
          onOpenProject={handleOpenProject}
          onRenameProject={handleRenameProject}
          onDuplicateProject={handleDuplicateProject}
          onDeleteProject={handleDeleteProject}
          onRestoreProject={handleRestoreProject}
          onPermanentDeleteProject={handlePermanentDeleteProject}
        />
        <NewProjectWizard
          open={wizardOpen}
          onClose={() => setWizardOpen(false)}
          onComplete={handleWizardComplete}
        />
      </ErrorBoundary>
    );
  }

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
            onGoHome={handleGoHome}
            projectName={activeProjectName}
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
      <NewProjectWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onComplete={handleWizardComplete}
      />
    </ErrorBoundary>
  );
}
