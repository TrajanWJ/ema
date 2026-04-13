import type { ReactNode } from "react";

interface SectionHeaderProps {
  readonly eyebrow?: string;
  readonly title: string;
  readonly description?: string;
  readonly actions?: ReactNode;
  readonly align?: "start" | "center";
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
  align = "start",
}: SectionHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "var(--pn-space-4)",
        alignItems: align === "center" ? "center" : "end",
        flexWrap: "wrap",
      }}
    >
      <div style={{ maxWidth: "var(--pn-layout-reading-measure)" }}>
        {eyebrow && (
          <div
            style={{
              marginBottom: "var(--pn-space-1_5)",
              fontSize: "0.68rem",
              textTransform: "uppercase",
              letterSpacing: "0.16em",
              color: "var(--pn-text-muted)",
            }}
          >
            {eyebrow}
          </div>
        )}
        <div
          style={{
            fontSize: "1.5rem",
            lineHeight: 1.08,
            fontWeight: 650,
            color: "var(--pn-text-primary)",
          }}
        >
          {title}
        </div>
        {description && (
          <div
            style={{
              marginTop: "var(--pn-space-2)",
              color: "var(--pn-text-secondary)",
              lineHeight: 1.55,
              fontSize: "0.88rem",
            }}
          >
            {description}
          </div>
        )}
      </div>
      {actions && <div style={{ display: "flex", gap: "var(--pn-space-2)", alignItems: "center" }}>{actions}</div>}
    </div>
  );
}
