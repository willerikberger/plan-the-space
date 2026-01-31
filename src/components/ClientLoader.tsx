"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";

function LoadingSkeleton() {
  return (
    <div className="flex h-screen">
      {/* Sidebar skeleton -- matches Sidebar: w-[340px] bg-planner-sidebar p-5 shrink-0 border-r */}
      <aside className="w-[340px] shrink-0 bg-planner-sidebar p-5 border-r border-planner-accent">
        <div className="h-8 w-48 animate-pulse rounded bg-planner-accent/50 mb-3" />
        <div className="h-4 w-64 animate-pulse rounded bg-planner-accent/30 mb-6" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="mb-4">
            <div className="h-4 w-32 animate-pulse rounded bg-planner-accent/30 mb-2" />
            <div className="h-10 w-full animate-pulse rounded bg-planner-accent/50" />
          </div>
        ))}
      </aside>
      {/* Main area skeleton -- matches main: flex-1 flex flex-col bg-planner-canvas */}
      <main className="flex-1 flex flex-col bg-planner-canvas">
        {/* Toolbar skeleton -- matches Toolbar: px-5 py-3 bg-planner-sidebar border-b */}
        <div className="flex items-center gap-3 px-5 py-3 bg-planner-sidebar border-b border-planner-accent">
          <div className="h-7 w-20 animate-pulse rounded bg-planner-accent/50" />
          <div className="h-4 w-32 animate-pulse rounded bg-planner-accent/30" />
        </div>
        {/* Canvas area placeholder */}
        <div className="flex-1 flex items-center justify-center">
          <p className="text-planner-text-secondary text-sm animate-pulse">
            Loading canvas…
          </p>
        </div>
        {/* StatusBar skeleton -- matches StatusBar: px-5 py-2 bg-planner-sidebar border-t */}
        <div className="px-5 py-2 bg-planner-sidebar border-t border-planner-accent">
          <div className="h-3 w-40 animate-pulse rounded bg-planner-accent/30" />
        </div>
      </main>
    </div>
  );
}

const PlannerApp = dynamic(() => import("@/components/PlannerApp"), {
  ssr: false,
  loading: () => <LoadingSkeleton />,
});

export function ClientLoader() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <PlannerApp />
    </Suspense>
  );
}
