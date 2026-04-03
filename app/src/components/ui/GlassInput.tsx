import type { InputHTMLAttributes } from "react";

interface GlassInputProps extends InputHTMLAttributes<HTMLInputElement> {
  readonly uiSize?: "sm" | "md";
}

export function GlassInput({
  uiSize = "md",
  className = "",
  ...props
}: GlassInputProps) {
  return (
    <input
      {...props}
      className={`glass-input glass-input--${uiSize} ${className}`.trim()}
    />
  );
}
