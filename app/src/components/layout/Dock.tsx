import { Tooltip } from "@/components/ui/Tooltip";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { APP_CONFIGS } from "@/types/workspace";
import { openApp } from "@/lib/window-manager";

// EMA UI 2.0 — 22 active apps in dock
const DOCK_APPS = [
  // Work
  { id: "brain-dump", icon: "◎", label: "Brain Dump" },
  { id: "tasks", icon: "☐", label: "Tasks" },
  { id: "projects", icon: "▣", label: "Projects" },
  { id: "executions", icon: "⚡", label: "Executions" },
  { id: "proposals", icon: "◆", label: "Proposals" },
  // Intelligence
  { id: "intent-schematic", icon: "🗺️", label: "Intent Schematic" },
  { id: "wiki", icon: "📖", label: "Wiki" },
  { id: "agents", icon: "⊞", label: "Agents" },
  // Creative
  { id: "canvas", icon: "◧", label: "Canvas" },
  { id: "pipes", icon: "⟿", label: "Pipes" },
  { id: "evolution", icon: "⦖", label: "Evolution" },
  // Operations
  { id: "decision-log", icon: "⚖", label: "Decisions" },
  { id: "campaigns", icon: "🎯", label: "Campaigns" },
  // Life
  { id: "habits", icon: "↻", label: "Habits" },
  { id: "journal", icon: "✎", label: "Journal" },
  { id: "focus", icon: "⏱", label: "Focus" },
  { id: "responsibilities", icon: "⚈", label: "Responsibilities" },
  { id: "temporal", icon: "⏱", label: "Rhythm" },
  { id: "goals", icon: "◎", label: "Goals" },
  // System
  { id: "voice", icon: "◯", label: "Voice" },
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
