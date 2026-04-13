import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TaskBoard } from "./TaskBoard";
import { TaskList } from "./TaskList";
import { TaskDetail } from "./TaskDetail";
import { TaskForm } from "./TaskForm";
import { useTasksStore } from "@/stores/tasks-store";
import { useProjectsStore } from "@/stores/projects-store";
import { APP_CONFIGS } from "@/types/workspace";
import type { Task } from "@/types/tasks";

const config = APP_CONFIGS.tasks;

type View = "board" | "list";

const VIEW_OPTIONS = [
  { value: "board" as const, label: "Board" },
  { value: "list" as const, label: "List" },
] as const;

export function TasksApp() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("board");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        await Promise.all([
          useTasksStore.getState().loadViaRest(),
          useProjectsStore.getState().loadViaRest(),
        ]);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load tasks");
      }
      if (!cancelled) setReady(true);
      useTasksStore.getState().connect().catch(() => {
        console.warn("Tasks WebSocket failed, using REST");
      });
    }
    init();
    return () => { cancelled = true; };
  }, []);

  if (!ready) {
    return (
      <AppWindowChrome appId="tasks" title={config.title} icon={config.icon} accent={config.accent}>
        <div className="flex items-center justify-center h-full">
          <span className="text-[0.8rem]" style={{ color: "var(--pn-text-secondary)" }}>Loading...</span>
        </div>
      </AppWindowChrome>
    );
  }

  if (selectedTask) {
    return (
      <AppWindowChrome appId="tasks" title={config.title} icon={config.icon} accent={config.accent} breadcrumb={selectedTask.title}>
        <TaskDetail task={selectedTask} onClose={() => setSelectedTask(null)} />
      </AppWindowChrome>
    );
  }

  return (
    <AppWindowChrome appId="tasks" title={config.title} icon={config.icon} accent={config.accent} breadcrumb={view}>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-[0.9rem] font-semibold"
            style={{ color: "var(--pn-text-primary)" }}
          >
            Tasks
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowForm(!showForm)}
              className="text-[0.65rem] font-medium px-2.5 py-1 rounded"
              style={{
                background: "rgba(107, 149, 240, 0.12)",
                color: "#6b95f0",
              }}
            >
              {showForm ? "Cancel" : "+ New Task"}
            </button>
            <SegmentedControl options={VIEW_OPTIONS} value={view} onChange={setView} />
          </div>
        </div>

        {error && (
          <div className="mb-3 px-3 py-2 rounded-lg text-[0.7rem]" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
            {error}
          </div>
        )}

        {showForm && (
          <div
            className="glass-surface rounded-lg p-3 mb-4"
          >
            <TaskForm onClose={() => setShowForm(false)} />
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-auto">
          {view === "board" ? (
            <TaskBoard onSelectTask={setSelectedTask} />
          ) : (
            <TaskList onSelectTask={setSelectedTask} />
          )}
        </div>
      </div>
    </AppWindowChrome>
  );
}
