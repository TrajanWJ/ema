import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { ProjectGrid } from "./ProjectGrid";
import { ProjectDetail } from "./ProjectDetail";
import { ProjectForm } from "./ProjectForm";
import { useProjectsStore } from "@/stores/projects-store";
import { useTasksStore } from "@/stores/tasks-store";
import { useProposalsStore } from "@/stores/proposals-store";
import { APP_CONFIGS } from "@/types/workspace";
import type { Project } from "@/types/projects";

const config = APP_CONFIGS.projects;

export function ProjectsApp() {
  const [ready, setReady] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      await Promise.all([
        useProjectsStore.getState().loadViaRest(),
        useTasksStore.getState().loadViaRest(),
        useProposalsStore.getState().loadViaRest(),
      ]);
      if (!cancelled) setReady(true);
      Promise.all([
        useProjectsStore.getState().connect(),
        useTasksStore.getState().connect(),
        useProposalsStore.getState().connect(),
      ]).catch(() => {
        console.warn("Projects WebSocket failed, using REST");
      });
    }
    init();
    return () => { cancelled = true; };
  }, []);

  if (!ready) {
    return (
      <AppWindowChrome appId="projects" title={config.title} icon={config.icon} accent={config.accent}>
        <div className="flex items-center justify-center h-full">
          <span className="text-[0.8rem]" style={{ color: "var(--pn-text-secondary)" }}>Loading...</span>
        </div>
      </AppWindowChrome>
    );
  }

  const breadcrumb = selectedProject ? selectedProject.name : showForm ? "New" : "All";

  return (
    <AppWindowChrome appId="projects" title={config.title} icon={config.icon} accent={config.accent} breadcrumb={breadcrumb}>
      <div className="flex flex-col h-full">
        {selectedProject ? (
          <ProjectDetail
            project={selectedProject}
            onBack={() => setSelectedProject(null)}
          />
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2
                className="text-[0.9rem] font-semibold"
                style={{ color: "var(--pn-text-primary)" }}
              >
                Projects
              </h2>
              <button
                onClick={() => setShowForm(!showForm)}
                className="text-[0.65rem] font-medium px-2.5 py-1 rounded"
                style={{
                  background: "rgba(45, 212, 168, 0.12)",
                  color: "#2dd4a8",
                }}
              >
                {showForm ? "Cancel" : "+ New Project"}
              </button>
            </div>

            {showForm && (
              <div
                className="glass-surface rounded-lg p-3 mb-4"
                style={{ border: "1px solid var(--pn-border-subtle)" }}
              >
                <ProjectForm onClose={() => setShowForm(false)} />
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-auto">
              <ProjectGrid onSelectProject={setSelectedProject} />
            </div>
          </>
        )}
      </div>
    </AppWindowChrome>
  );
}
