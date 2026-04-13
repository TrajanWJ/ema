import { useState, useRef, useEffect, useCallback } from "react";

interface Option {
  value: string;
  label: string;
}

interface GlassSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  size?: "sm" | "md";
}

export function GlassSelect({
  value,
  onChange,
  options,
  placeholder,
  className = "",
  size = "sm",
}: GlassSelectProps) {
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const label = selected?.label ?? placeholder ?? "Select\u2026";

  const close = useCallback(() => {
    setOpen(false);
    setHighlightIdx(-1);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, close]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
          e.preventDefault();
          setOpen(true);
          setHighlightIdx(options.findIndex((o) => o.value === value));
        }
        return;
      }
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightIdx((i) => Math.min(i + 1, options.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightIdx((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (highlightIdx >= 0 && highlightIdx < options.length) {
            onChange(options[highlightIdx].value);
            close();
          }
          break;
        case "Escape":
          e.preventDefault();
          close();
          break;
      }
    },
    [open, highlightIdx, options, value, onChange, close],
  );

  useEffect(() => {
    if (!open || highlightIdx < 0 || !listRef.current) return;
    const el = listRef.current.children[highlightIdx] as HTMLElement;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlightIdx, open]);

  const isSmall = size === "sm";
  const pad = isSmall ? "px-2.5 py-1.5" : "px-3 py-2";
  const textSize = isSmall ? "text-[0.7rem]" : "text-[0.8rem]";

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* trigger */}
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) setHighlightIdx(options.findIndex((o) => o.value === value));
        }}
        onKeyDown={handleKeyDown}
        className={`w-full flex items-center justify-between gap-2 rounded-lg ${pad} ${textSize} cursor-pointer focus:outline-none`}
        style={{
          background: open
            ? "var(--pn-field-bg-active)"
            : "var(--pn-field-bg)",
          backdropFilter: "blur(12px) saturate(130%)",
          WebkitBackdropFilter: "blur(12px) saturate(130%)",
          border: open
            ? "1px solid rgba(45, 212, 168, 0.35)"
            : "1px solid var(--pn-border-default)",
          boxShadow: open
            ? "var(--pn-focus-ring), inset 0 1px 0 rgba(255, 255, 255, 0.04)"
            : "inset 0 1px 0 rgba(255, 255, 255, 0.03)",
          color: selected
            ? "var(--pn-text-primary)"
            : "var(--pn-text-tertiary)",
          transition: "all 200ms cubic-bezier(0.65, 0.05, 0, 1)",
        }}
      >
        <span className="truncate">{label}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          className="shrink-0"
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 250ms cubic-bezier(0.65, 0.05, 0, 1)",
            opacity: 0.4,
          }}
        >
          <path
            d="M2 3.5L5 6.5L8 3.5"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* dropdown panel */}
      {open && (
        <div
          ref={listRef}
          className="absolute z-50 w-full overflow-y-auto overflow-x-hidden"
          style={{
            marginTop: "4px",
            borderRadius: "10px",
            background: "var(--pn-dropdown-bg)",
            backdropFilter: "blur(28px) saturate(180%)",
            WebkitBackdropFilter: "blur(28px) saturate(180%)",
            border: "1px solid var(--pn-border-default)",
            boxShadow: [
              "var(--pn-dropdown-shadow)",
              "inset 0 1px 0 rgba(255, 255, 255, 0.06)",
              "inset 0 -1px 0 rgba(255, 255, 255, 0.02)",
            ].join(", "),
            maxHeight: "200px",
            padding: "3px",
            animation: "glassDropIn 150ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
          role="listbox"
        >
          {options.map((opt, idx) => {
            const isSelected = opt.value === value;
            const isHighlighted = idx === highlightIdx;

            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`w-full text-left ${pad} ${textSize} cursor-pointer flex items-center gap-2`}
                style={{
                  borderRadius: "7px",
                  color: isSelected
                    ? "var(--color-pn-primary-400)"
                    : isHighlighted
                      ? "var(--pn-text-primary)"
                      : "var(--pn-text-secondary)",
                  background: isHighlighted
                    ? "rgba(255, 255, 255, 0.07)"
                    : isSelected
                      ? "rgba(45, 212, 168, 0.06)"
                      : "transparent",
                  transition: "background 100ms ease, color 100ms ease",
                }}
                onMouseEnter={() => setHighlightIdx(idx)}
                onMouseLeave={() => setHighlightIdx(-1)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(opt.value);
                  close();
                }}
              >
                <span
                  className="shrink-0 flex items-center justify-center"
                  style={{ width: "14px" }}
                >
                  {isSelected && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path
                        d="M2 5.5L4 7.5L8 3"
                        stroke="var(--color-pn-primary-400)"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                <span className="truncate">{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
