import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import styles from "./CommandBar.module.css";

/**
 * Categories supported by the Cmd+K palette. Matches the old build's
 * CommandBar groupings (A.9) and EMA-VOICE glyphs (A.11):
 *   tasks ☐ · intents ◇ · vault ≡ · proposals ✦ · brain_dumps ⚡
 */
export type CommandCategory =
  | "tasks"
  | "intents"
  | "vault"
  | "proposals"
  | "brain_dumps";

export interface CommandResult {
  readonly id: string;
  readonly title: string;
  readonly badge?: string;
}

export type CommandResults = Readonly<Record<CommandCategory, readonly CommandResult[]>>;

interface CategoryConfig {
  readonly label: string;
  readonly glyph: string;
}

const CATEGORY_ORDER: readonly CommandCategory[] = [
  "tasks",
  "intents",
  "vault",
  "proposals",
  "brain_dumps",
];

const CATEGORY_CONFIG = {
  tasks: { label: "Tasks", glyph: "\u2610" },
  intents: { label: "Intents", glyph: "\u25C7" },
  vault: { label: "Wiki", glyph: "\u2261" },
  proposals: { label: "Proposals", glyph: "\u2726" },
  brain_dumps: { label: "Brain Dumps", glyph: "\u26A1" },
} satisfies Record<CommandCategory, CategoryConfig>;

export const EMPTY_COMMAND_RESULTS: CommandResults = {
  tasks: [],
  intents: [],
  vault: [],
  proposals: [],
  brain_dumps: [],
};

interface CommandBarProps {
  /** Called when the user types (already debounced at 300ms inside). */
  readonly onSearch: (query: string) => Promise<CommandResults> | CommandResults;
  /** Called when the user picks a result. */
  readonly onSelect: (category: CommandCategory, result: CommandResult) => void;
  /** Placeholder when the input is empty. Directive, no fluff. */
  readonly placeholder?: string;
  /** The idle-state hint line. EMA-VOICE register. */
  readonly idleHint?: string;
}

interface FlatEntry {
  readonly category: CommandCategory;
  readonly result: CommandResult;
}

function flatten(results: CommandResults): FlatEntry[] {
  const out: FlatEntry[] = [];
  for (const cat of CATEGORY_ORDER) {
    for (const result of results[cat]) {
      out.push({ category: cat, result });
    }
  }
  return out;
}

/**
 * CommandBar — bottom trigger bar + Cmd+K (or Ctrl+K) palette overlay.
 * Ported from layout/CommandBar.tsx. Decoupled from the old api.post call:
 * the host provides onSearch, which is debounced here.
 *
 * Requires keyframes.css loaded in the document.
 */
export function CommandBar({
  onSearch,
  onSelect,
  placeholder = "Search everything...",
  idleHint = "Search across tasks, intents, wiki, proposals, and brain dumps",
}: CommandBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CommandResults>(EMPTY_COMMAND_RESULTS);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flat = flatten(results);
  const total = flat.length;

  const open = useCallback(() => {
    setIsOpen(true);
    setQuery("");
    setResults(EMPTY_COMMAND_RESULTS);
    setSelectedIndex(0);
    setLoading(false);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setResults(EMPTY_COMMAND_RESULTS);
    setLoading(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) close();
        else open();
      }
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        close();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, open, close]);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults(EMPTY_COMMAND_RESULTS);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = setTimeout(async () => {
      try {
        const r = await onSearch(query.trim());
        setResults(r);
      } catch {
        setResults(EMPTY_COMMAND_RESULTS);
      } finally {
        setLoading(false);
      }
    }, 300);
    debounceRef.current = id;
    return () => clearTimeout(id);
  }, [query, isOpen, onSearch]);

  function handleInputKey(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % Math.max(total, 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => (i <= 0 ? Math.max(total - 1, 0) : i - 1));
      return;
    }
    if (e.key === "Enter" && total > 0) {
      e.preventDefault();
      const picked = flat[selectedIndex];
      if (picked) {
        onSelect(picked.category, picked.result);
        close();
      }
    }
  }

  let flatIndex = 0;

  return (
    <>
      <button type="button" className={styles.trigger} onClick={open}>
        <span className={styles.triggerIcon}>&#9906;</span>
        <span className={styles.triggerLabel}>{placeholder}</span>
        <span className={styles.kbd}>Ctrl+K</span>
      </button>

      {isOpen && (
        <div
          className={styles.overlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
          role="presentation"
        >
          <div className={styles.panel}>
            <div className={styles.inputRow}>
              <span
                className={[
                  styles.inputIcon,
                  loading ? styles.inputIconLoading : undefined,
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {loading ? "\u25CC" : "\u2315"}
              </span>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={handleInputKey}
                placeholder={placeholder}
                className={styles.input}
              />
              <span className={styles.kbd}>ESC</span>
            </div>
            <div className={styles.results}>
              {!query.trim() && <div className={styles.empty}>{idleHint}</div>}
              {query.trim() && loading && total === 0 && (
                <div className={styles.empty}>Searching...</div>
              )}
              {query.trim() && !loading && total === 0 && (
                <div className={styles.empty}>No results for &ldquo;{query}&rdquo;</div>
              )}
              {CATEGORY_ORDER.map((category) => {
                const items = results[category];
                if (items.length === 0) return null;
                const config = CATEGORY_CONFIG[category];
                const startIndex = flatIndex;
                flatIndex += items.length;
                return (
                  <div key={category}>
                    <div className={styles.sectionHeader}>
                      <span>{config.glyph}</span>
                      <span>{config.label}</span>
                      <span className={styles.sectionCount}>({items.length})</span>
                    </div>
                    {items.map((item, i) => {
                      const idx = startIndex + i;
                      const active = idx === selectedIndex;
                      const cls = [styles.option, active ? styles.optionActive : undefined]
                        .filter(Boolean)
                        .join(" ");
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className={cls}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          onClick={() => {
                            onSelect(category, item);
                            close();
                          }}
                        >
                          <span className={styles.optionIcon}>{config.glyph}</span>
                          <span className={styles.optionTitle}>{item.title}</span>
                          {item.badge && (
                            <span className={styles.optionBadge}>{item.badge}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            {total > 0 && (
              <div className={styles.footer}>
                <span>
                  <span className={styles.footerKey}>&uarr;&darr;</span>navigate
                </span>
                <span>
                  <span className={styles.footerKey}>&crarr;</span>open
                </span>
                <span>
                  <span className={styles.footerKey}>esc</span>close
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
