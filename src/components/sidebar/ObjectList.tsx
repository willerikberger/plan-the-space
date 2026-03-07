"use client";

import { memo, useMemo } from "react";
import { ArrowDown, ArrowUp, ImageIcon, Ruler, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  usePlannerStore,
  selectVisibleObjects,
  selectRenderOrder,
} from "@/lib/store";
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
      return <Square className="size-4" aria-hidden="true" />;
    case "line":
      return <Ruler className="size-4" aria-hidden="true" />;
    default:
      return <ImageIcon className="size-4" aria-hidden="true" />;
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

export const ObjectList = memo(function ObjectList({
  selectedObjectId,
  onSelect,
  onDelete,
  onMoveUp,
  onMoveDown,
}: ObjectListProps) {
  const visibleObjects = usePlannerStore(selectVisibleObjects);
  const renderOrder = usePlannerStore(selectRenderOrder);
  const visibleIdSet = useMemo(
    () => new Set(visibleObjects.map((obj) => obj.id)),
    [visibleObjects],
  );
  const orderedContentIdsBottomFirst = useMemo(
    () => renderOrder.filter((id) => visibleIdSet.has(id)),
    [renderOrder, visibleIdSet],
  );
  const orderedContentIdsTopFirst = useMemo(
    () => [...orderedContentIdsBottomFirst].reverse(),
    [orderedContentIdsBottomFirst],
  );
  const objectById = useMemo(() => {
    const map = new Map<number, PlannerObject>();
    for (const obj of visibleObjects) map.set(obj.id, obj);
    return map;
  }, [visibleObjects]);
  const orderedObjects = useMemo(
    () =>
      orderedContentIdsTopFirst
        .map((id) => objectById.get(id))
        .filter((obj): obj is PlannerObject => Boolean(obj)),
    [orderedContentIdsTopFirst, objectById],
  );
  const indexByObjectId = useMemo(() => {
    const map = new Map<number, number>();
    orderedContentIdsTopFirst.forEach((id, index) => {
      map.set(id, index);
    });
    return map;
  }, [orderedContentIdsTopFirst]);

  return (
    <div className="mb-6" data-testid="object-list">
      <h2 className="text-xs uppercase tracking-wide text-planner-primary mb-3 pb-2 border-b border-planner-accent font-semibold flex items-center gap-2">
        Objects
        <Badge
          variant="secondary"
          className="text-[10px]"
          data-testid="object-count"
        >
          {visibleObjects.length}
        </Badge>
      </h2>
      {visibleObjects.length === 0 ? (
        <p
          className="text-planner-text-dim text-sm"
          data-testid="object-list-empty"
        >
          No objects yet. Set the scale, then add shapes or lines above.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {orderedObjects.map((obj) => {
            const isSelected = selectedObjectId === obj.id;
            const color = objectColor(obj);
            const layerIndex = indexByObjectId.get(obj.id);
            const canMoveUp = layerIndex != null && layerIndex > 0;
            const canMoveDown =
              layerIndex != null &&
              layerIndex < orderedContentIdsTopFirst.length - 1;
            return (
              <div
                key={obj.id}
                data-testid={`object-item-${obj.id}`}
                className={cn(
                  "flex items-center gap-2 p-2.5 bg-planner-accent rounded-md text-sm",
                  isSelected && "border-2 border-planner-primary",
                )}
              >
                <span className="w-5 text-center shrink-0">
                  <ObjectIcon type={obj.type} />
                </span>
                {color && (
                  <span
                    className="size-4 rounded shrink-0"
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
                    type="button"
                    aria-label={`Move ${obj.name} up`}
                    className="size-6 p-0"
                    disabled={!canMoveUp}
                    onClick={() => onMoveUp(obj.id)}
                  >
                    <ArrowUp className="size-3.5" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    aria-label={`Move ${obj.name} down`}
                    className="size-6 p-0"
                    disabled={!canMoveDown}
                    onClick={() => onMoveDown(obj.id)}
                  >
                    <ArrowDown className="size-3.5" />
                  </Button>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    className="h-6 px-2 text-[10px]"
                    onClick={() => onSelect(obj.id)}
                  >
                    Select
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    type="button"
                    aria-label={`Delete ${obj.name}`}
                    className="min-w-[44px] min-h-[44px] h-6 px-2 text-[10px]"
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
});
