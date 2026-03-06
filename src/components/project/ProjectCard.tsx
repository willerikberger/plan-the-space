"use client";

import { useState } from "react";
import { MoreVertical, Copy, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProjectListItem } from "@/lib/types";

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

interface ProjectCardProps {
  project: ProjectListItem;
  onOpen: (id: string) => void;
  onRename: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ProjectCard({
  project,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
}: ProjectCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className="group relative bg-planner-sidebar border border-planner-accent rounded-lg overflow-hidden cursor-pointer hover:border-planner-primary transition-colors"
      onClick={() => onOpen(project.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(project.id);
        }
      }}
      aria-label={`Open project ${project.name}`}
    >
      {/* Thumbnail */}
      <div className="h-32 bg-planner-accent/30 flex items-center justify-center">
        {project.thumbnailDataUrl ? (
          <img
            src={project.thumbnailDataUrl}
            alt={project.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-planner-text-muted text-3xl">📐</span>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="text-sm font-medium text-planner-text truncate">
          {project.name}
        </h3>
        <p className="text-xs text-planner-text-muted mt-1">
          {formatRelativeTime(project.updatedAt)}
        </p>
      </div>

      {/* Menu button */}
      <div className="absolute top-2 right-2">
        <Button
          variant="ghost"
          size="icon-xs"
          className="opacity-0 group-hover:opacity-100 transition-opacity text-planner-text-muted hover:text-planner-text"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(!menuOpen);
          }}
          aria-label="Project menu"
        >
          <MoreVertical size={14} />
        </Button>

        {menuOpen && (
          <div
            className="absolute right-0 mt-1 w-36 bg-planner-sidebar border border-planner-accent rounded-md shadow-lg z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-planner-text hover:bg-planner-accent transition-colors"
              onClick={() => {
                setMenuOpen(false);
                onRename(project.id);
              }}
            >
              <Pencil size={12} /> Rename
            </button>
            <button
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-planner-text hover:bg-planner-accent transition-colors"
              onClick={() => {
                setMenuOpen(false);
                onDuplicate(project.id);
              }}
            >
              <Copy size={12} /> Duplicate
            </button>
            <button
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-400 hover:bg-planner-accent transition-colors"
              onClick={() => {
                setMenuOpen(false);
                onDelete(project.id);
              }}
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
