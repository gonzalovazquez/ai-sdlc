"use client";

import { useCallback, useState } from "react";
import { useProjects } from "./context/projects-context";
import { ProjectSidebar } from "./components/project-sidebar";
import { ProjectView } from "./components/project-view";
import { NewProjectDialog } from "./components/new-project-dialog";

export default function Home() {
  const [showNewProject, setShowNewProject] = useState(false);
  const { createProject } = useProjects();

  const handleCreateProject = useCallback(
    async (data: { name: string; description: string; platform: string }) => {
      await createProject(data);
      setShowNewProject(false);
    },
    [createProject]
  );

  return (
    <div className="flex h-screen overflow-hidden">
      <ProjectSidebar onNewProject={() => setShowNewProject(true)} />

      <div className="flex-1 flex flex-col min-w-0">
        <ProjectView onNewProject={() => setShowNewProject(true)} />
      </div>

      <NewProjectDialog
        open={showNewProject}
        onClose={() => setShowNewProject(false)}
        onCreate={handleCreateProject}
      />
    </div>
  );
}
