"use client";

import { memo } from "react";
import { usePlannerStore } from "@/lib/store";

export const StatusBar = memo(function StatusBar() {
  const message = usePlannerStore((s) => s.statusMessage);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="px-5 py-2 bg-planner-sidebar text-xs text-planner-text-muted border-t border-planner-accent"
    >
      {message}
    </div>
  );
});
