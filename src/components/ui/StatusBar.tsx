"use client";

import { usePlannerStore } from "@/lib/store";

export function StatusBar() {
  const message = usePlannerStore((s) => s.statusMessage);

  return (
    <div className="px-5 py-2 bg-planner-sidebar text-xs text-planner-text-muted border-t border-planner-accent">
      {message}
    </div>
  );
}
