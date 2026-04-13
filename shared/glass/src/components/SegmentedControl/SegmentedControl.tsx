import type { ReactNode } from "react";

export interface SegmentedControlOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly hint?: string;
  readonly leading?: ReactNode;
}

interface SegmentedControlProps<T extends string> {
  readonly value: T;
  readonly options: readonly SegmentedControlOption<T>[];
  readonly onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div
      style={{
        display: "inline-flex",
        gap: "var(--pn-space-2)",
        padding: "var(--pn-space-1_5)",
        borderRadius: "999px",
        background: "var(--pn-field-bg)",
        border: "1px solid var(--pn-border-default)",
        flexWrap: "wrap",
      }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: "2px",
              minWidth: "7.5rem",
              padding: "var(--pn-space-2) var(--pn-space-3)",
              borderRadius: "999px",
              border: "1px solid transparent",
              background: active
                ? "color-mix(in srgb, var(--color-pn-indigo-500) 24%, transparent)"
                : "transparent",
              color: active ? "var(--color-pn-indigo-300)" : "var(--pn-text-secondary)",
              cursor: "pointer",
              transition:
                "background 160ms var(--ease-smooth), color 160ms var(--ease-smooth), border-color 160ms var(--ease-smooth)",
            }}
          >
            <span style={{ display: "flex", gap: "var(--pn-space-2)", alignItems: "center", fontSize: "0.8rem", fontWeight: 600 }}>
              {option.leading}
              {option.label}
            </span>
            {option.hint && (
              <span style={{ fontSize: "0.68rem", opacity: 0.82 }}>{option.hint}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
