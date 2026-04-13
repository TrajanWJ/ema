import styles from "./StatusDot.module.css";

type DotKind = "idle" | "running" | "success" | "warning" | "error" | "info";
type DotSize = "sm" | "md";

interface StatusDotProps {
  readonly kind: DotKind;
  readonly size?: DotSize;
  readonly label?: string;
  readonly pulse?: boolean;
}

const KIND_CLASS = {
  idle: styles["kind-idle"],
  running: styles["kind-running"],
  success: styles["kind-success"],
  warning: styles["kind-warning"],
  error: styles["kind-error"],
  info: styles["kind-info"],
} satisfies Record<DotKind, string | undefined>;

const SIZE_CLASS = {
  sm: styles["size-sm"],
  md: styles["size-md"],
} satisfies Record<DotSize, string | undefined>;

/**
 * StatusDot — minimal activity indicator. Defaults to no pulse. Pair with a
 * short label ("running", "idle", "failed") — EMA-VOICE: no emojis, no filler.
 */
export function StatusDot({
  kind,
  size = "sm",
  label,
  pulse = false,
}: StatusDotProps) {
  const dotCls = [
    styles.dot,
    KIND_CLASS[kind],
    SIZE_CLASS[size],
    pulse ? styles.pulse : undefined,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={styles.root}>
      <span className={dotCls} />
      {label && <span className={styles.label}>{label}</span>}
    </span>
  );
}

export type { DotKind, DotSize };
