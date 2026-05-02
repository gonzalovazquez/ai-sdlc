"use client";

import type { Project, ProjectStreamState } from "../context/projects-context";

const PHASE_COLORS: Record<string, string> = {
  intake: "bg-zinc-400",
  planning: "bg-purple-500",
  architecture: "bg-orange-500",
  design: "bg-pink-500",
  infrastructure: "bg-teal-500",
  review: "bg-amber-500",
  code: "bg-green-500",
  qa: "bg-yellow-500",
  release: "bg-indigo-500",
  monitoring: "bg-red-500",
};

interface ProjectSidebarItemProps {
  project: Project;
  streamState: ProjectStreamState | undefined;
  isActive: boolean;
  onClick: () => void;
}

export function ProjectSidebarItem({
  project,
  streamState,
  isActive,
  onClick,
}: ProjectSidebarItemProps) {
  const phase = streamState?.currentPhase || project.currentPhase;
  const needsAttention = streamState?.awaitingApproval && !isActive;
  const isStreaming = streamState?.isStreaming;

  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left px-3 py-2.5 rounded-lg transition-colors relative
        ${isActive
          ? "bg-zinc-100 dark:bg-zinc-800"
          : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
        }
      `}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium truncate">{project.name}</span>
        {needsAttention && (
          <span className="shrink-0 w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
        )}
        {isStreaming && !needsAttention && (
          <span className="shrink-0 w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        )}
      </div>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-[10px] text-zinc-400 uppercase">
          {project.platform}
        </span>
        <span
          className={`inline-block w-1.5 h-1.5 rounded-full ${
            PHASE_COLORS[phase] || "bg-zinc-400"
          }`}
        />
        <span className="text-[10px] text-zinc-500 truncate">{phase}</span>
      </div>
    </button>
  );
}
