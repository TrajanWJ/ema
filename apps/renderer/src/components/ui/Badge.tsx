interface BadgeProps {
  readonly count: number;
  readonly color?: string;
}

export function Badge({ count, color = "var(--color-pn-error)" }: BadgeProps) {
  if (count <= 0) return null;

  return (
    <span
      className="inline-flex items-center justify-center rounded-full text-[0.6rem] font-medium leading-none px-1"
      style={{
        minWidth: "16px",
        height: "16px",
        background: color,
        color: "#fff",
      }}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
