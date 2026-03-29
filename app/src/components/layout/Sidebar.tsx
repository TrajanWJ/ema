import { Tooltip } from "@/components/ui/Tooltip";

type Page = "dashboard" | "brain-dump" | "habits" | "journal" | "settings";

interface SidebarProps {
  readonly activePage: Page;
  readonly onNavigate: (page: Page) => void;
}

const NAV_ITEMS: readonly { page: Page; icon: string; label: string }[] = [
  { page: "dashboard", icon: "\u25C9", label: "Dashboard" },
  { page: "brain-dump", icon: "\u25CE", label: "Brain Dump" },
  { page: "habits", icon: "\u21BB", label: "Habits" },
  { page: "journal", icon: "\u270E", label: "Journal" },
];

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  return (
    <div
      className="glass-surface flex flex-col items-center py-3 shrink-0"
      style={{ width: "56px", borderRight: "1px solid var(--pn-border-subtle)" }}
    >
      <nav className="flex flex-col gap-1 flex-1">
        {NAV_ITEMS.map(({ page, icon, label }) => {
          const active = activePage === page;
          return (
            <Tooltip key={page} label={label}>
              <button
                onClick={() => onNavigate(page)}
                className="relative flex items-center justify-center rounded-md transition-colors"
                style={{
                  width: "40px",
                  height: "40px",
                  color: active ? "var(--color-pn-primary-400)" : "var(--pn-text-tertiary)",
                  background: active ? "rgba(45, 212, 168, 0.08)" : "transparent",
                  fontSize: "1.1rem",
                }}
              >
                {active && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r"
                    style={{
                      width: "2px",
                      height: "20px",
                      background: "var(--color-pn-primary-400)",
                    }}
                  />
                )}
                {icon}
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
          onClick={() => onNavigate("settings")}
          className="flex items-center justify-center rounded-md transition-colors"
          style={{
            width: "40px",
            height: "40px",
            color:
              activePage === "settings"
                ? "var(--color-pn-primary-400)"
                : "var(--pn-text-tertiary)",
            background:
              activePage === "settings" ? "rgba(45, 212, 168, 0.08)" : "transparent",
            fontSize: "1rem",
          }}
        >
          &#9881;
        </button>
      </Tooltip>
    </div>
  );
}
