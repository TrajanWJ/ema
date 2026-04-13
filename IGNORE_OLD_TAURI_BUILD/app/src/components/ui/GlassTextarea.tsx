import type { TextareaHTMLAttributes } from "react";

interface GlassTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  readonly uiSize?: "sm" | "md";
}

export function GlassTextarea({
  uiSize = "md",
  className = "",
  ...props
}: GlassTextareaProps) {
  return (
    <textarea
      {...props}
      className={`glass-input glass-textarea glass-input--${uiSize} ${className}`.trim()}
    />
  );
}
