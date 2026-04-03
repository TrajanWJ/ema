import { useBrainDumpStore } from "@/stores/brain-dump-store";
import { useHabitsStore } from "@/stores/habits-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useJournalStore } from "@/stores/journal-store";
import { useGitSyncStore } from "@/stores/git-sync-store";
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
    .toLocaleDateString("en-US", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    })
    .toUpperCase();
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const NEW_APPS = [
  { id: "proposals", name: "Proposals", status: "proposal engine" },
  { id: "projects", name: "Projects", status: "project management" },
  { id: "tasks", name: "Tasks", status: "task tracking" },
  { id: "responsibilities", name: "Responsibilities", status: "active responsibilities" },
  { id: "agents", name: "Agents", status: "manage agents" },
  { id: "vault", name: "Second Brain", status: "knowledge vault" },
  { id: "canvas", name: "Canvas", status: "visual workspace" },
  { id: "pipes", name: "Pipes", status: "automation" },
  { id: "claude-bridge", name: "Claude Bridge", status: "interactive sessions" },
  { id: "goals", name: "Goals", status: "goal tracking" },
  { id: "focus", name: "Focus", status: "deep work timer" },
  { id: "git-sync", name: "Git Sync", status: "wiki auto-sync" },
  { id: "openclaw", name: "OpenClaw", status: "gateway bridge" },
  { id: "cli-manager", name: "CLI Manager", status: "agent sessions" },
  { id: "jarvis", name: "Jarvis", status: "AI assistant" },
  // Monitoring & Intelligence
  { id: "token-monitor", name: "Token Monitor", status: "cost tracking" },
  { id: "vm-health", name: "VM Health", status: "infrastructure" },
  { id: "security", name: "Security", status: "posture monitoring" },
  // Intelligence & Knowledge
  { id: "memory", name: "Memory", status: "session context" },
  { id: "gaps", name: "Gap Inbox", status: "system gaps" },
  { id: "intent-map", name: "Intent Map", status: "project intent" },
  { id: "code-health", name: "Code Health", status: "project health" },
] as const;

export function Launchpad() {
  const inboxItems = useBrainDumpStore((s) => s.items);
  const habits = useHabitsStore((s) => s.habits);
  const todayLogs = useHabitsStore((s) => s.todayLogs);
  const entry = useJournalStore((s) => s.currentEntry);
  const windows = useWorkspaceStore((s) => s.windows);
  const pendingSuggestions = useGitSyncStore((s) => s.syncStatus?.pending_suggestions ?? 0);

  const unprocessedCount = inboxItems.filter((i) => !i.processed).length;
  const completedToday = todayLogs.filter((l) => l.completed).length;
  const habitCount = habits.length;
  const habitProgress = habitCount > 0 ? Math.round((completedToday / habitCount) * 100) : 0;

  const journalStatus = entry?.updated_at
    ? `last entry ${formatRelativeTime(entry.updated_at)}`
    : "no entry today";

  function handleOpenApp(appId: string) {
    const saved = windows.find((w) => w.app_id === appId) ?? null;
    openApp(appId, saved);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Greeting */}
      <div className="flex justify-between items-baseline">
        <h1 className="text-[1.2rem] font-medium" style={{ color: "rgba(255,255,255,0.87)" }}>
          {getGreeting()},{" "}
          <span style={{ color: "var(--color-pn-primary-400)" }}>Trajan</span>
        </h1>
        <span
          className="text-[0.7rem] font-mono"
          style={{ color: "var(--pn-text-muted)" }}
        >
          {formatDate()}
        </span>
      </div>

      {/* One Thing */}
      <OneThingCard />

      {/* App Tile Grid */}
      <div className="grid grid-cols-4 gap-3">
        {/* V1 Apps */}
        <AppTile
          appId="brain-dump"
          name="Brain Dump"
          icon={APP_CONFIGS["brain-dump"].icon}
          accent={APP_CONFIGS["brain-dump"].accent}
          badge={unprocessedCount}
          status={`${unprocessedCount} unprocessed`}
          onClick={() => handleOpenApp("brain-dump")}
        />
        <AppTile
          appId="habits"
          name="Habits"
          icon={APP_CONFIGS.habits.icon}
          accent={APP_CONFIGS.habits.accent}
          status={`${completedToday}/${habitCount} today`}
          progress={habitProgress}
          onClick={() => handleOpenApp("habits")}
        />
        <AppTile
          appId="journal"
          name="Journal"
          icon={APP_CONFIGS.journal.icon}
          accent={APP_CONFIGS.journal.accent}
          status={journalStatus}
          onClick={() => handleOpenApp("journal")}
        />
        <AppTile
          appId="settings"
          name="Settings"
          icon={APP_CONFIGS.settings.icon}
          accent={APP_CONFIGS.settings.accent}
          status="workspace · apps · data"
          onClick={() => handleOpenApp("settings")}
        />

        {/* New Apps */}
        {NEW_APPS.map((app) => {
          const appConfig = APP_CONFIGS[app.id];
          const badge = app.id === "git-sync" ? pendingSuggestions : undefined;
          return (
            <AppTile
              key={app.id}
              appId={app.id}
              name={app.name}
              icon={appConfig?.icon ?? "\u25A1"}
              accent={appConfig?.accent ?? "var(--pn-text-tertiary)"}
              badge={badge}
              status={app.id === "git-sync" && pendingSuggestions > 0 ? `${pendingSuggestions} pending` : app.status}
              onClick={() => handleOpenApp(app.id)}
            />
          );
        })}

        {/* Placeholder for future scaffolded apps */}
      </div>
    </div>
  );
}
