import type { ReactNode } from "react";

export interface SidebarNavItem {
  readonly id: string;
  readonly label: string;
  readonly detail?: string;
  readonly leading?: ReactNode;
}

interface SidebarNavProps {
  readonly title?: string;
  readonly items: readonly SidebarNavItem[];
  readonly activeId: string;
  readonly onChange: (id: string) => void;
}

export function SidebarNav({
  title,
  items,
  activeId,
  onChange,
}: SidebarNavProps) {
  return (
    <div
      style={{
        width: "var(--pn-layout-sidebar-width)",
        minWidth: "var(--pn-layout-sidebar-width)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--pn-space-2)",
        padding: "var(--pn-space-3)",
        borderRadius: "var(--pn-radius-xl)",
        background: "var(--pn-gradient-chrome)",
        border: "1px solid var(--pn-border-default)",
      }}
    >
      {title && (
        <div
          style={{
            padding: "var(--pn-space-2) var(--pn-space-2_5)",
            fontSize: "0.68rem",
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            color: "var(--pn-text-muted)",
          }}
        >
          {title}
        </div>
      )}
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            style={{
              textAlign: "left",
              display: "flex",
              gap: "var(--pn-space-3)",
              alignItems: "start",
              padding: "var(--pn-space-3)",
              borderRadius: "var(--pn-radius-lg)",
              border: "1px solid transparent",
              background: active
                ? "color-mix(in srgb, var(--color-pn-blue-500) 20%, transparent)"
                : "transparent",
              color: active ? "var(--pn-text-primary)" : "var(--pn-text-secondary)",
              cursor: "pointer",
            }}
          >
            <span>{item.leading}</span>
            <span>
              <div style={{ fontSize: "0.82rem", fontWeight: 600 }}>{item.label}</div>
              {item.detail && (
                <div style={{ marginTop: "4px", fontSize: "0.72rem", color: "var(--pn-text-tertiary)" }}>
                  {item.detail}
                </div>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
