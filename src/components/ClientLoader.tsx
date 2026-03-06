"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

function LoadingSkeleton() {
  return (
    <div className="flex h-screen">
      {/* Sidebar skeleton -- matches Sidebar: w-[340px] bg-planner-sidebar p-5 shrink-0 border-r */}
      <aside className="w-[340px] shrink-0 bg-planner-sidebar p-5 border-r border-planner-accent">
        <Skeleton className="h-8 w-48 bg-planner-accent/50 mb-3" />
        <Skeleton className="h-4 w-64 bg-planner-accent/30 mb-6" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="mb-4">
            <Skeleton className="h-4 w-32 bg-planner-accent/30 mb-2" />
            <Skeleton className="h-10 w-full bg-planner-accent/50" />
          </div>
        ))}
      </aside>
      {/* Main area skeleton -- matches main: flex-1 flex flex-col bg-planner-canvas */}
      <main className="flex-1 flex flex-col bg-planner-canvas">
        {/* Toolbar skeleton -- matches Toolbar: px-5 py-3 bg-planner-sidebar border-b */}
        <div className="flex items-center gap-3 px-5 py-3 bg-planner-sidebar border-b border-planner-accent">
          <Skeleton className="h-7 w-20 bg-planner-accent/50" />
          <Skeleton className="h-4 w-32 bg-planner-accent/30" />
        </div>
        {/* Canvas area placeholder */}
        <div className="flex-1 flex items-center justify-center">
          <p className="text-planner-text-secondary text-sm animate-pulse">
            Loading canvas…
          </p>
        </div>
        {/* StatusBar skeleton -- matches StatusBar: px-5 py-2 bg-planner-sidebar border-t */}
        <div className="px-5 py-2 bg-planner-sidebar border-t border-planner-accent">
          <Skeleton className="h-3 w-40 bg-planner-accent/30" />
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
  return <PlannerApp />;
}
