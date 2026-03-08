"use client";

import { createContext, useContext } from "react";

export interface SidebarCallbacks {
  // Images
  onLoadImage: (file: File) => void;
  // Calibration
  onStartCalibration: () => void;
  onCancelCalibration: () => void;
  onApplyCalibration: (meters: number) => void;
  // Shapes
  onAddShape: (name: string, widthM: number, heightM: number) => void;
  // Lines
  onStartDrawLine: () => void;
  onCancelDrawLine: () => void;
  // Overlay images
  onAddOverlayImage: (file: File) => void;
  // Cleanup
  onEnterCleanupMode: () => void;
  onExitCleanupMode: () => void;
  onDrawMask: () => void;
  onAddCleanupImage: (file: File) => void;
  // Objects
  selectedObjectId: number | null;
  onSelectObject: (id: number) => void;
  onDeleteObject: (id: number) => void;
  onDeleteSelected: () => void;
  onClearAll: () => void;
  onMoveObjectUp: (id: number) => void;
  onMoveObjectDown: (id: number) => void;
  // Storage
  onSave: () => void;
  onLoad: () => void;
  onClear: () => void;
  onExport: () => void;
  onImport: (file: File) => void | Promise<void>;
  onImportShapes: (file: File) => void | Promise<void>;
  onToggleAutoSave: () => void;
}

const SidebarContext = createContext<SidebarCallbacks | null>(null);

export const SidebarProvider = SidebarContext.Provider;

export function useSidebarContext(): SidebarCallbacks {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    throw new Error("useSidebarContext must be used within a SidebarProvider");
  }
  return ctx;
}
