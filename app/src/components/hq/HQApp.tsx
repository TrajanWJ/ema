import { useEffect, useState, useCallback } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { api } from "@/lib/api";

const ACCENT = "#6366f1";
const REFRESH_MS = 15_000;

// ── Shared styles ──

const glassCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 10,
  padding: "12px 14px",
};

const sectionHeader: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.8px",
  color: "var(--pn-text-muted)",
  marginBottom: 8,
};

const compactRow: React.CSSProperties = {
  fontSize: 11,
  color: "var(--pn-text-secondary)",
  lineHeight: 1.7,
};

// ── Types ──

interface Project {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly status: string;
  readonly linked_path: string | null;
  readonly task_count?: number;
  readonly intent_count?: number;
}

interface Execution {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly mode: string;
  readonly updated_at: string;
}

interface Actor {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly actor_type: string;
  readonly phase: string | null;
}

interface BrainDumpItem {
  readonly id: string;
  readonly content: string;
  readonly status: string;
  readonly inserted_at: string;
}

interface Intent {
  readonly id: string;
  readonly title: string;
  readonly level: number;
  readonly status: string;
  readonly slug: string;
}

interface Task {
  readonly id: string;
  readonly status: string;
}

// ── Helpers ──

function formatAge(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const STATUS_COLORS: Record<string, string> = {
  running: "#10b981",
  completed: "#22c55e",
  failed: "#ef4444",
  awaiting_approval: "#f59e0b",
  created: "#6b7280",
  proposed: "#8b5cf6",
  approved: "#3b82f6",
  delegated: "#06b6d4",
  cancelled: "#374151",
  harvesting: "#6366f1",
};

const PHASE_COLORS: Record<string, string> = {
  plan: "#3b82f6",
  execute: "#10b981",
  review: "#f59e0b",
  retro: "#8b5cf6",
  idle: "#6b7280",
};

// ── Hook: auto-refreshing fetch ──

function usePolled<T>(path: string, fallback: T): T {
  const [data, setData] = useState<T>(fallback);

  const fetchData = useCallback(() => {
    api.get<T>(path).then(setData).catch(() => {});
  }, [path]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchData]);

  return data;
}

// ── Widgets ──

function StatBar({
  executions,
  brainDumpItems,
  tasks,
}: {
  readonly executions: readonly Execution[];
  readonly brainDumpItems: readonly BrainDumpItem[];
  readonly tasks: readonly Task[];
}) {
  const running = executions.filter((e) => e.status === "running").length;
  const inbox = brainDumpItems.filter((i) => i.status === "unprocessed").length;
  const activeTasks = tasks.filter(
    (t) => !["done", "completed", "cancelled", "archived"].includes(t.status),
  ).length;

  const pills: Array<{ label: string; value: number; color: string }> = [
    { label: "running", value: running, color: "#10b981" },
    { label: "inbox", value: inbox, color: "#6b95f0" },
    { label: "tasks", value: activeTasks, color: "#f59e0b" },
  ];

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {pills.map((p) => (
        <span
          key={p.label}
          style={{
            fontSize: 11,
            padding: "3px 10px",
            borderRadius: 10,
            background: `${p.color}18`,
            color: p.color,
            fontWeight: 500,
            fontFamily: "monospace",
          }}
        >
          {p.value} {p.label}
        </span>
      ))}
    </div>
  );
}

function ProjectCards({
  projects,
}: {
  readonly projects: readonly Project[];
}) {
  if (projects.length === 0) {
    return (
      <div style={glassCard}>
        <div style={sectionHeader}>Projects</div>
        <div style={{ ...compactRow, color: "var(--pn-text-muted)" }}>
          No projects
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={sectionHeader}>Active Projects</div>
      {projects.map((p) => (
        <div key={p.id} style={glassCard}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--pn-text-primary)",
              }}
            >
              {p.name}
            </span>
            <span
              style={{
                fontSize: 10,
                padding: "2px 8px",
                borderRadius: 6,
                background: "rgba(99,102,241,0.15)",
                color: "#818cf8",
                fontWeight: 500,
              }}
            >
              {p.status}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              gap: 12,
              marginTop: 6,
              fontSize: 10,
              color: "var(--pn-text-muted)",
              fontFamily: "monospace",
            }}
          >
            {p.task_count != null && <span>{p.task_count} tasks</span>}
            {p.linked_path && (
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: 180,
                }}
              >
                {p.linked_path}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ExecutionFeed({
  executions,
}: {
  readonly executions: readonly Execution[];
}) {
  const sorted = [...executions]
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    )
    .slice(0, 8);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={sectionHeader}>Execution Feed</div>
      {sorted.length === 0 ? (
        <div style={{ ...compactRow, color: "var(--pn-text-muted)" }}>
          No executions
        </div>
      ) : (
        sorted.map((e) => {
          const color = STATUS_COLORS[e.status] ?? "#6b7280";
          return (
            <div
              key={e.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 10px",
                borderRadius: 6,
                background: "rgba(255,255,255,0.02)",
                borderLeft: `2px solid ${color}`,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: color,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  ...compactRow,
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {e.title}
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: "var(--pn-text-muted)",
                  flexShrink: 0,
                }}
              >
                {formatAge(e.updated_at)}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}

function AgentStatusWidget({
  actors,
}: {
  readonly actors: readonly Actor[];
}) {
  const agents = actors.filter((a) => a.actor_type === "agent");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={sectionHeader}>Agent Status</div>
      {agents.length === 0 ? (
        <div style={{ ...compactRow, color: "var(--pn-text-muted)" }}>
          No agents
        </div>
      ) : (
        agents.map((a) => {
          const phase = a.phase ?? "idle";
          const color = PHASE_COLORS[phase] ?? "#6b7280";
          return (
            <div
              key={a.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "4px 0",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: color,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  ...compactRow,
                  flex: 1,
                  color: "var(--pn-text-primary)",
                  fontWeight: 500,
                }}
              >
                {a.name ?? a.slug}
              </span>
              <span
                style={{
                  fontSize: 10,
                  color,
                  fontWeight: 500,
                }}
              >
                {phase}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}

function BrainDumpWidget({
  items,
}: {
  readonly items: readonly BrainDumpItem[];
}) {
  const unprocessed = items.filter((i) => i.status === "unprocessed");
  const preview = unprocessed.slice(0, 5);

  return (
    <div style={glassCard}>
      <div style={sectionHeader}>
        Brain Dump{" "}
        <span style={{ color: "var(--pn-text-tertiary)" }}>
          {unprocessed.length} unprocessed
        </span>
      </div>
      {preview.length === 0 ? (
        <div style={{ ...compactRow, color: "var(--pn-text-muted)" }}>
          Inbox clear
        </div>
      ) : (
        preview.map((item) => (
          <div
            key={item.id}
            style={{
              ...compactRow,
              padding: "3px 0",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ color: "var(--pn-text-muted)", marginRight: 6 }}>
              •
            </span>
            {item.content}
          </div>
        ))
      )}
    </div>
  );
}

function IntentSnapshot({
  intents,
}: {
  readonly intents: readonly Intent[];
}) {
  const sorted = [...intents].sort((a, b) => a.level - b.level);

  return (
    <div style={glassCard}>
      <div style={sectionHeader}>
        Intents{" "}
        <span style={{ color: "var(--pn-text-tertiary)" }}>
          {intents.length} active
        </span>
      </div>
      {sorted.length === 0 ? (
        <div style={{ ...compactRow, color: "var(--pn-text-muted)" }}>
          No active intents
        </div>
      ) : (
        sorted.map((intent) => (
          <div
            key={intent.id}
            style={{
              ...compactRow,
              padding: "3px 0",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontFamily: "monospace",
                color: "#818cf8",
                flexShrink: 0,
                width: 22,
              }}
            >
              L{intent.level}
            </span>
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {intent.title}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

// ── Main ──

// Wrapper types for API responses that return keyed objects
interface ProjectsResponse {
  readonly projects: readonly Project[];
}
interface ExecutionsResponse {
  readonly executions: readonly Execution[];
}
interface ActorsResponse {
  readonly actors: readonly Actor[];
}
interface BrainDumpResponse {
  readonly items: readonly BrainDumpItem[];
}
interface IntentsResponse {
  readonly intents: readonly Intent[];
}
interface TasksResponse {
  readonly tasks: readonly Task[];
}

export function HQApp() {
  const projectsRes = usePolled<ProjectsResponse>(
    "/projects",
    { projects: [] },
  );
  const executionsRes = usePolled<ExecutionsResponse>(
    "/executions",
    { executions: [] },
  );
  const actorsRes = usePolled<ActorsResponse>(
    "/actors",
    { actors: [] },
  );
  const brainDumpRes = usePolled<BrainDumpResponse>(
    "/brain-dump/items",
    { items: [] },
  );
  const intentsRes = usePolled<IntentsResponse>(
    "/intents?status=active&limit=10",
    { intents: [] },
  );
  const tasksRes = usePolled<TasksResponse>(
    "/tasks",
    { tasks: [] },
  );

  // Unwrap — API may return the array directly or wrapped in a key
  const projects = Array.isArray(projectsRes)
    ? (projectsRes as unknown as readonly Project[])
    : projectsRes.projects ?? [];
  const executions = Array.isArray(executionsRes)
    ? (executionsRes as unknown as readonly Execution[])
    : executionsRes.executions ?? [];
  const actors = Array.isArray(actorsRes)
    ? (actorsRes as unknown as readonly Actor[])
    : actorsRes.actors ?? [];
  const brainDumpItems = Array.isArray(brainDumpRes)
    ? (brainDumpRes as unknown as readonly BrainDumpItem[])
    : brainDumpRes.items ?? [];
  const intents = Array.isArray(intentsRes)
    ? (intentsRes as unknown as readonly Intent[])
    : intentsRes.intents ?? [];
  const tasks = Array.isArray(tasksRes)
    ? (tasksRes as unknown as readonly Task[])
    : tasksRes.tasks ?? [];

  return (
    <AppWindowChrome appId="hq" title="HQ" icon="⬡" accent={ACCENT}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          height: "100%",
        }}
      >
        {/* Header */}
        <div>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "var(--pn-text-primary)",
              margin: "0 0 4px 0",
            }}
          >
            {greeting()}, Trajan
          </h1>
          <StatBar
            executions={executions}
            brainDumpItems={brainDumpItems}
            tasks={tasks}
          />
        </div>

        {/* 3-column grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gridTemplateRows: "auto auto",
            gap: 12,
            flex: 1,
            minHeight: 0,
            overflow: "auto",
          }}
        >
          {/* Col 1, Row 1: Projects */}
          <div style={{ ...glassCard, overflow: "auto" }}>
            <ProjectCards projects={projects} />
          </div>

          {/* Col 2, Row 1: Execution Feed */}
          <div style={{ ...glassCard, overflow: "auto" }}>
            <ExecutionFeed executions={executions} />
          </div>

          {/* Col 3, Row 1+2: Agent Status (spans 2 rows) */}
          <div
            style={{
              ...glassCard,
              gridRow: "1 / 3",
              overflow: "auto",
            }}
          >
            <AgentStatusWidget actors={actors} />
          </div>

          {/* Col 1, Row 2: Brain Dump */}
          <BrainDumpWidget items={brainDumpItems} />

          {/* Col 2, Row 2: Intent Snapshot */}
          <IntentSnapshot intents={intents} />
        </div>
      </div>
    </AppWindowChrome>
  );
}
