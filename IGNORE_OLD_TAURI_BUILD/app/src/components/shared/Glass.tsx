import type { ReactNode, CSSProperties, ButtonHTMLAttributes, InputHTMLAttributes } from "react";

/* ── Glass Card ─────────────────────────────────────── */

interface GlassCardProps {
  readonly tier?: "ambient" | "surface" | "elevated";
  readonly accent?: string;
  readonly hover?: boolean;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly children: ReactNode;
  readonly onClick?: () => void;
}

export function GlassCard({
  tier = "surface",
  accent,
  hover = false,
  className = "",
  style,
  children,
  onClick,
}: GlassCardProps) {
  const tierClass = `glass-${tier}`;
  const hoverClass = hover ? "glass-card-hover" : "";
  const accentBorder = accent ? { borderColor: `${accent}30` } : undefined;

  return (
    <div
      className={`glass-card ${tierClass} ${hoverClass} ${className}`.trim()}
      style={{ ...accentBorder, ...style }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}

/* ── Glass Button ───────────────────────────────────── */

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly accent?: string;
  readonly variant?: "ghost" | "surface" | "solid";
  readonly size?: "sm" | "md";
  readonly children: ReactNode;
}

export function GlassButton({
  accent,
  variant = "ghost",
  size = "md",
  className = "",
  children,
  style,
  ...props
}: GlassButtonProps) {
  const sizeClass = size === "sm" ? "glass-btn-sm" : "glass-btn-md";
  const variantStyle: CSSProperties =
    variant === "solid" && accent
      ? { background: `${accent}20`, color: accent }
      : variant === "surface"
        ? {}
        : {};

  return (
    <button
      className={`glass-btn glass-btn-${variant} ${sizeClass} ${className}`.trim()}
      style={{ ...variantStyle, ...(accent && variant !== "solid" ? { color: accent } : {}), ...style }}
      {...props}
    >
      {children}
    </button>
  );
}

/* ── Glass Input ────────────────────────────────────── */

interface GlassInputProps extends InputHTMLAttributes<HTMLInputElement> {
  readonly accent?: string;
}

export function GlassInput({ accent, className = "", style, ...props }: GlassInputProps) {
  return (
    <input
      className={`glass-input ${className}`.trim()}
      style={{
        ...(accent ? { "--focus-accent": accent } as CSSProperties : {}),
        ...style,
      }}
      {...props}
    />
  );
}

/* ── Status Dot ─────────────────────────────────────── */

interface StatusDotProps {
  readonly color: string;
  readonly pulse?: boolean;
  readonly size?: "sm" | "md";
}

export function StatusDot({ color, pulse = false, size = "sm" }: StatusDotProps) {
  const px = size === "sm" ? "6px" : "8px";
  return (
    <span
      className={pulse ? "status-dot-pulse" : ""}
      style={{
        display: "inline-block",
        width: px,
        height: px,
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
      }}
    />
  );
}

/* ── Accent Badge ───────────────────────────────────── */

interface AccentBadgeProps {
  readonly color: string;
  readonly children: ReactNode;
}

export function AccentBadge({ color, children }: AccentBadgeProps) {
  return (
    <span
      className="accent-badge"
      style={{ background: `${color}18`, color, borderColor: `${color}30` }}
    >
      {children}
    </span>
  );
}
