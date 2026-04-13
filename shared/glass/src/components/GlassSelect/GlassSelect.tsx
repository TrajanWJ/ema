import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import styles from "./GlassSelect.module.css";

export interface GlassSelectOption {
  readonly value: string;
  readonly label: string;
}

type SelectSize = "sm" | "md";

interface GlassSelectProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly options: readonly GlassSelectOption[];
  readonly placeholder?: string;
  readonly uiSize?: SelectSize;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly ariaLabel?: string;
}

const SIZE_CLASS = {
  sm: styles["size-sm"],
  md: styles["size-md"],
} satisfies Record<SelectSize, string | undefined>;

/**
 * GlassSelect — keyboard-navigable dropdown. Ported from the old
 * ui/GlassSelect.tsx. No Tauri dependencies, no Tailwind classes, only
 * tokens + CSS module. Requires keyframes.css in the host document.
 */
export function GlassSelect({
  value,
  onChange,
  options,
  placeholder,
  uiSize = "sm",
  className,
  disabled,
  ariaLabel,
}: GlassSelectProps) {
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const label = selected?.label ?? placeholder ?? "Select";

  const close = useCallback(() => {
    setOpen(false);
    setHighlightIdx(-1);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      // MouseEvent.target is EventTarget | null; Node.contains needs Node.
      // Document-level mousedown always fires with a DOM Node target.
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, close]);

  useEffect(() => {
    if (!open || highlightIdx < 0 || !listRef.current) return;
    const el = listRef.current.children[highlightIdx];
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIdx, open]);

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (!open) {
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
          e.preventDefault();
          setOpen(true);
          setHighlightIdx(options.findIndex((o) => o.value === value));
        }
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIdx((i) => Math.min(i + 1, options.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const picked = options[highlightIdx];
        if (picked) {
          onChange(picked.value);
          close();
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    },
    [open, highlightIdx, options, value, onChange, close],
  );

  const triggerCls = [
    styles.trigger,
    SIZE_CLASS[uiSize],
    open ? styles.triggerOpen : undefined,
    selected ? undefined : styles.triggerPlaceholder,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
    >
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={triggerCls}
        onClick={() => {
          if (disabled) return;
          setOpen((o) => !o);
          if (!open) {
            setHighlightIdx(options.findIndex((o) => o.value === value));
          }
        }}
        onKeyDown={handleKeyDown}
      >
        <span className={styles.truncate}>{label}</span>
        <svg
          viewBox="0 0 10 10"
          fill="none"
          className={[styles.chevron, open ? styles.chevronOpen : undefined]
            .filter(Boolean)
            .join(" ")}
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

      {open && (
        <div ref={listRef} className={styles.panel} role="listbox">
          {options.map((opt, idx) => {
            const isSelected = opt.value === value;
            const isHighlighted = idx === highlightIdx;
            const cls = [
              styles.option,
              SIZE_CLASS[uiSize],
              isHighlighted ? styles.optionHighlighted : undefined,
              isSelected ? styles.optionSelected : undefined,
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={cls}
                onMouseEnter={() => setHighlightIdx(idx)}
                onMouseLeave={() => setHighlightIdx(-1)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(opt.value);
                  close();
                }}
              >
                <span className={styles.optionCheck}>
                  {isSelected && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path
                        d="M2 5.5L4 7.5L8 3"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                <span className={styles.truncate}>{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export type { SelectSize };
