import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProjectCard } from "@/components/project/ProjectCard";
import { ProjectPicker } from "@/components/project/ProjectPicker";
import type { ProjectListItem } from "@/lib/types";

const makeProject = (
  overrides: Partial<ProjectListItem> = {},
): ProjectListItem => ({
  id: crypto.randomUUID(),
  name: "Test Project",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  deletedAt: null,
  thumbnailDataUrl: null,
  ...overrides,
});

describe("ProjectCard", () => {
  it("renders project name and relative time", () => {
    const project = makeProject({ name: "Garden Plan" });
    render(
      <ProjectCard
        project={project}
        onOpen={vi.fn()}
        onRename={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("Garden Plan")).toBeInTheDocument();
    expect(screen.getByText("Just now")).toBeInTheDocument();
  });

  it("calls onOpen when clicked", () => {
    const onOpen = vi.fn();
    const project = makeProject();
    render(
      <ProjectCard
        project={project}
        onOpen={onOpen}
        onRename={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Open project/i }));
    expect(onOpen).toHaveBeenCalledWith(project.id);
  });

  it("shows menu with Rename, Duplicate, Delete options", () => {
    const project = makeProject();
    render(
      <ProjectCard
        project={project}
        onOpen={vi.fn()}
        onRename={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    // Open menu
    fireEvent.click(screen.getByLabelText("Project menu"));
    expect(screen.getByText("Rename")).toBeInTheDocument();
    expect(screen.getByText("Duplicate")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("fires onDelete when Delete is clicked", () => {
    const onDelete = vi.fn();
    const project = makeProject();
    render(
      <ProjectCard
        project={project}
        onOpen={vi.fn()}
        onRename={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByLabelText("Project menu"));
    fireEvent.click(screen.getByText("Delete"));
    expect(onDelete).toHaveBeenCalledWith(project.id);
  });
});

describe("ProjectPicker", () => {
  const defaultProps = {
    onCreateProject: vi.fn(),
    onOpenProject: vi.fn(),
    onRenameProject: vi.fn(),
    onDuplicateProject: vi.fn(),
    onDeleteProject: vi.fn(),
    onRestoreProject: vi.fn(),
    onPermanentDeleteProject: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows empty state when no projects", () => {
    render(<ProjectPicker projects={[]} {...defaultProps} />);
    expect(screen.getByText("No projects yet")).toBeInTheDocument();
    expect(screen.getByText("Create Your First Project")).toBeInTheDocument();
  });

  it("renders project cards sorted by updatedAt desc", () => {
    const projects = [
      makeProject({
        name: "Older",
        updatedAt: "2024-01-01T00:00:00Z",
      }),
      makeProject({
        name: "Newer",
        updatedAt: "2025-01-01T00:00:00Z",
      }),
    ];
    render(<ProjectPicker projects={projects} {...defaultProps} />);
    const cards = screen.getAllByText(/Older|Newer/);
    // Newer should come first
    expect(cards[0].textContent).toBe("Newer");
    expect(cards[1].textContent).toBe("Older");
  });

  it("hides deleted projects from main grid", () => {
    const projects = [
      makeProject({ name: "Active" }),
      makeProject({ name: "Deleted", deletedAt: new Date().toISOString() }),
    ];
    render(<ProjectPicker projects={projects} {...defaultProps} />);
    expect(screen.getByText("Active")).toBeInTheDocument();
    // Deleted appears only in trash section
    expect(screen.getByText("Trash (1)")).toBeInTheDocument();
  });

  it("fires onCreateProject from New Project button", () => {
    render(<ProjectPicker projects={[]} {...defaultProps} />);
    fireEvent.click(screen.getByText("Create Your First Project"));
    expect(defaultProps.onCreateProject).toHaveBeenCalled();
  });

  it("expands trash section and shows Restore + Delete Forever buttons", () => {
    const projects = [
      makeProject({ name: "Trashed", deletedAt: new Date().toISOString() }),
    ];
    render(<ProjectPicker projects={projects} {...defaultProps} />);
    fireEvent.click(screen.getByText("Trash (1)"));
    expect(screen.getByText("Trashed")).toBeInTheDocument();
    expect(screen.getByLabelText("Restore")).toBeInTheDocument();
    expect(screen.getByLabelText("Delete Forever")).toBeInTheDocument();
  });

  it("fires onRestoreProject when Restore is clicked", () => {
    const project = makeProject({
      name: "Trashed",
      deletedAt: new Date().toISOString(),
    });
    render(<ProjectPicker projects={[project]} {...defaultProps} />);
    fireEvent.click(screen.getByText("Trash (1)"));
    fireEvent.click(screen.getByLabelText("Restore"));
    expect(defaultProps.onRestoreProject).toHaveBeenCalledWith(project.id);
  });
});
