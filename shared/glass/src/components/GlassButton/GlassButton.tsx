import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./GlassButton.module.css";

type ButtonSize = "sm" | "md";
type ButtonVariant = "default" | "primary" | "ghost" | "danger";

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly uiSize?: ButtonSize;
  readonly variant?: ButtonVariant;
  readonly leading?: ReactNode;
  readonly trailing?: ReactNode;
}

const SIZE_CLASS = {
  sm: styles["size-sm"],
  md: styles["size-md"],
} satisfies Record<ButtonSize, string | undefined>;

const VARIANT_CLASS = {
  default: undefined,
  primary: styles["variant-primary"],
  ghost: styles["variant-ghost"],
  danger: styles["variant-danger"],
} satisfies Record<ButtonVariant, string | undefined>;

/**
 * GlassButton — directive label, no emojis. Default label and aria-label are
 * up to the caller; keep EMA-VOICE register: action-first, no apologies.
 */
export function GlassButton({
  uiSize = "md",
  variant = "default",
  leading,
  trailing,
  className,
  type,
  children,
  ...rest
}: GlassButtonProps) {
  const cls = [styles.root, SIZE_CLASS[uiSize], VARIANT_CLASS[variant], className]
    .filter(Boolean)
    .join(" ");
  return (
    <button type={type ?? "button"} className={cls} {...rest}>
      {leading}
      {children}
      {trailing}
    </button>
  );
}

export type { ButtonSize, ButtonVariant };
