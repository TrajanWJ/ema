export interface ActivityTimelineItem {
  readonly id: string;
  readonly title: string;
  readonly meta?: string;
  readonly body?: string;
  readonly tone?: string;
}

interface ActivityTimelineProps {
  readonly items: readonly ActivityTimelineItem[];
  readonly emptyLabel?: string;
}

export function ActivityTimeline({
  items,
  emptyLabel = "No activity yet.",
}: ActivityTimelineProps) {
  if (items.length === 0) {
    return <div style={{ color: "var(--pn-text-muted)", fontSize: "0.78rem" }}>{emptyLabel}</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--pn-space-3)" }}>
      {items.map((item) => (
        <div key={item.id} style={{ display: "grid", gridTemplateColumns: "14px minmax(0, 1fr)", gap: "var(--pn-space-3)" }}>
          <div style={{ display: "flex", justifyContent: "center", paddingTop: "4px" }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: item.tone ?? "var(--color-pn-teal-400)",
                boxShadow: `0 0 0 4px color-mix(in srgb, ${item.tone ?? "var(--color-pn-teal-400)"} 16%, transparent)`,
              }}
            />
          </div>
          <div
            style={{
              borderRadius: "var(--pn-radius-lg)",
              border: "1px solid var(--pn-border-default)",
              background: "rgba(255,255,255,0.025)",
              padding: "var(--pn-space-3)",
            }}
          >
            <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--pn-text-primary)" }}>{item.title}</div>
            {item.meta && (
              <div style={{ marginTop: "4px", color: "var(--pn-text-tertiary)", fontSize: "0.7rem" }}>{item.meta}</div>
            )}
            {item.body && (
              <div style={{ marginTop: "var(--pn-space-2)", color: "var(--pn-text-secondary)", lineHeight: 1.5, fontSize: "0.78rem" }}>
                {item.body}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
