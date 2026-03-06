"use client";

import { useState, useMemo } from "react";
import { Plus, Trash2, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ProjectCard } from "./ProjectCard";
import type { ProjectListItem } from "@/lib/types";

interface ProjectPickerProps {
  projects: ProjectListItem[];
  onCreateProject: () => void;
  onOpenProject: (id: string) => void;
  onRenameProject: (id: string) => void;
  onDuplicateProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onRestoreProject: (id: string) => void;
  onPermanentDeleteProject: (id: string) => void;
}

export function ProjectPicker({
  projects,
  onCreateProject,
  onOpenProject,
  onRenameProject,
  onDuplicateProject,
  onDeleteProject,
  onRestoreProject,
  onPermanentDeleteProject,
}: ProjectPickerProps) {
  const [trashOpen, setTrashOpen] = useState(false);

  const activeProjects = useMemo(
    () =>
      projects
        .filter((p) => !p.deletedAt)
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        ),
    [projects],
  );

  const trashedProjects = useMemo(
    () => projects.filter((p) => p.deletedAt),
    [projects],
  );

  return (
    <div className="h-screen bg-planner-bg flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6 border-b border-planner-accent">
        <h1 className="text-xl font-semibold text-planner-text">
          Plan the Space
        </h1>
        <Button
          onClick={onCreateProject}
          size="sm"
          data-testid="new-project-btn"
        >
          <Plus size={16} />
          New Project
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-8 py-6">
        {activeProjects.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center h-64 text-center"
            data-testid="empty-projects"
          >
            <p className="text-planner-text-muted text-lg mb-4">
              No projects yet
            </p>
            <Button onClick={onCreateProject}>
              <Plus size={16} />
              Create Your First Project
            </Button>
          </div>
        ) : (
          <div
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
            data-testid="project-grid"
          >
            {activeProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={onOpenProject}
                onRename={onRenameProject}
                onDuplicate={onDuplicateProject}
                onDelete={onDeleteProject}
              />
            ))}
          </div>
        )}

        {/* Trash section */}
        {trashedProjects.length > 0 && (
          <div className="mt-8 pt-4">
            <Separator className="mb-4 bg-planner-accent" />
            <button
              className="flex items-center gap-2 text-sm text-planner-text-muted hover:text-planner-text transition-colors"
              onClick={() => setTrashOpen(!trashOpen)}
              data-testid="trash-toggle"
            >
              <Trash2 size={14} />
              Trash ({trashedProjects.length})
            </button>

            {trashOpen && (
              <div className="mt-4 flex flex-col gap-2">
                {trashedProjects.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between px-4 py-3 bg-planner-sidebar/50 border border-planner-accent rounded-md"
                  >
                    <span className="text-sm text-planner-text-muted">
                      {project.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => onRestoreProject(project.id)}
                        aria-label="Restore"
                      >
                        <RotateCcw size={12} /> Restore
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        className="text-red-400 hover:text-red-300"
                        onClick={() => onPermanentDeleteProject(project.id)}
                        aria-label="Delete Forever"
                      >
                        <X size={12} /> Delete Forever
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
