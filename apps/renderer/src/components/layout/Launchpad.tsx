import { useState, useEffect, useCallback } from "react";

import { OneThingCard } from "@/components/dashboard/OneThingCard";
import { AppTile } from "@/components/layout/AppTile";
import { APP_GROUPS, FEATURED_APPS, type AppCatalogEntry } from "@/config/app-catalog";
import { api } from "@/lib/api";
import { openApp } from "@/lib/window-manager";
import { useActorsStore } from "@/stores/actors-store";
import { useBrainDumpStore } from "@/stores/brain-dump-store";
import { useExecutionStore } from "@/stores/execution-store";
import { useIntentStore } from "@/stores/intent-store";
import { useProjectsStore } from "@/stores/projects-store";
import { useProposalsStore } from "@/stores/proposals-store";
import { useTasksStore } from "@/stores/tasks-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { APP_CONFIGS } from "@/types/workspace";

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

const OPEN_TASK_STATUSES = new Set([
  "proposed",
  "todo",
  "in_progress",
  "blocked",
  "in_review",
  "requires_proposal",
]);

export function Launchpad() {
  const inboxItems = useBrainDumpStore((s) => s.items);
  const windows = useWorkspaceStore((s) => s.windows);
  const executions = useExecutionStore((s) => s.executions);
  const actors = useActorsStore((s) => s.actors);
  const intents = useIntentStore((s) => s.intents);
  const projects = useProjectsStore((s) => s.projects);
  const tasks = useTasksStore((s) => s.tasks);
  const proposals = useProposalsStore((s) => s.proposals);

  const unprocessedCount = (inboxItems ?? []).filter((i) => !i.processed).length;
  const runningExecutions = (executions ?? []).filter(
    (e) => e.status === "running" || e.status === "approved" || e.status === "delegated",
  ).length;
  const awaitingApproval = (executions ?? []).filter((e) => e.status === "awaiting_approval").length;
  const activeIntents = (intents ?? []).filter((i) => i.status === "active" || i.status === "implementing").length;
  const agentCount = (actors ?? []).filter((a) => a.type === "agent").length;
  const activeTasks = (tasks ?? []).filter((task: { status: string }) => OPEN_TASK_STATUSES.has(task.status)).length;
  const queuedProposals = (proposals ?? []).filter((proposal: { status: string }) => proposal.status === "queued").length;
  const mountedCount = APP_GROUPS.reduce((total, group) => total + group.apps.length, 0);
  const liveCount = APP_GROUPS.reduce(
    (total, group) => total + group.apps.filter((entry) => entry.readiness === "live").length,
    0,
  );
  const partialCount = APP_GROUPS.reduce(
    (total, group) => total + group.apps.filter((entry) => entry.readiness === "partial").length,
    0,
  );
  const previewCount = APP_GROUPS.reduce(
    (total, group) => total + group.apps.filter((entry) => entry.readiness === "preview").length,
    0,
  );

  function getAppStatus(id: string): { status?: string; badge?: number; progress?: number } {
    switch (id) {
      case "desk":
        return { status: `${unprocessedCount} inbox · ${activeTasks} open tasks` };
      case "agenda":
        return { status: "schedule + action surface" };
      case "brain-dump":
        return { badge: unprocessedCount, status: `${unprocessedCount} unprocessed` };
      case "tasks":
        return { badge: activeTasks, status: `${activeTasks} actionable` };
      case "goals":
        return { status: `${projects.length} active project contexts` };
      case "projects":
        return { status: `${projects.length} projects` };
      case "executions":
        return { badge: runningExecutions, status: `${runningExecutions} running` };
      case "proposals":
        return { badge: queuedProposals, status: `${queuedProposals} queued` };
      case "agents":
        return { status: `${agentCount} agents` };
      case "feeds":
        return { status: "research and cross-pollination" };
      case "intent-schematic":
        return { status: `${activeIntents} active · ${intents.length} total` };
      case "blueprint-planner":
        return { status: "planning and question queue" };
      case "canvas":
        return { status: "connected spatial first draft" };
      case "pipes":
        return { status: "automation registry + runtime graph" };
      case "settings":
        return { status: "runtime preferences + platform control" };
      case "voice":
        return { status: "phone relay + voice control seams" };
      case "terminal":
        return { status: "tmux-backed agent/runtime console" };
      case "wiki":
        return { status: "knowledge workstation first draft" };
      case "decision-log":
        return { status: "decision memory first draft" };
      case "campaigns":
        return { status: "orchestration first draft" };
      case "evolution":
        return { status: "adaptive systems first draft" };
      case "journal":
        return { status: "reflection first draft" };
      case "habits":
        return { status: "rhythm support first draft" };
      case "focus":
        return { status: "attention workflow first draft" };
      case "responsibilities":
        return { status: "ownership mapping first draft" };
      case "temporal":
        return { status: "rhythm intelligence first draft" };
      case "hq":
        return { status: "strategic command-center first draft" };
      default:
        return {};
    }
  }

  function handleOpenApp(appId: string) {
    const saved = (windows ?? []).find((w) => w.app_id === appId) ?? null;
    void openApp(appId, saved);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-baseline gap-3">
        <h1 className="text-[1.2rem] font-medium" style={{ color: "rgba(255,255,255,0.87)" }}>
          {getGreeting()},{" "}
          <span style={{ color: "var(--color-pn-primary-400)" }}>Trajan</span>
        </h1>
        <span className="text-[0.7rem] font-mono" style={{ color: "var(--pn-text-muted)" }}>
          {formatDate()}
        </span>
      </div>

      <OneThingCard />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
        <HeroPanel
          eyebrow="Human Ops"
          title="Start With Desk"
          headline="Use the real day spine first"
          subtitle="Desk is the truthful day-1 home for capture, triage, planning, commitments, check-ins, and recovery. Keep the operator loop here before widening into broader system surfaces."
          accent="var(--color-pn-primary-400)"
          primaryLabel="Open Desk"
          secondaryLabel="Open Agenda"
          onPrimary={() => handleOpenApp("desk")}
          onSecondary={() => handleOpenApp("agenda")}
          stats={[
            `${unprocessedCount} inbox`,
            `${activeTasks} open tasks`,
            `${runningExecutions} active executions`,
          ]}
        />
        <HeroPanel
          eyebrow="Speculative Surface"
          title="HQ"
          headline="Strategic visibility, separate from daily control"
          subtitle="HQ is the broader command-room app we’re building. Keep it accessible and big, but distinct from the operational home so the day-1 workflow stays honest."
          accent={APP_CONFIGS.hq.accent}
          primaryLabel="Open HQ"
          secondaryLabel="Open Executions"
          onPrimary={() => handleOpenApp("hq")}
          onSecondary={() => handleOpenApp("executions")}
          stats={[
            `${activeIntents} active intents`,
            `${queuedProposals} queued proposals`,
            `${agentCount} agents`,
          ]}
        />
      </div>

      <div className="flex gap-3 flex-wrap">
        <QuickStat label="Running" value={runningExecutions} color="#10b981" />
        <QuickStat label="Approval" value={awaitingApproval} color="#f59e0b" />
        <QuickStat label="Intents" value={activeIntents} color="#a78bfa" />
        <QuickStat label="Tasks" value={activeTasks} color="#38bdf8" />
        <QuickStat label="Inbox" value={unprocessedCount} color="#fb923c" />
        <QuickStat label="Proposals" value={queuedProposals} color="#f472b6" />
        <QuickStat label="Mounted" value={mountedCount} color="#94a3b8" />
        <QuickStat label="Partial" value={partialCount} color="#fbbf24" />
        <QuickStat label="Preview" value={previewCount} color="#64748b" />
      </div>

      <RecentActivityFeed />

      <CatalogOverview
        liveCount={liveCount}
        partialCount={partialCount}
        previewCount={previewCount}
        mountedCount={mountedCount}
      />

      <AppSection
        title="Featured Surfaces"
        description="Start from the surfaces with the strongest current backend truth or the clearest place-native direction."
        apps={FEATURED_APPS}
        getAppStatus={getAppStatus}
        onOpen={handleOpenApp}
      />

      {APP_GROUPS.map((group) => (
        <AppSection
          key={group.id}
          title={group.label}
          description={group.description}
          apps={group.apps}
          getAppStatus={getAppStatus}
          onOpen={handleOpenApp}
        />
      ))}
    </div>
  );
}

function CatalogOverview({
  liveCount,
  partialCount,
  previewCount,
  mountedCount,
}: {
  readonly liveCount: number;
  readonly partialCount: number;
  readonly previewCount: number;
  readonly mountedCount: number;
}) {
  const stats = [
    {
      label: "Live now",
      value: liveCount,
      accent: "#2dd4a8",
      description: "Connected to active backend domains and usable today.",
    },
    {
      label: "Partial",
      value: partialCount,
      accent: "#fbbf24",
      description: "Important surfaces with some live seams and some unresolved drift.",
    },
    {
      label: "Preview",
      value: previewCount,
      accent: "#94a3b8",
      description: "Mounted shells that still need real backend ownership or deeper build-out.",
    },
    {
      label: "Mounted apps",
      value: mountedCount,
      accent: "#6b95f0",
      description: "Current renderer surfaces carried into the Electron shell.",
    },
  ] as const;

  return (
    <div
      className="grid grid-cols-1 gap-3 lg:grid-cols-4"
      style={{
        padding: 12,
        borderRadius: 20,
        background:
          "linear-gradient(135deg, rgba(18,22,31,0.92) 0%, rgba(12,14,20,0.72) 52%, rgba(8,10,14,0.82) 100%)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 24px 60px rgba(0,0,0,0.22)",
      }}
    >
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-2xl p-4"
          style={{
            background: `linear-gradient(180deg, ${stat.accent}14, rgba(255,255,255,0.02))`,
            border: `1px solid ${stat.accent}22`,
          }}
        >
          <div className="text-[0.62rem] font-semibold uppercase tracking-[0.18em]" style={{ color: stat.accent }}>
            {stat.label}
          </div>
          <div className="mt-2 text-[1.8rem] font-semibold" style={{ color: "rgba(255,255,255,0.92)" }}>
            {stat.value}
          </div>
          <p className="mt-2 text-[0.7rem] leading-[1.55]" style={{ color: "var(--pn-text-secondary)" }}>
            {stat.description}
          </p>
        </div>
      ))}
    </div>
  );
}

function HeroPanel({
  eyebrow,
  title,
  headline,
  subtitle,
  accent,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
  stats,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly headline: string;
  readonly subtitle: string;
  readonly accent: string;
  readonly primaryLabel: string;
  readonly secondaryLabel: string;
  readonly onPrimary: () => void;
  readonly onSecondary: () => void;
  readonly stats: readonly string[];
}) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: "rgba(14, 16, 23, 0.72)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 18px 48px rgba(0,0,0,0.22)",
      }}
    >
      <div className="text-[0.66rem] font-semibold uppercase tracking-[0.16em]" style={{ color: accent }}>
        {eyebrow}
      </div>
      <div className="mt-1 text-[1.22rem] font-semibold" style={{ color: "rgba(255,255,255,0.92)" }}>
        {headline}
      </div>
      <p className="mt-2 text-[0.8rem] leading-[1.55]" style={{ color: "var(--pn-text-secondary)" }}>
        {subtitle}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {stats.map((stat) => (
          <span
            key={stat}
            className="rounded-full px-2.5 py-1 text-[0.65rem] font-medium"
            style={{ background: `${accent}18`, color: accent, border: `1px solid ${accent}28` }}
          >
            {stat}
          </span>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onPrimary}
          className="rounded-lg px-4 py-2 text-[0.74rem] font-semibold transition-opacity hover:opacity-90"
          style={{ background: accent, color: "#08090E" }}
        >
          {primaryLabel}
        </button>
        <button
          type="button"
          onClick={onSecondary}
          className="rounded-lg px-4 py-2 text-[0.74rem] font-medium transition-opacity hover:opacity-90"
          style={{
            background: "rgba(255,255,255,0.04)",
            color: "var(--pn-text-secondary)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {secondaryLabel}
        </button>
      </div>
      <div className="mt-4 text-[0.66rem] uppercase tracking-[0.16em]" style={{ color: "var(--pn-text-muted)" }}>
        {title}
      </div>
    </div>
  );
}

function AppSection({
  title,
  description,
  apps,
  getAppStatus,
  onOpen,
}: {
  readonly title: string;
  readonly description: string;
  readonly apps: readonly AppCatalogEntry[];
  readonly getAppStatus: (id: string) => { status?: string; badge?: number; progress?: number };
  readonly onOpen: (appId: string) => void;
}) {
  return (
    <div>
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <div
            className="text-[0.6rem] font-semibold uppercase tracking-widest"
            style={{ color: "var(--pn-text-muted)" }}
          >
            {title}
          </div>
          <p className="mt-1 max-w-3xl text-[0.72rem] leading-[1.55]" style={{ color: "var(--pn-text-secondary)" }}>
            {description}
          </p>
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-[0.58rem] font-semibold uppercase tracking-[0.18em]"
          style={{
            color: "var(--pn-text-muted)",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {apps.length} apps
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {apps.map((app) => {
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
              readiness={app.readiness}
              summary={app.summary}
              commandHint={app.commandHint}
              status={status || appConfig?.title || app.name}
              progress={progress}
              scaffolded={app.readiness === "preview"}
              onClick={() => onOpen(app.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

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

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, max).trimEnd() + "\u2026";
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
      api.get<{ nodes?: readonly RawIntent[]; intents?: readonly RawIntent[] }>("/intents"),
    ]);

    const feed: FeedItem[] = [];

    if (results[0].status === "fulfilled") {
      const execs = results[0].value.executions
        .slice()
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 5);
      for (const execution of execs) {
        feed.push({
          id: `exec-${execution.id}`,
          icon: "\u26A1",
          text: `[${execution.status}] ${execution.mode ?? "exec"}: ${truncate(execution.title, 50)}`,
          timestamp: execution.updated_at,
          kind: "execution",
        });
      }
    }

    if (results[1].status === "fulfilled") {
      const dumps = results[1].value.items
        .slice()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 3);
      for (const dump of dumps) {
        feed.push({
          id: `dump-${dump.id}`,
          icon: "\u25CE",
          text: truncate(dump.content, 60),
          timestamp: dump.created_at,
          kind: "brain_dump",
        });
      }
    }

    if (results[2].status === "fulfilled") {
      const raw = results[2].value;
      const intentsArr: readonly RawIntent[] = raw.nodes ?? raw.intents ?? [];
      const active = intentsArr
        .filter((intent) => intent.status === "active" || intent.status === "implementing")
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 5);
      for (const intent of active) {
        feed.push({
          id: `intent-${intent.id}`,
          icon: "\uD83D\uDDFA\uFE0F",
          text: `[${levelLabel(intent.level)}] ${truncate(intent.title, 45)} - ${intent.status}`,
          timestamp: intent.updated_at,
          kind: "intent",
        });
      }
    }

    feed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setItems(feed.slice(0, FEED_LIMIT));
  }, []);

  useEffect(() => {
    void fetchFeed();
    const id = setInterval(() => void fetchFeed(), REFRESH_MS);
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
      className="flex items-center gap-2 rounded-lg px-3 py-1.5"
      style={{ background: `${color}12`, border: `1px solid ${color}25` }}
    >
      <span className="text-[0.85rem] font-bold" style={{ color }}>
        {value}
      </span>
      <span className="text-[0.6rem] font-mono uppercase" style={{ color: "var(--pn-text-muted)" }}>
        {label}
      </span>
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
