import { Tooltip } from "@/components/ui/Tooltip";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { APP_CONFIGS } from "@/types/workspace";
import { openApp } from "@/lib/window-manager";

const DOCK_APPS = [
  { id: "brain-dump", icon: "\u25CE", label: "Brain Dump" },
  { id: "habits", icon: "\u21BB", label: "Habits" },
  { id: "journal", icon: "\u270E", label: "Journal" },
  { id: "proposals", icon: "\u25C6", label: "Proposals" },
  { id: "projects", icon: "\u25A3", label: "Projects" },
  { id: "tasks", icon: "\u2610", label: "Tasks" },
  { id: "responsibilities", icon: "\u26E8", label: "Responsibilities" },
  { id: "agents", icon: "\u2B21", label: "Agents" },
  { id: "vault", icon: "\u25C8", label: "Second Brain" },
  { id: "canvas", icon: "\u25E7", label: "Canvas" },
  { id: "pipes", icon: "\u27BF", label: "Pipes" },
  { id: "channels", icon: "\u{1F4AC}", label: "Channels" },
  { id: "claude-bridge", icon: "\u2B23", label: "Claude Bridge" },
  { id: "voice", icon: "\u25CE", label: "Voice" },
  { id: "goals", icon: "\u25CE", label: "Goals" },
  { id: "focus", icon: "\u23F1", label: "Focus" },
  { id: "git-sync", icon: "\u2B82", label: "Git Sync" },
  { id: "openclaw", icon: "\u2318", label: "OpenClaw" },
  { id: "cli-manager", icon: "\u2395", label: "CLI Manager" },
  { id: "jarvis", icon: "\u2B22", label: "Jarvis" },
  // Chunk 2
  { id: "pipeline", icon: "\u25B6", label: "Pipeline" },
  { id: "agent-fleet", icon: "\u2B21", label: "Agent Fleet" },
  { id: "prompt-workshop", icon: "\u270D", label: "Prompts" },
  { id: "ingestor", icon: "\u2B07", label: "Ingestor" },
  { id: "decision-log", icon: "\u2696", label: "Decisions" },
  // Chunk 3
  { id: "file-vault", icon: "\uD83D\uDD12", label: "File Vault" },
  { id: "message-hub", icon: "\u2709", label: "Messages" },
  { id: "shared-clipboard", icon: "\uD83D\uDCCB", label: "Clipboard" },
  { id: "service-dashboard", icon: "\u2699", label: "Services" },
  { id: "tunnel-manager", icon: "\u21C6", label: "Tunnels" },
  // Chunk 4
  { id: "life-dashboard", icon: "\u2600", label: "Life Dashboard" },
  { id: "routine-builder", icon: "\u21BB", label: "Routines" },
  { id: "finance-tracker", icon: "\uD83D\uDCB0", label: "Finance" },
  { id: "contacts-crm", icon: "\uD83D\uDC64", label: "Contacts" },
  { id: "goal-planner", icon: "\uD83C\uDFAF", label: "Goal Planner" },
  // Chunk 5
  { id: "team-pulse", icon: "\uD83D\uDC65", label: "Team Pulse" },
  { id: "meeting-room", icon: "\uD83D\uDCC5", label: "Meetings" },
  { id: "project-portfolio", icon: "\u25A3", label: "Portfolio" },
  { id: "invoice-billing", icon: "\uD83D\uDCC4", label: "Invoices" },
  { id: "audit-trail", icon: "\uD83D\uDD0D", label: "Audit Trail" },
  // Monitoring & Intelligence
  { id: "token-monitor", icon: "\uD83D\uDCB0", label: "Tokens" },
  { id: "vm-health", icon: "\u2B22", label: "VM Health" },
  { id: "security", icon: "\uD83D\uDD12", label: "Security" },
  // Intelligence & Knowledge
  { id: "memory", icon: "\uD83E\uDDE0", label: "Memory" },
  { id: "gaps", icon: "\u26A0", label: "Gaps" },
  { id: "intent-map", icon: "\uD83D\uDDFA", label: "Intent Map" },
  { id: "code-health", icon: "\uD83D\uDCCA", label: "Code Health" },
  { id: "dispatch-board", icon: "\uD83D\uDCE1", label: "Dispatch Board" },
  // Organizations & P2P
  { id: "org", icon: "\u2B21", label: "Organizations" },
] as const;

export function Dock() {
  const isOpen = useWorkspaceStore((s) => s.isOpen);
  const windows = useWorkspaceStore((s) => s.windows);

  function handleClick(appId: string) {
    const saved = windows.find((w) => w.app_id === appId) ?? null;
    openApp(appId, saved);
  }

  return (
    <div
      className="glass-surface flex flex-col items-center py-3 shrink-0"
      style={{ width: "56px", borderRight: "1px solid var(--pn-border-subtle)" }}
    >
      <nav className="flex flex-col gap-1 flex-1">
        {/* Launchpad icon — always active */}
        <Tooltip label="Launchpad">
          <button
            className="relative flex items-center justify-center rounded-md transition-all duration-200 hover:bg-[rgba(45,212,168,0.12)]"
            style={{
              width: "40px",
              height: "40px",
              color: "var(--color-pn-primary-400)",
              background: "rgba(45, 212, 168, 0.08)",
              fontSize: "1.1rem",
            }}
          >
            <span
              className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r"
              style={{
                width: "2px",
                height: "20px",
                background: "var(--color-pn-primary-400)",
              }}
            />
            ◉
          </button>
        </Tooltip>

        <div
          className="my-1"
          style={{ width: "24px", height: "1px", background: "var(--pn-border-default)", alignSelf: "center" }}
        />

        {DOCK_APPS.map(({ id, icon, label }) => {
          const running = isOpen(id);
          const config = APP_CONFIGS[id];
          return (
            <Tooltip key={id} label={label}>
              <button
                onClick={() => handleClick(id)}
                className="relative flex items-center justify-center rounded-md transition-all duration-200 hover:bg-white/5 active:scale-95"
                style={{
                  width: "40px",
                  height: "40px",
                  color: running ? (config?.accent ?? "var(--pn-text-tertiary)") : "var(--pn-text-tertiary)",
                  fontSize: "1.1rem",
                }}
              >
                {icon}
                {running && (
                  <span
                    className="absolute bottom-0.5 right-0.5 rounded-full"
                    style={{
                      width: "6px",
                      height: "6px",
                      background: "#22C55E",
                      border: "1px solid var(--color-pn-base)",
                      animation: "fadeIn 200ms ease-out",
                    }}
                  />
                )}
              </button>
            </Tooltip>
          );
        })}
      </nav>

      <div
        className="my-2"
        style={{ width: "24px", height: "1px", background: "var(--pn-border-default)" }}
      />

      <Tooltip label="Settings">
        <button
          onClick={() => {
            const saved = windows.find((w) => w.app_id === "settings") ?? null;
            openApp("settings", saved);
          }}
          className="relative flex items-center justify-center rounded-md transition-all duration-200 hover:bg-white/5 active:scale-95"
          style={{
            width: "40px",
            height: "40px",
            color: isOpen("settings") ? "rgba(255,255,255,0.60)" : "var(--pn-text-tertiary)",
            fontSize: "1rem",
          }}
        >
          ⚙
          {isOpen("settings") && (
            <span
              className="absolute bottom-0.5 right-0.5 rounded-full"
              style={{
                width: "6px",
                height: "6px",
                background: "#22C55E",
                border: "1px solid var(--color-pn-base)",
              }}
            />
          )}
        </button>
      </Tooltip>
    </div>
  );
}
