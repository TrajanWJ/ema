import styles from "./LoadingSpinner.module.css";

type SpinnerSize = "sm" | "md" | "lg";

interface LoadingSpinnerProps {
  readonly size?: SpinnerSize;
  readonly label?: string;
  readonly padded?: boolean;
}

const SIZE_CLASS = {
  sm: styles["size-sm"],
  md: styles["size-md"],
  lg: styles["size-lg"],
} satisfies Record<SpinnerSize, string | undefined>;

export function LoadingSpinner({
  size = "md",
  label,
  padded = true,
}: LoadingSpinnerProps) {
  return (
    <div
      className={[styles.root, padded ? styles.rootPadded : undefined]
        .filter(Boolean)
        .join(" ")}
      role="status"
      aria-live="polite"
    >
      <div className={[styles.spinner, SIZE_CLASS[size]].filter(Boolean).join(" ")} />
      {label && <span className={styles.label}>{label}</span>}
    </div>
  );
}

export type { SpinnerSize };
