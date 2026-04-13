interface MetricCardProps {
  readonly label: string;
  readonly value: string;
  readonly detail?: string | undefined;
  readonly tone?: string | undefined;
}

export function MetricCard({
  label,
  value,
  detail,
  tone = "var(--color-pn-teal-400)",
}: MetricCardProps) {
  return (
    <div
      style={{
        borderRadius: "var(--pn-radius-lg)",
        padding: "var(--pn-space-4)",
        background: [
          `linear-gradient(135deg, color-mix(in srgb, ${tone} 16%, transparent), transparent 52%)`,
          "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
        ].join(", "),
        border: "1px solid var(--pn-border-default)",
      }}
    >
      <div
        style={{
          fontSize: "0.64rem",
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          color: "var(--pn-text-muted)",
          marginBottom: "var(--pn-space-2)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "1.5rem",
          fontWeight: 650,
          color: "var(--pn-text-primary)",
          lineHeight: 1.04,
        }}
      >
        {value}
      </div>
      {detail && (
        <div
          style={{
            marginTop: "var(--pn-space-2)",
            color: "var(--pn-text-secondary)",
            fontSize: "0.78rem",
            lineHeight: 1.45,
          }}
        >
          {detail}
        </div>
      )}
    </div>
  );
}
