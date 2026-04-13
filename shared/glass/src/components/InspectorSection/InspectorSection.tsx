import type { ReactNode } from "react";

interface InspectorSectionProps {
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
}

export function InspectorSection({
  title,
  description,
  children,
}: InspectorSectionProps) {
  return (
    <div
      style={{
        borderRadius: "var(--pn-radius-xl)",
        border: "1px solid var(--pn-border-default)",
        background: "rgba(255,255,255,0.025)",
        padding: "var(--pn-space-4)",
      }}
    >
      <div style={{ fontSize: "0.82rem", fontWeight: 620, color: "var(--pn-text-primary)" }}>{title}</div>
      {description && (
        <div style={{ marginTop: "var(--pn-space-1_5)", color: "var(--pn-text-secondary)", fontSize: "0.76rem", lineHeight: 1.5 }}>
          {description}
        </div>
      )}
      <div style={{ marginTop: "var(--pn-space-3)" }}>{children}</div>
    </div>
  );
}
