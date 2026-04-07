import { useState, useEffect, useCallback } from "react";
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
import { api } from "@/lib/api";

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
  category: "work" | "intelligence" | "creative" | "operations" | "life" | "system";
}

// EMA UI 2.0 — 22 active apps (5 more coming in Phase 5)
const APP_REGISTRY: readonly AppEntry[] = [
  // Work
  { id: "brain-dump", name: "Brain Dump", category: "work" },
  { id: "tasks", name: "Tasks", category: "work" },
  { id: "projects", name: "Projects", category: "work" },
  { id: "executions", name: "Executions", category: "work" },
  { id: "proposals", name: "Proposals", category: "work" },
  // Intelligence
  { id: "intent-schematic", name: "Intent Schematic", category: "intelligence" },
  { id: "wiki", name: "Wiki", category: "intelligence" },
  { id: "agents", name: "Agents", category: "intelligence" },
  // Creative
  { id: "canvas", name: "Canvas", category: "creative" },
  { id: "pipes", name: "Pipes", category: "creative" },
  { id: "evolution", name: "Evolution", category: "creative" },
  { id: "whiteboard", name: "Whiteboard", category: "creative" },
  { id: "storyboard", name: "Storyboard", category: "creative" },
  // Operations
  { id: "decision-log", name: "Decisions", category: "operations" },
  { id: "campaigns", name: "Campaigns", category: "operations" },
  { id: "governance", name: "Governance", category: "operations" },
  { id: "babysitter", name: "Babysitter", category: "operations" },
  // Life
  { id: "habits", name: "Habits", category: "life" },
  { id: "journal", name: "Journal", category: "life" },
  { id: "focus", name: "Focus", category: "life" },
  { id: "responsibilities", name: "Responsibilities", category: "life" },
  { id: "temporal", name: "Rhythm", category: "life" },
  { id: "goals", name: "Goals", category: "life" },
  // System
  { id: "settings", name: "Settings", category: "system" },
  { id: "voice", name: "Voice", category: "system" },
];

const CATEGORY_LABELS: Record<string, string> = {
  work: "Work",
  intelligence: "Intelligence",
  creative: "Creative",
  operations: "Operations",
  life: "Life",
  system: "System",
};

const CATEGORY_ORDER = ["work", "intelligence", "creative", "operations", "life", "system"];

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

  const unprocessedCount = (inboxItems ?? []).filter((i) => !i.processed).length;
  const completedToday = (todayLogs ?? []).filter((l) => l.completed).length;
  const habitCount = (habits ?? []).length;
  const habitProgress = habitCount > 0 ? Math.round((completedToday / habitCount) * 100) : 0;

  const runningExecutions = (executions ?? []).filter(
    (e) => e.status === "running" || e.status === "approved" || e.status === "delegated"
  ).length;
  const awaitingApproval = (executions ?? []).filter((e) => e.status === "awaiting_approval").length;
  const activeIntents = (intents ?? []).filter((i) => i.status === "active" || i.status === "implementing").length;
  const agentCount = (actors ?? []).filter((a) => a.type === "agent").length;
  const activeTasks = (tasks ?? []).filter((t: { status: string }) => t.status === "active").length;
  const queuedProposals = (proposals ?? []).filter((p: { status: string }) => p.status === "queued").length;

  // Dynamic status for apps based on live data
  function getAppStatus(id: string): { status?: string; badge?: number; progress?: number } {
    switch (id) {
      case "brain-dump": return { badge: unprocessedCount, status: `${unprocessedCount} unprocessed` };
      case "habits": return { status: `${completedToday}/${habitCount} today`, progress: habitProgress };
      case "journal": return { status: entry?.updated_at ? `last ${timeAgo(entry.updated_at)}` : "no entry today" };
      case "executions": return { badge: runningExecutions, status: `${runningExecutions} running` };
      case "intent-schematic": return { status: `${activeIntents} active · ${(intents ?? []).length} total` };
      case "proposals": return { badge: queuedProposals, status: `${queuedProposals} queued` };
      case "agents": return { status: `${agentCount} agents` };
      case "tasks": return { badge: activeTasks, status: `${activeTasks} active` };
      case "projects": return { status: `${(projects ?? []).length} projects` };
      case "vault": return { status: "knowledge vault" };
      default: return {};
    }
  }

  function handleOpenApp(appId: string) {
    const saved = (windows ?? []).find((w) => w.app_id === appId) ?? null;
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

      {/* Recent Activity Feed */}
      <RecentActivityFeed />

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

// --- Recent Activity Feed ---

interface FeedItem {
  readonly id: string;
  readonly icon: string;
  readonly text: string;
  readonly timestamp: string;
  readonly kind: "execution" | "brain_dump" | "intent";
}

interface RawExecution {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly mode: string | null;
  readonly updated_at: string;
}

interface RawBrainDump {
  readonly id: string;
  readonly content: string;
  readonly created_at: string;
}

interface RawIntent {
  readonly id: string;
  readonly title: string;
  readonly level: number;
  readonly status: string;
  readonly updated_at: string;
}

const FEED_LIMIT = 8;
const REFRESH_MS = 30_000;

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max).trimEnd() + "\u2026";
}

function levelLabel(level: number): string {
  if (level === 0) return "L0";
  if (level === 1) return "L1";
  if (level === 2) return "L2";
  return `L${level}`;
}

function RecentActivityFeed() {
  const [items, setItems] = useState<readonly FeedItem[]>([]);

  const fetchFeed = useCallback(async () => {
    const results = await Promise.allSettled([
      api.get<{ executions: readonly RawExecution[] }>("/executions"),
      api.get<{ items: readonly RawBrainDump[] }>("/brain-dump/items"),
      api.get<{ nodes: readonly RawIntent[] }>("/intents"),
    ]);

    const feed: FeedItem[] = [];

    // Executions — take 5 most recent
    if (results[0].status === "fulfilled") {
      const execs = results[0].value.executions
        .slice()
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 5);
      for (const e of execs) {
        feed.push({
          id: `exec-${e.id}`,
          icon: "\u26A1",
          text: `[${e.status}] ${e.mode ?? "exec"}: ${truncate(e.title, 50)}`,
          timestamp: e.updated_at,
          kind: "execution",
        });
      }
    }

    // Brain dumps — take 3 most recent
    if (results[1].status === "fulfilled") {
      const dumps = results[1].value.items
        .slice()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 3);
      for (const d of dumps) {
        feed.push({
          id: `dump-${d.id}`,
          icon: "\u25CE",
          text: truncate(d.content, 60),
          timestamp: d.created_at,
          kind: "brain_dump",
        });
      }
    }

    // Intents — active only, take 5 most recent
    if (results[2].status === "fulfilled") {
      const raw = results[2].value;
      const intentsArr: readonly RawIntent[] = raw.nodes ?? raw.intents ?? [];
      const active = intentsArr
        .filter((i) => i.status === "active" || i.status === "implementing")
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 5);
      for (const i of active) {
        feed.push({
          id: `intent-${i.id}`,
          icon: "\uD83D\uDDFA\uFE0F",
          text: `[${levelLabel(i.level)}] ${truncate(i.title, 45)} \u2014 ${i.status}`,
          timestamp: i.updated_at,
          kind: "intent",
        });
      }
    }

    // Sort all by timestamp descending, take top FEED_LIMIT
    feed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setItems(feed.slice(0, FEED_LIMIT));
  }, []);

  useEffect(() => {
    fetchFeed();
    const id = setInterval(fetchFeed, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchFeed]);

  if (items.length === 0) return null;

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 8,
        padding: "10px 12px",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--pn-text-muted)",
          marginBottom: 8,
        }}
      >
        Recent Activity
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {items.map((item) => (
          <div
            key={item.id}
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 6,
              fontSize: 11,
              lineHeight: 1.4,
              color: "var(--pn-text-secondary)",
            }}
          >
            <span style={{ flexShrink: 0, width: 16, textAlign: "center" }}>{item.icon}</span>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.text}
            </span>
            <span
              style={{
                flexShrink: 0,
                fontSize: 10,
                color: "var(--pn-text-muted)",
                fontFamily: "var(--font-mono, monospace)",
              }}
            >
              {timeAgo(item.timestamp)}
            </span>
          </div>
        ))}
      </div>
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
