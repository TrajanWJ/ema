import { useBrainDumpStore } from "@/stores/brain-dump-store";
import { useHabitsStore } from "@/stores/habits-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useJournalStore } from "@/stores/journal-store";
import { useExecutionStore } from "@/stores/execution-store";
import { useActorsStore } from "@/stores/actors-store";
import { useIntentStore } from "@/stores/intent-store";
import { useProjectsStore } from "@/stores/projects-store";
import { useTasksStore } from "@/stores/tasks-store";
import { useProposalsStore } from "@/stores/proposals-store";
import { openApp } from "@/lib/window-manager";
import { APP_CONFIGS } from "@/types/workspace";
import { AppTile } from "./AppTile";
import { OneThingCard } from "@/components/dashboard/OneThingCard";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate(): string {
  return new Date()
    .toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
    .toUpperCase();
}

// --- App registry grouped by category ---

interface AppEntry {
  id: string;
  name: string;
  category: "core" | "intelligence" | "management" | "monitoring" | "knowledge" | "personal" | "automation";
}

const APP_REGISTRY: readonly AppEntry[] = [
  // Core
  { id: "brain-dump", name: "Brain Dump", category: "core" },
  { id: "habits", name: "Habits", category: "core" },
  { id: "journal", name: "Journal", category: "core" },
  { id: "tasks", name: "Tasks", category: "core" },
  { id: "projects", name: "Projects", category: "core" },
  { id: "goals", name: "Goals", category: "core" },
  { id: "focus", name: "Focus", category: "core" },
  { id: "responsibilities", name: "Responsibilities", category: "core" },
  // Intelligence
  { id: "executions", name: "Executions", category: "intelligence" },
  { id: "dispatch-board", name: "Dispatch Board", category: "intelligence" },
  { id: "intent-map", name: "Intent Engine", category: "intelligence" },
  { id: "proposals", name: "Proposals", category: "intelligence" },
  { id: "agents", name: "Agents", category: "intelligence" },
  { id: "build-it", name: "Build It", category: "intelligence" },
  { id: "campaigns", name: "Campaigns", category: "intelligence" },
  { id: "pipeline", name: "Pipeline", category: "intelligence" },
  // Knowledge
  { id: "vault", name: "Second Brain", category: "knowledge" },
  { id: "wiki", name: "Wiki", category: "knowledge" },
  { id: "canvas", name: "Canvas", category: "knowledge" },
  { id: "notes", name: "Notes", category: "knowledge" },
  { id: "knowledge-graph", name: "Knowledge Graph", category: "knowledge" },
  { id: "vectors", name: "Vectors", category: "knowledge" },
  // Management
  { id: "org", name: "Organizations", category: "management" },
  { id: "claude-bridge", name: "Claude Bridge", category: "management" },
  { id: "sessions", name: "Sessions", category: "management" },
  { id: "cli-manager", name: "CLI Manager", category: "management" },
  { id: "settings", name: "Settings", category: "management" },
  // Automation
  { id: "pipes", name: "Pipes", category: "automation" },
  { id: "harvesters", name: "Harvesters", category: "automation" },
  { id: "git-sync", name: "Git Sync", category: "automation" },
  { id: "mcp", name: "MCP", category: "automation" },
  { id: "orchestration", name: "Orchestration", category: "automation" },
  // Monitoring
  { id: "token-monitor", name: "Token Monitor", category: "monitoring" },
  { id: "vm-health", name: "VM Health", category: "monitoring" },
  { id: "code-health", name: "Code Health", category: "monitoring" },
  { id: "quality", name: "Quality", category: "monitoring" },
  { id: "superman", name: "Superman", category: "monitoring" },
  { id: "security", name: "Security", category: "monitoring" },
  // Personal
  { id: "life-dashboard", name: "Life Dashboard", category: "personal" },
  { id: "routine-builder", name: "Routines", category: "personal" },
  { id: "finance-tracker", name: "Finance", category: "personal" },
  { id: "contacts-crm", name: "Contacts", category: "personal" },
  { id: "temporal", name: "Rhythm", category: "personal" },
  { id: "briefing", name: "Daily Brief", category: "personal" },
];

const CATEGORY_LABELS: Record<string, string> = {
  core: "Core",
  intelligence: "Intelligence",
  knowledge: "Knowledge",
  management: "Management",
  automation: "Automation",
  monitoring: "Monitoring",
  personal: "Personal",
};

const CATEGORY_ORDER = ["core", "intelligence", "knowledge", "management", "automation", "monitoring", "personal"];

export function Launchpad() {
  const inboxItems = useBrainDumpStore((s) => s.items);
  const habits = useHabitsStore((s) => s.habits);
  const todayLogs = useHabitsStore((s) => s.todayLogs);
  const entry = useJournalStore((s) => s.currentEntry);
  const windows = useWorkspaceStore((s) => s.windows);
  const executions = useExecutionStore((s) => s.executions);
  const actors = useActorsStore((s) => s.actors);
  const intents = useIntentStore((s) => s.intents);
  const projects = useProjectsStore((s) => s.projects);
  const tasks = useTasksStore((s) => s.tasks);
  const proposals = useProposalsStore((s) => s.proposals);

  const unprocessedCount = inboxItems.filter((i) => !i.processed).length;
  const completedToday = todayLogs.filter((l) => l.completed).length;
  const habitCount = habits.length;
  const habitProgress = habitCount > 0 ? Math.round((completedToday / habitCount) * 100) : 0;

  const runningExecutions = executions.filter(
    (e) => e.status === "running" || e.status === "approved" || e.status === "delegated"
  ).length;
  const awaitingApproval = executions.filter((e) => e.status === "awaiting_approval").length;
  const activeIntents = intents.filter((i) => i.status === "active" || i.status === "implementing").length;
  const agentCount = actors.filter((a) => a.type === "agent").length;
  const activeTasks = tasks.filter((t: { status: string }) => t.status === "active").length;
  const queuedProposals = proposals.filter((p: { status: string }) => p.status === "queued").length;

  // Dynamic status for apps based on live data
  function getAppStatus(id: string): { status?: string; badge?: number; progress?: number } {
    switch (id) {
      case "brain-dump": return { badge: unprocessedCount, status: `${unprocessedCount} unprocessed` };
      case "habits": return { status: `${completedToday}/${habitCount} today`, progress: habitProgress };
      case "journal": return { status: entry?.updated_at ? `last ${timeAgo(entry.updated_at)}` : "no entry today" };
      case "executions": return { badge: runningExecutions, status: `${runningExecutions} running` };
      case "dispatch-board": return { badge: runningExecutions + awaitingApproval, status: `${runningExecutions} active · ${awaitingApproval} approval` };
      case "intent-map": return { status: `${activeIntents} active · ${intents.length} total` };
      case "proposals": return { badge: queuedProposals, status: `${queuedProposals} queued` };
      case "agents": return { status: `${agentCount} agents` };
      case "tasks": return { badge: activeTasks, status: `${activeTasks} active` };
      case "projects": return { status: `${projects.length} projects` };
      case "vault": return { status: "knowledge vault" };
      default: return {};
    }
  }

  function handleOpenApp(appId: string) {
    const saved = windows.find((w) => w.app_id === appId) ?? null;
    openApp(appId, saved);
  }

  const grouped = CATEGORY_ORDER.map((cat) => ({
    key: cat,
    label: CATEGORY_LABELS[cat] || cat,
    apps: APP_REGISTRY.filter((a) => a.category === cat),
  })).filter((g) => g.apps.length > 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex justify-between items-baseline">
        <h1 className="text-[1.2rem] font-medium" style={{ color: "rgba(255,255,255,0.87)" }}>
          {getGreeting()},{" "}
          <span style={{ color: "var(--color-pn-primary-400)" }}>Trajan</span>
        </h1>
        <span className="text-[0.7rem] font-mono" style={{ color: "var(--pn-text-muted)" }}>
          {formatDate()}
        </span>
      </div>

      {/* One Thing */}
      <OneThingCard />

      {/* Quick Stats Bar */}
      <div className="flex gap-3 flex-wrap">
        <QuickStat label="Running" value={runningExecutions} color="#10b981" />
        <QuickStat label="Approval" value={awaitingApproval} color="#f59e0b" />
        <QuickStat label="Intents" value={activeIntents} color="#a78bfa" />
        <QuickStat label="Tasks" value={activeTasks} color="#38bdf8" />
        <QuickStat label="Inbox" value={unprocessedCount} color="#fb923c" />
        <QuickStat label="Proposals" value={queuedProposals} color="#f472b6" />
      </div>

      {/* Categorized App Grid */}
      {grouped.map((group) => (
        <div key={group.key}>
          <div
            className="text-[0.6rem] font-semibold uppercase tracking-widest mb-2"
            style={{ color: "var(--pn-text-muted)" }}
          >
            {group.label}
          </div>
          <div className="grid grid-cols-4 gap-3">
            {group.apps.map((app) => {
              const appConfig = APP_CONFIGS[app.id];
              const { status, badge, progress } = getAppStatus(app.id);
              return (
                <AppTile
                  key={app.id}
                  appId={app.id}
                  name={app.name}
                  icon={appConfig?.icon ?? "\u25A1"}
                  accent={appConfig?.accent ?? "var(--pn-text-tertiary)"}
                  badge={badge}
                  status={status || appConfig?.title || app.name}
                  progress={progress}
                  onClick={() => handleOpenApp(app.id)}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function QuickStat({ label, value, color }: { label: string; value: number; color: string }) {
  if (value === 0) return null;
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
      style={{ background: `${color}12`, border: `1px solid ${color}25` }}
    >
      <span className="text-[0.85rem] font-bold" style={{ color }}>{value}</span>
      <span className="text-[0.6rem] font-mono uppercase" style={{ color: "var(--pn-text-muted)" }}>{label}</span>
    </div>
  );
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
