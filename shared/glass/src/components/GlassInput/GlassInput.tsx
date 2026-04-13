import type { InputHTMLAttributes } from "react";
import styles from "./GlassInput.module.css";

type InputSize = "sm" | "md";

interface GlassInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  readonly uiSize?: InputSize;
}

const SIZE_CLASS = {
  sm: styles["size-sm"],
  md: styles["size-md"],
} satisfies Record<InputSize, string | undefined>;

export function GlassInput({
  uiSize = "md",
  className,
  ...rest
}: GlassInputProps) {
  const cls = [styles.root, SIZE_CLASS[uiSize], className]
    .filter(Boolean)
    .join(" ");
  return <input className={cls} {...rest} />;
}

export type { InputSize };
