import type { ReactNode } from "react";

export interface TopNavBarItem {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
  readonly leading?: ReactNode;
}

interface TopNavBarProps {
  readonly items: readonly TopNavBarItem[];
  readonly activeId: string;
  readonly onChange: (id: string) => void;
  readonly leftSlot?: ReactNode;
  readonly rightSlot?: ReactNode;
}

export function TopNavBar({
  items,
  activeId,
  onChange,
  leftSlot,
  rightSlot,
}: TopNavBarProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--pn-space-4)",
        minHeight: "var(--pn-layout-top-nav-height)",
        padding: "var(--pn-space-3) var(--pn-space-4)",
        borderRadius: "var(--pn-radius-xl)",
        background: "var(--pn-gradient-chrome)",
        border: "1px solid var(--pn-border-default)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--pn-space-4)", minWidth: 0 }}>
        {leftSlot}
        <div style={{ display: "flex", gap: "var(--pn-space-2)", flexWrap: "wrap" }}>
          {items.map((item) => {
            const active = item.id === activeId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChange(item.id)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: "2px",
                  padding: "var(--pn-space-2) var(--pn-space-3)",
                  borderRadius: "999px",
                  border: "1px solid transparent",
                  background: active
                    ? "color-mix(in srgb, var(--color-pn-teal-400) 20%, transparent)"
                    : "transparent",
                  color: active ? "var(--color-pn-teal-300)" : "var(--pn-text-secondary)",
                  cursor: "pointer",
                }}
              >
                <span style={{ display: "flex", gap: "var(--pn-space-2)", alignItems: "center", fontSize: "0.8rem", fontWeight: 600 }}>
                  {item.leading}
                  {item.label}
                </span>
                {item.hint && <span style={{ fontSize: "0.66rem", opacity: 0.82 }}>{item.hint}</span>}
              </button>
            );
          })}
        </div>
      </div>
      {rightSlot && <div style={{ display: "flex", gap: "var(--pn-space-2)", alignItems: "center" }}>{rightSlot}</div>}
    </div>
  );
}
