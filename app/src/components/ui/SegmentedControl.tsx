interface SegmentedControlProps<T extends string> {
  readonly options: readonly { value: T; label: string }[];
  readonly value: T;
  readonly onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div
      className="inline-flex rounded-md p-0.5 gap-0.5"
      style={{ background: "rgba(255, 255, 255, 0.03)" }}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="px-3 py-1 text-[0.7rem] rounded-md transition-colors"
          style={{
            background: value === opt.value ? "rgba(255, 255, 255, 0.06)" : "transparent",
            color:
              value === opt.value
                ? "var(--pn-text-primary)"
                : "var(--pn-text-tertiary)",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
