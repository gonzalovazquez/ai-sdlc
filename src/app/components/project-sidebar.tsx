"use client";

import { useProjects } from "../context/projects-context";
import { ProjectSidebarItem } from "./project-sidebar-item";
import { ProviderToggle } from "./provider-toggle";

interface ProjectSidebarProps {
  onNewProject: () => void;
}

export function ProjectSidebar({ onNewProject }: ProjectSidebarProps) {
  const { projects, activeProjectId, streamStates, setActiveProject } =
    useProjects();

  const attentionCount = projects.filter(
    (p) => streamStates[p.id]?.awaitingApproval && p.id !== activeProjectId
  ).length;

  return (
    <aside className="w-60 shrink-0 border-r border-zinc-200 dark:border-zinc-800 flex flex-col h-full bg-zinc-50/50 dark:bg-zinc-900/50">
      {/* Header */}
      <div className="px-3 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={onNewProject}
          className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + New Project
        </button>
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {projects.length === 0 ? (
          <div className="text-xs text-zinc-400 text-center py-8 px-3">
            No projects yet. Create one to get started.
          </div>
        ) : (
          projects.map((project) => (
            <ProjectSidebarItem
              key={project.id}
              project={project}
              streamState={streamStates[project.id]}
              isActive={project.id === activeProjectId}
              onClick={() => setActiveProject(project.id)}
            />
          ))
        )}
      </div>

      {/* Notification summary */}
      {attentionCount > 0 && (
        <div className="px-3 py-2 border-t border-zinc-200 dark:border-zinc-800">
          <div className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            {attentionCount} project{attentionCount > 1 ? "s" : ""} awaiting
            review
          </div>
        </div>
      )}

      <ProviderToggle />
    </aside>
  );
}
