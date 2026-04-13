interface TagPillProps {
  readonly label: string;
  readonly tone?: string;
  readonly color?: string;
}

export function TagPill({
  label,
  tone = "rgba(255,255,255,0.06)",
  color = "var(--pn-text-secondary)",
}: TagPillProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 8px",
        borderRadius: 999,
        background: tone,
        color,
        fontSize: "0.72rem",
        lineHeight: 1.1,
      }}
    >
      {label}
    </span>
  );
}
