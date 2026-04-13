import { Tooltip } from "@/components/ui/Tooltip";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { APP_CONFIGS } from "@/types/workspace";

const DOCK_APPS = [
  // Work
  { id: "brain-dump", icon: "◎", label: "Brain Dump" },
  { id: "tasks", icon: "☐", label: "Tasks" },
  { id: "projects", icon: "▣", label: "Projects" },
  { id: "executions", icon: "⚡", label: "Executions" },
  { id: "proposals", icon: "◆", label: "Proposals" },
  // Intelligence
  { id: "intent-schematic", icon: "🗺️", label: "Intent Schematic" },
  { id: "agents", icon: "⊞", label: "Agents" },
  // Creative
  { id: "canvas", icon: "◧", label: "Canvas" },
  { id: "pipes", icon: "⟿", label: "Pipes" },
  // Operations
  { id: "decision-log", icon: "⚖", label: "Decisions" },
  // Life
  { id: "habits", icon: "↻", label: "Habits" },
  { id: "journal", icon: "✎", label: "Journal" },
  { id: "responsibilities", icon: "⚈", label: "Responsibilities" },
  { id: "goals", icon: "◎", label: "Goals" },
  // System
  { id: "voice", icon: "◯", label: "Voice" },
] as const;

export function Dock() {
  const isOpen = useWorkspaceStore((s) => s.isOpen);

  function handleClick(appId: string) {
    window.location.pathname = `/${appId}`;
  }

  return (
    <div
      className="glass-elevated flex flex-col items-center py-3 shrink-0"
      style={{ width: "52px", borderRight: "1px solid var(--pn-border-subtle)" }}
    >
      <nav className="flex flex-col gap-0.5 flex-1 overflow-y-auto scrollbar-none">
        {/* Launchpad home */}
        <Tooltip label="Launchpad">
          <button
            onClick={() => { window.location.pathname = "/"; }}
            className="dock-icon active"
            style={{ color: "var(--color-pn-primary-400)" }}
          >
            <span className="dock-indicator" style={{ background: "var(--color-pn-primary-400)" }} />
            ◉
          </button>
        </Tooltip>

        <div className="dock-sep" />

        {DOCK_APPS.map(({ id, icon, label }) => {
          const running = isOpen(id);
          const config = APP_CONFIGS[id];
          const accent = config?.accent ?? "var(--pn-text-tertiary)";

          return (
            <Tooltip key={id} label={label}>
              <button
                onClick={() => handleClick(id)}
                className={`dock-icon ${running ? "active" : ""}`}
                style={{
                  "--dock-accent": accent,
                  color: running ? accent : "var(--pn-text-tertiary)",
                } as React.CSSProperties}
              >
                {icon}
                {running && (
                  <span className="dock-dot" />
                )}
              </button>
            </Tooltip>
          );
        })}
      </nav>

      <div className="dock-sep" />

      <Tooltip label="Settings">
        <button
          onClick={() => handleClick("settings")}
          className="dock-icon"
          style={{ color: "var(--pn-text-tertiary)" }}
        >
          ⚙
        </button>
      </Tooltip>
    </div>
  );
}
