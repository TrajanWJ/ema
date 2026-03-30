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
            className="relative flex items-center justify-center rounded-md"
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
                className="relative flex items-center justify-center rounded-md transition-colors hover:bg-white/5"
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
          className="relative flex items-center justify-center rounded-md transition-colors hover:bg-white/5"
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
