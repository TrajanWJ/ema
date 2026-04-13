import type { SelectHTMLAttributes } from "react";

interface NativeSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  readonly uiSize?: "sm" | "md";
  readonly wrapperClassName?: string;
}

export function NativeSelect({
  uiSize = "md",
  className = "",
  wrapperClassName = "",
  children,
  ...props
}: NativeSelectProps) {
  return (
    <div className={`pn-select-wrap ${wrapperClassName}`.trim()}>
      <select
        {...props}
        className={`pn-select pn-select--${uiSize} ${className}`.trim()}
      >
        {children}
      </select>
      <span className="pn-select-icon" aria-hidden="true">
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path
            d="M2.25 4.125L5.5 7.125L8.75 4.125"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </div>
  );
}
