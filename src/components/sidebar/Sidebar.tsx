"use client";

import { Button } from "@/components/ui/button";
import { FileInput } from "@/components/ui/FileInput";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePlannerStore } from "@/lib/store";
import { CalibrationPanel } from "./CalibrationPanel";
import { ShapePanel } from "./ShapePanel";
import { LinePanel } from "./LinePanel";
import { ImagePanel } from "./ImagePanel";
import { CleanupPanel } from "./CleanupPanel";
import { ObjectList } from "./ObjectList";
import { StoragePanel } from "./StoragePanel";

interface SidebarProps {
  // Canvas hooks
  onLoadImage: (file: File) => void;
  onStartCalibration: () => void;
  onCancelCalibration: () => void;
  onApplyCalibration: (meters: number) => void;
  onAddShape: (name: string, widthM: number, heightM: number) => void;
  onStartDrawLine: () => void;
  onCancelDrawLine: () => void;
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
  onImport: (file: File) => void;
  onToggleAutoSave: () => void;
}

export function Sidebar(props: SidebarProps) {
  const mode = usePlannerStore((s) => s.mode);
  const isCleanup = mode === "cleanup" || mode === "drawing-mask";

  return (
    <aside className="w-[340px] bg-planner-sidebar p-5 overflow-y-auto shrink-0 border-r border-planner-accent">
      <h1 className="text-xl font-bold text-planner-primary mb-1">
        Plan the Space
      </h1>
      <p className="text-xs text-planner-text-muted mb-6">
        Design your space to scale
      </p>

      {/* Mode Toggle */}
      <div className="mb-4">
        <div className="flex bg-planner-accent rounded-md overflow-hidden">
          <button
            className={`flex-1 py-2.5 text-sm transition-colors ${
              !isCleanup ? "bg-planner-primary" : "hover:bg-planner-hover"
            }`}
            onClick={() => isCleanup && props.onExitCleanupMode()}
          >
            Normal Mode
          </button>
          <button
            className={`flex-1 py-2.5 text-sm transition-colors ${
              isCleanup ? "bg-planner-primary" : "hover:bg-planner-hover"
            }`}
            onClick={() => !isCleanup && props.onEnterCleanupMode()}
          >
            Cleanup Mode
          </button>
        </div>
      </div>

      {/* Cleanup Panel */}
      {isCleanup && (
        <CleanupPanel
          onDrawMask={props.onDrawMask}
          onExitCleanup={props.onExitCleanupMode}
          onAddCleanupImage={props.onAddCleanupImage}
        />
      )}

      {/* Normal Mode Content */}
      {!isCleanup && (
        <>
          {/* 1. Load Floor Plan */}
          <div className="mb-6">
            <h2 className="text-xs uppercase tracking-wide text-planner-primary mb-3 pb-2 border-b border-planner-accent font-semibold">
              1. Load Floor Plan
            </h2>
            <label className="text-planner-text-secondary text-xs block mb-1.5">
              Upload Image
            </label>
            <FileInput
              accept="image/*"
              onChange={props.onLoadImage}
              label="Choose Image"
            />
          </div>

          {/* 2. Set Scale */}
          <CalibrationPanel
            onStartCalibration={props.onStartCalibration}
            onCancelCalibration={props.onCancelCalibration}
            onApplyCalibration={props.onApplyCalibration}
          />

          {/* 3. Add Content */}
          <div className="mb-6">
            <h2 className="text-xs uppercase tracking-wide text-planner-primary mb-3 pb-2 border-b border-planner-accent font-semibold">
              3. Add Content
            </h2>
            <Tabs defaultValue="shapes">
              <TabsList className="w-full mb-3 bg-planner-accent">
                <TabsTrigger value="shapes" className="flex-1 text-xs">
                  Shapes
                </TabsTrigger>
                <TabsTrigger value="lines" className="flex-1 text-xs">
                  Lines
                </TabsTrigger>
                <TabsTrigger value="images" className="flex-1 text-xs">
                  Images
                </TabsTrigger>
              </TabsList>
              <TabsContent value="shapes">
                <ShapePanel onAddShape={props.onAddShape} />
              </TabsContent>
              <TabsContent value="lines">
                <LinePanel
                  onStartDrawLine={props.onStartDrawLine}
                  onCancelDrawLine={props.onCancelDrawLine}
                />
              </TabsContent>
              <TabsContent value="images">
                <ImagePanel onAddOverlayImage={props.onAddOverlayImage} />
              </TabsContent>
            </Tabs>
          </div>

          {/* Objects */}
          <ObjectList
            selectedObjectId={props.selectedObjectId}
            onSelect={props.onSelectObject}
            onDelete={props.onDeleteObject}
            onMoveUp={props.onMoveObjectUp}
            onMoveDown={props.onMoveObjectDown}
          />

          {/* Actions */}
          <div className="mb-6">
            <h2 className="text-xs uppercase tracking-wide text-planner-primary mb-3 pb-2 border-b border-planner-accent font-semibold">
              Actions
            </h2>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={props.onDeleteSelected}
                disabled={!props.selectedObjectId}
              >
                Delete Selected
              </Button>
              <Button variant="secondary" size="sm" onClick={props.onClearAll}>
                Clear All
              </Button>
            </div>
          </div>

          {/* Storage */}
          <StoragePanel
            onSave={props.onSave}
            onLoad={props.onLoad}
            onClear={props.onClear}
            onExport={props.onExport}
            onImport={props.onImport}
            onToggleAutoSave={props.onToggleAutoSave}
          />
        </>
      )}
    </aside>
  );
}
