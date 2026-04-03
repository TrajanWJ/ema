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
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1 text-[0.7rem] rounded-md transition-all duration-200 ${active ? "" : "hover:bg-white/5 active:scale-95"}`}
            style={{
              background: active ? "rgba(255, 255, 255, 0.06)" : "transparent",
              color: active
                ? "var(--pn-text-primary)"
                : "var(--pn-text-tertiary)",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
