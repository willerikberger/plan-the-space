"use client";

import { useState, useCallback } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileInput } from "@/components/ui/FileInput";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePlannerStore } from "@/lib/store";
import { useSidebarContext } from "./SidebarContext";
import { CalibrationPanel } from "./CalibrationPanel";
import { ShapePanel } from "./ShapePanel";
import { LinePanel } from "./LinePanel";
import { ImagePanel } from "./ImagePanel";
import { CleanupPanel } from "./CleanupPanel";
import { ObjectList } from "./ObjectList";
import { StoragePanel } from "./StoragePanel";

export function Sidebar() {
  const ctx = useSidebarContext();
  const mode = usePlannerStore((s) => s.mode);
  const isCleanup = mode === "cleanup" || mode === "drawing-mask";
  const [open, setOpen] = useState(false);

  const closeSidebar = useCallback(() => setOpen(false), []);

  return (
    <>
      {/* Mobile toggle button */}
      <button
        className="fixed top-3 left-3 z-50 p-2 rounded-md bg-planner-sidebar border border-planner-accent md:hidden"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? "Close sidebar" : "Open sidebar"}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Backdrop overlay on mobile */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={closeSidebar}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-[340px] bg-planner-sidebar p-5 overflow-y-auto shrink-0 border-r border-planner-accent
          transition-transform duration-200 ease-in-out
          md:static md:translate-x-0
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <h1 className="text-xl font-bold text-planner-primary mb-1">
          Plan the Space
        </h1>
        <p className="text-xs text-planner-text-muted mb-6">
          Design your space to scale
        </p>

        {/* Mode Toggle */}
        <div className="mb-4" role="group" aria-label="Canvas mode">
          <div className="flex bg-planner-accent rounded-md overflow-hidden">
            <button
              aria-pressed={!isCleanup}
              className={`flex-1 py-2.5 text-sm transition-colors ${
                !isCleanup ? "bg-planner-primary" : "hover:bg-planner-hover"
              }`}
              onClick={() => isCleanup && ctx.onExitCleanupMode()}
            >
              Normal Mode
            </button>
            <button
              aria-pressed={isCleanup}
              className={`flex-1 py-2.5 text-sm transition-colors ${
                isCleanup ? "bg-planner-primary" : "hover:bg-planner-hover"
              }`}
              onClick={() => !isCleanup && ctx.onEnterCleanupMode()}
            >
              Cleanup Mode
            </button>
          </div>
        </div>

        {/* Cleanup Panel */}
        {isCleanup && (
          <CleanupPanel
            onDrawMask={ctx.onDrawMask}
            onExitCleanup={ctx.onExitCleanupMode}
            onAddCleanupImage={ctx.onAddCleanupImage}
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
                onChange={ctx.onLoadImage}
                label="Choose Image"
              />
            </div>

            {/* 2. Set Scale */}
            <CalibrationPanel
              onStartCalibration={ctx.onStartCalibration}
              onCancelCalibration={ctx.onCancelCalibration}
              onApplyCalibration={ctx.onApplyCalibration}
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
                  <ShapePanel onAddShape={ctx.onAddShape} />
                </TabsContent>
                <TabsContent value="lines">
                  <LinePanel
                    onStartDrawLine={ctx.onStartDrawLine}
                    onCancelDrawLine={ctx.onCancelDrawLine}
                  />
                </TabsContent>
                <TabsContent value="images">
                  <ImagePanel onAddOverlayImage={ctx.onAddOverlayImage} />
                </TabsContent>
              </Tabs>
            </div>

            {/* Objects */}
            <ObjectList
              selectedObjectId={ctx.selectedObjectId}
              onSelect={ctx.onSelectObject}
              onDelete={ctx.onDeleteObject}
              onMoveUp={ctx.onMoveObjectUp}
              onMoveDown={ctx.onMoveObjectDown}
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
                  onClick={ctx.onDeleteSelected}
                  disabled={!ctx.selectedObjectId}
                >
                  Delete Selected
                </Button>
                <Button variant="secondary" size="sm" onClick={ctx.onClearAll}>
                  Clear All
                </Button>
              </div>
            </div>

            {/* Storage */}
            <StoragePanel
              onSave={ctx.onSave}
              onLoad={ctx.onLoad}
              onClear={ctx.onClear}
              onExport={ctx.onExport}
              onImport={ctx.onImport}
              onToggleAutoSave={ctx.onToggleAutoSave}
            />
          </>
        )}
      </aside>
    </>
  );
}
