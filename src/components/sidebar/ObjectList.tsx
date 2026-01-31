"use client";

import { Button } from "@/components/ui/button";
import { useShallow } from "zustand/react/shallow";
import { usePlannerStore, selectVisibleObjects } from "@/lib/store";
import type { PlannerObject } from "@/lib/types";

interface ObjectListProps {
  selectedObjectId: number | null;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
  onMoveUp: (id: number) => void;
  onMoveDown: (id: number) => void;
}

function ObjectIcon({ type }: { type: PlannerObject["type"] }) {
  switch (type) {
    case "shape":
      return <span>\u2b1c</span>;
    case "line":
      return <span>\ud83d\udccf</span>;
    default:
      return <span>\ud83d\uddbc\ufe0f</span>;
  }
}

function ObjectDims({ obj }: { obj: PlannerObject }) {
  if (obj.type === "shape")
    return (
      <>
        {obj.widthM}m &times; {obj.heightM}m
      </>
    );
  if (obj.type === "line") return <>{obj.lengthM}m</>;
  return <>Image</>;
}

function objectColor(obj: PlannerObject): string | null {
  if (obj.type === "shape") return obj.color.replace("0.6", "1");
  if (obj.type === "line") return obj.color;
  return null;
}

export function ObjectList({
  selectedObjectId,
  onSelect,
  onDelete,
  onMoveUp,
  onMoveDown,
}: ObjectListProps) {
  const visibleObjects = usePlannerStore(useShallow(selectVisibleObjects));

  return (
    <div className="mb-6">
      <h2 className="text-xs uppercase tracking-wide text-planner-primary mb-3 pb-2 border-b border-planner-accent font-semibold flex items-center gap-2">
        Objects
        <span className="text-[10px] px-1.5 py-0.5 bg-planner-accent rounded text-planner-text-muted">
          {visibleObjects.length}
        </span>
      </h2>
      {visibleObjects.length === 0 ? (
        <p className="text-planner-text-dim text-sm">No objects added yet</p>
      ) : (
        <div className="space-y-2">
          {visibleObjects.map((obj) => {
            const isSelected = selectedObjectId === obj.id;
            const color = objectColor(obj);
            return (
              <div
                key={obj.id}
                className={`flex items-center gap-2 p-2.5 bg-planner-accent rounded-md text-sm ${
                  isSelected ? "border-2 border-planner-primary" : ""
                }`}
              >
                <span className="w-5 text-center shrink-0">
                  <ObjectIcon type={obj.type} />
                </span>
                {color && (
                  <span
                    className="w-4 h-4 rounded shrink-0"
                    style={{ background: color }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="truncate">{obj.name}</div>
                  <div className="text-planner-text-muted text-[10px]">
                    <ObjectDims obj={obj} />
                  </div>
                </div>
                <div className="flex flex-col gap-0.5">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-5 px-1.5 text-[10px]"
                    onClick={() => onMoveUp(obj.id)}
                  >
                    &uarr;
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-5 px-1.5 text-[10px]"
                    onClick={() => onMoveDown(obj.id)}
                  >
                    &darr;
                  </Button>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-6 px-2 text-[10px]"
                    onClick={() => onSelect(obj.id)}
                  >
                    Select
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-6 px-2 text-[10px]"
                    onClick={() => onDelete(obj.id)}
                  >
                    &times;
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
