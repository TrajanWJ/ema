import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { TaskBoard } from "./TaskBoard";
import { TaskList } from "./TaskList";
import { TaskDetail } from "./TaskDetail";
import { TaskForm } from "./TaskForm";
import { useTasksStore } from "@/stores/tasks-store";
import { useProjectsStore } from "@/stores/projects-store";
import { APP_CONFIGS } from "@/types/workspace";
import type { Task } from "@/types/tasks";
import {
  ActivityTimeline,
  CommandCenterShell,
  GlassButton,
  GlassSurface,
  HeroBanner,
  InspectorSection,
  MetricCard,
  StatStrip,
  TagPill,
  TopNavBar,
} from "@ema/glass";

const config = APP_CONFIGS.tasks;

type View = "board" | "list";

const VIEW_OPTIONS = [
  { id: "board" as const, label: "Board", hint: "Flow by status" },
  { id: "list" as const, label: "List", hint: "Compact rows" },
] as const;

export function TasksApp() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("board");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showForm, setShowForm] = useState(false);
  const tasks = useTasksStore((s) => s.tasks);
  const projects = useProjectsStore((s) => s.projects);

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

  const activeTasks = tasks.filter((task) =>
    !["done", "archived", "cancelled"].includes(task.status),
  );
  const blockedTasks = tasks.filter((task) => task.status === "blocked");
  const reviewTasks = tasks.filter((task) => task.status === "in_review");
  const recentTimeline = [...tasks]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 8)
    .map((task) => ({
      id: task.id,
      title: task.title,
      meta: `${task.status.replace(/_/g, " ")} · ${task.created_at.slice(0, 10)}`,
      body: task.description ?? "No description attached.",
      tone:
        task.status === "blocked"
          ? "var(--color-pn-error)"
          : task.status === "in_review"
            ? "var(--color-pn-warning)"
            : "var(--color-pn-blue-400)",
    }));

  return (
    <CommandCenterShell
      appId="tasks"
      title={config.title}
      icon={config.icon}
      accent={config.accent}
      nav={
        <TopNavBar
          items={VIEW_OPTIONS}
          activeId={view}
          onChange={(value) => setView(value as View)}
          leftSlot={
            <div>
              <div
                style={{
                  fontSize: "0.66rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.16em",
                  color: "var(--pn-text-muted)",
                }}
              >
                Operational Queue
              </div>
              <div style={{ fontSize: "1.08rem", fontWeight: 650 }}>
                Tasks
              </div>
            </div>
          }
          rightSlot={
            <>
              <TagPill
                label={`${projects.length} projects linked`}
                tone="rgba(107,149,240,0.12)"
                color="var(--color-pn-blue-300)"
              />
              <GlassButton
                uiSize="sm"
                variant="primary"
                onClick={() => setShowForm((value) => !value)}
              >
                {showForm ? "Close Form" : "New Task"}
              </GlassButton>
            </>
          }
        />
      }
      hero={
        <HeroBanner
          eyebrow="Task System"
          title="Keep the work queue legible, not just full."
          description="This surface should make it obvious what is active, blocked, in review, and newly arriving. The board and list views are just two lenses over the same operational queue."
          tone="var(--color-pn-blue-400)"
          actions={
            <>
              <TagPill label={`${activeTasks.length} active`} tone="rgba(45,212,168,0.14)" color="var(--color-pn-teal-300)" />
              <TagPill label={`${blockedTasks.length} blocked`} tone="rgba(226,75,74,0.14)" color="var(--color-pn-error)" />
              <TagPill label={`${reviewTasks.length} in review`} tone="rgba(245,158,11,0.14)" color="var(--color-pn-warning)" />
            </>
          }
          aside={
            <div style={{ display: "grid", gap: "var(--pn-space-3)" }}>
              <MetricCard
                label="Tasks"
                value={String(tasks.length)}
                detail="Total items in the current local queue."
                tone="var(--color-pn-blue-400)"
              />
              <MetricCard
                label="Projects"
                value={String(projects.length)}
                detail="Project containers available for routing."
                tone="var(--color-pn-indigo-400)"
              />
            </div>
          }
        />
      }
      metrics={
        <StatStrip
          items={[
            {
              label: "Active",
              value: String(activeTasks.length),
              detail: "Not done, archived, or cancelled",
              tone: "var(--color-pn-teal-400)",
            },
            {
              label: "Blocked",
              value: String(blockedTasks.length),
              detail: "Needs unblock attention",
              tone: "var(--color-pn-error)",
            },
            {
              label: "Review",
              value: String(reviewTasks.length),
              detail: "Pending validation",
              tone: "var(--color-pn-warning)",
            },
          ]}
        />
      }
      content={
        <div className="flex flex-col gap-4">
          {error && (
            <GlassSurface tier="surface" padding="md">
              <div style={{ color: "var(--color-pn-error)", fontSize: "0.8rem" }}>
                {error}
              </div>
            </GlassSurface>
          )}

          {showForm && (
            <GlassSurface tier="surface" padding="md">
              <TaskForm onClose={() => setShowForm(false)} />
            </GlassSurface>
          )}

          <GlassSurface tier="surface" padding="md">
            {view === "board" ? (
              <TaskBoard onSelectTask={setSelectedTask} />
            ) : (
              <TaskList onSelectTask={setSelectedTask} />
            )}
          </GlassSurface>
        </div>
      }
      rail={
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--pn-space-4)" }}>
          <InspectorSection
            title="Recent Queue Activity"
            description="Newest task arrivals and status context."
          >
            <ActivityTimeline items={recentTimeline} emptyLabel="No tasks in the queue." />
          </InspectorSection>
        </div>
      }
    />
  );
}
