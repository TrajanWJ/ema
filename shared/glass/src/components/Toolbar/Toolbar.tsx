import type { ReactNode } from "react";

interface ToolbarProps {
  readonly left?: ReactNode;
  readonly center?: ReactNode;
  readonly right?: ReactNode;
}

export function Toolbar({ left, center, right }: ToolbarProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "var(--pn-space-4)",
        alignItems: "center",
        flexWrap: "wrap",
        padding: "var(--pn-space-3) var(--pn-space-4)",
        borderRadius: "var(--pn-radius-xl)",
        border: "1px solid var(--pn-border-default)",
        background: "var(--pn-gradient-chrome)",
      }}
    >
      <div style={{ display: "flex", gap: "var(--pn-space-3)", alignItems: "center", minWidth: 0 }}>{left}</div>
      <div style={{ display: "flex", gap: "var(--pn-space-3)", alignItems: "center", minWidth: 0 }}>{center}</div>
      <div style={{ display: "flex", gap: "var(--pn-space-2)", alignItems: "center", marginLeft: "auto" }}>{right}</div>
    </div>
  );
}
