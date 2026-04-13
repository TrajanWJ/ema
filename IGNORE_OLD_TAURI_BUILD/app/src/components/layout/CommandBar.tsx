import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import { openApp } from "@/lib/window-manager";

interface SearchResults {
  tasks: Array<{ id: string; title: string; status?: string }>;
  intents: Array<{ id: string; title: string; intent_type?: string }>;
  vault: Array<{ id: string; title: string; file_path?: string }>;
  proposals: Array<{ id: string; title: string; status?: string }>;
  brain_dumps: Array<{ id: string; title: string; item_type?: string }>;
}

type ResultCategory = keyof SearchResults;

const CATEGORY_CONFIG: Record<
  ResultCategory,
  { label: string; icon: string; appId: string }
> = {
  tasks: { label: "Tasks", icon: "\u2611", appId: "tasks" },
  intents: { label: "Intents", icon: "\u25C8", appId: "intent-schematic" },
  vault: { label: "Wiki", icon: "\u2630", appId: "wiki" },
  proposals: { label: "Proposals", icon: "\u2726", appId: "proposals" },
  brain_dumps: { label: "Brain Dumps", icon: "\u26A1", appId: "brain-dump" },
};

const CATEGORY_ORDER: ResultCategory[] = [
  "tasks",
  "intents",
  "vault",
  "proposals",
  "brain_dumps",
];

const EMPTY_RESULTS: SearchResults = {
  tasks: [],
  intents: [],
  vault: [],
  proposals: [],
  brain_dumps: [],
};

function getResultTitle(
  category: ResultCategory,
  item: Record<string, unknown>
): string {
  if (typeof item.title === "string" && item.title) return item.title;
  if (typeof item.name === "string" && item.name) return item.name;
  if (typeof item.file_path === "string" && item.file_path) {
    const parts = item.file_path.split("/");
    return parts[parts.length - 1] ?? item.file_path;
  }
  return `${CATEGORY_CONFIG[category].label} item`;
}

function getResultBadge(
  category: ResultCategory,
  item: Record<string, unknown>
): string | null {
  if (category === "tasks" && typeof item.status === "string")
    return item.status;
  if (category === "proposals" && typeof item.status === "string")
    return item.status;
  if (category === "intents" && typeof item.intent_type === "string")
    return item.intent_type;
  if (category === "brain_dumps" && typeof item.item_type === "string")
    return item.item_type;
  return null;
}

export function CommandBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build flat list of results for keyboard navigation
  const flatResults = CATEGORY_ORDER.flatMap((cat) =>
    results[cat].map((item) => ({ category: cat, item }))
  );

  const totalResults = flatResults.length;

  const open = useCallback(() => {
    setIsOpen(true);
    setQuery("");
    setResults(EMPTY_RESULTS);
    setSelectedIndex(0);
    setLoading(false);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setResults(EMPTY_RESULTS);
    setLoading(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  // Global Ctrl+K listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) {
          close();
        } else {
          open();
        }
      }
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        close();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, open, close]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setResults(EMPTY_RESULTS);
      setLoading(false);
      return;
    }

    setLoading(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const response = await api.post<{ ok: boolean; result: SearchResults }>(
          "/mcp/tools/execute",
          {
            name: "ema_search",
            arguments: { query: query.trim(), scope: "all", limit: 10 },
          }
        );
        if (response.ok && response.result) {
          setResults({
            tasks: response.result.tasks ?? [],
            intents: response.result.intents ?? [],
            vault: response.result.vault ?? [],
            proposals: response.result.proposals ?? [],
            brain_dumps: response.result.brain_dumps ?? [],
          });
        } else {
          setResults(EMPTY_RESULTS);
        }
      } catch {
        setResults(EMPTY_RESULTS);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, isOpen]);

  function handleSelect(category: ResultCategory) {
    const appId = CATEGORY_CONFIG[category].appId;
    close();
    void openApp(appId);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % Math.max(totalResults, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) =>
        i <= 0 ? Math.max(totalResults - 1, 0) : i - 1
      );
    } else if (e.key === "Enter" && totalResults > 0) {
      e.preventDefault();
      const selected = flatResults[selectedIndex];
      if (selected) handleSelect(selected.category);
    }
  }

  // Track which flat index we're at while rendering grouped results
  let flatIndex = 0;

  return (
    <>
      {/* Bottom bar trigger */}
      <div
        className="glass-ambient flex items-center px-4 shrink-0 cursor-pointer"
        style={{
          height: "40px",
          borderTop: "1px solid var(--pn-border-subtle)",
        }}
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") open();
        }}
        role="button"
        tabIndex={0}
      >
        <div className="flex items-center gap-2 flex-1">
          <span
            className="text-[0.65rem]"
            style={{ color: "var(--pn-text-muted)" }}
          >
            &#128269;
          </span>
          <span
            className="text-[0.7rem]"
            style={{ color: "var(--pn-text-secondary)" }}
          >
            Search everything...
          </span>
          <span className="ml-auto text-[0.6rem] px-1.5 py-0.5 rounded"
            style={{
              color: "var(--pn-text-muted)",
              background: "rgba(255, 255, 255, 0.04)",
            }}
          >
            Ctrl+K
          </span>
        </div>
      </div>

      {/* Modal overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
          style={{
            background: "rgba(6, 6, 16, 0.6)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
          onKeyDown={() => {}}
          role="presentation"
        >
          <div
            className="w-full flex flex-col rounded-xl overflow-hidden"
            style={{
              maxWidth: "600px",
              background: "rgba(14, 16, 23, 0.92)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              boxShadow:
                "0 24px 80px rgba(0, 0, 0, 0.6), 0 0 1px rgba(255, 255, 255, 0.1)",
              maxHeight: "60vh",
            }}
          >
            {/* Search input */}
            <div
              className="flex items-center gap-3 px-4"
              style={{
                height: "52px",
                borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
              }}
            >
              <span
                style={{
                  color: loading
                    ? "var(--pn-accent-teal)"
                    : "var(--pn-text-muted)",
                  fontSize: "14px",
                  transition: "color 0.2s",
                }}
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
                onKeyDown={handleKeyDown}
                placeholder="Search across tasks, intents, wiki, proposals..."
                className="bg-transparent border-none outline-none flex-1"
                style={{
                  color: "var(--pn-text-primary)",
                  fontSize: "13px",
                  caretColor: "var(--pn-accent-teal)",
                }}
              />
              <span
                className="px-1.5 py-0.5 rounded text-[0.6rem]"
                style={{
                  color: "var(--pn-text-muted)",
                  background: "rgba(255, 255, 255, 0.04)",
                }}
              >
                ESC
              </span>
            </div>

            {/* Results area */}
            <div
              className="overflow-y-auto"
              style={{ maxHeight: "calc(60vh - 52px)" }}
            >
              {/* Empty / idle state */}
              {!query.trim() && (
                <div
                  className="px-4 py-8 text-center"
                  style={{
                    color: "var(--pn-text-tertiary)",
                    fontSize: "12px",
                  }}
                >
                  Search across tasks, intents, wiki, proposals, and brain
                  dumps
                </div>
              )}

              {/* Loading state */}
              {query.trim() && loading && totalResults === 0 && (
                <div
                  className="px-4 py-6 text-center"
                  style={{
                    color: "var(--pn-text-tertiary)",
                    fontSize: "12px",
                  }}
                >
                  Searching...
                </div>
              )}

              {/* No results */}
              {query.trim() && !loading && totalResults === 0 && (
                <div
                  className="px-4 py-6 text-center"
                  style={{
                    color: "var(--pn-text-tertiary)",
                    fontSize: "12px",
                  }}
                >
                  No results for &ldquo;{query}&rdquo;
                </div>
              )}

              {/* Grouped results */}
              {CATEGORY_ORDER.map((category) => {
                const items = results[category];
                if (items.length === 0) return null;
                const config = CATEGORY_CONFIG[category];
                const startIndex = flatIndex;

                const section = (
                  <div key={category}>
                    {/* Section header */}
                    <div
                      className="px-4 py-1.5 flex items-center gap-2"
                      style={{
                        color: "var(--pn-text-muted)",
                        fontSize: "10px",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        background: "rgba(255, 255, 255, 0.02)",
                      }}
                    >
                      <span>{config.icon}</span>
                      <span>{config.label}</span>
                      <span style={{ opacity: 0.5 }}>({items.length})</span>
                    </div>

                    {/* Items */}
                    {items.map((item, i) => {
                      const currentFlat = startIndex + i;
                      const isSelected = currentFlat === selectedIndex;
                      const badge = getResultBadge(
                        category,
                        item as unknown as Record<string, unknown>
                      );

                      return (
                        <button
                          key={
                            (item as Record<string, unknown>).id
                              ? String((item as Record<string, unknown>).id)
                              : `${category}-${i}`
                          }
                          className="w-full flex items-center gap-3 px-4 py-2 text-left transition-colors"
                          style={{
                            background: isSelected
                              ? "rgba(255, 255, 255, 0.06)"
                              : "transparent",
                            borderLeft: isSelected
                              ? "2px solid var(--pn-accent-teal)"
                              : "2px solid transparent",
                          }}
                          onClick={() => handleSelect(category)}
                          onMouseEnter={() =>
                            setSelectedIndex(currentFlat)
                          }
                        >
                          <span
                            style={{
                              color: "var(--pn-text-muted)",
                              fontSize: "12px",
                              width: "16px",
                              textAlign: "center",
                            }}
                          >
                            {config.icon}
                          </span>
                          <span
                            className="flex-1 truncate"
                            style={{
                              color: isSelected
                                ? "var(--pn-text-primary)"
                                : "var(--pn-text-secondary)",
                              fontSize: "12px",
                            }}
                          >
                            {getResultTitle(
                              category,
                              item as unknown as Record<string, unknown>
                            )}
                          </span>
                          {badge && (
                            <span
                              className="px-1.5 py-0.5 rounded"
                              style={{
                                fontSize: "10px",
                                color: "var(--pn-text-muted)",
                                background: "rgba(255, 255, 255, 0.04)",
                              }}
                            >
                              {badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );

                flatIndex += items.length;
                return section;
              })}
            </div>

            {/* Footer hint */}
            {totalResults > 0 && (
              <div
                className="flex items-center gap-4 px-4"
                style={{
                  height: "32px",
                  borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                  fontSize: "10px",
                  color: "var(--pn-text-muted)",
                }}
              >
                <span>
                  <span style={{ opacity: 0.6 }}>&uarr;&darr;</span> navigate
                </span>
                <span>
                  <span style={{ opacity: 0.6 }}>&crarr;</span> open
                </span>
                <span>
                  <span style={{ opacity: 0.6 }}>esc</span> close
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
