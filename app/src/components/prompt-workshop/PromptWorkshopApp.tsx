import { useEffect, useMemo, useState, useCallback } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { usePromptStore } from "@/stores/prompt-store";
import type { PromptTemplate } from "@/stores/prompt-store";
import { APP_CONFIGS } from "@/types/workspace";
import { doFetch } from "@/lib/api";

const config = APP_CONFIGS["prompt-workshop"];
const BASE = "http://localhost:4488/api";

const CATEGORIES = ["system", "agent", "task", "custom"] as const;
type Category = (typeof CATEGORIES)[number];

type ABStatus = "WINNER" | "TESTING" | "CONTROL" | "INACTIVE";

interface ABVariant {
  id: string;
  name: string;
  usage_count: number;
  success_rate: number;
  status: ABStatus;
}

const STATUS_COLORS: Record<ABStatus, string> = {
  WINNER: "#22c55e",
  TESTING: "#3b82f6",
  CONTROL: "#f59e0b",
  INACTIVE: "#6b7280",
};

function extractVariables(body: string): string[] {
  const matches = body.match(/\{\{(\w+)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.slice(2, -2)))];
}

export function PromptWorkshopApp() {
  const store = usePromptStore();
  const [ready, setReady] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category>("system");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("custom");
  const [body, setBody] = useState("");
  const [abTab, setAbTab] = useState(false);
  const [abResults, setAbResults] = useState<ABVariant[]>([]);
  const [abLoading, setAbLoading] = useState(false);
  const [abError, setAbError] = useState<string | null>(null);

  const fetchAbResults = useCallback(async () => {
    setAbLoading(true);
    setAbError(null);
    try {
      const res = await doFetch(`${BASE}/prompts/ab-results`, {
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { data: ABVariant[] };
      setAbResults(data.data);
    } catch (err) {
      setAbError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setAbLoading(false);
    }
  }, []);

  async function handleActivate(id: string) {
    try {
      const res = await doFetch(`${BASE}/prompts/ab-results/${id}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchAbResults();
    } catch {
      // silent — user sees stale data as cue
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function init() {
      await store.loadTemplates();
      if (!cancelled) setReady(true);
    }
    init();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (store.selected && !editing) {
      setName(store.selected.name);
      setCategory(store.selected.category);
      setBody(store.selected.body);
    }
  }, [store.selected, editing]);

  useEffect(() => {
    if (abTab) fetchAbResults();
  }, [abTab, fetchAbResults]);

  const filtered = useMemo(
    () => store.templates.filter((t) => t.category === activeCategory),
    [store.templates, activeCategory],
  );

  const variables = useMemo(() => extractVariables(body), [body]);

  function handleNew() {
    store.selectTemplate(null);
    setEditing(true);
    setName("");
    setCategory(activeCategory);
    setBody("");
  }

  async function handleSave() {
    const attrs = { name, category, body, variables };
    if (store.selected && !editing) {
      await store.updateTemplate(store.selected.id, attrs);
    } else {
      await store.createTemplate(attrs);
      setEditing(false);
    }
  }

  function handleSelect(t: PromptTemplate) {
    setEditing(false);
    store.selectTemplate(t);
  }

  if (!ready) {
    return (
      <AppWindowChrome appId="prompt-workshop" title={config.title} icon={config.icon} accent={config.accent}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
          <span style={{ fontSize: 13, color: "var(--pn-text-secondary)" }}>Loading...</span>
        </div>
      </AppWindowChrome>
    );
  }

  return (
    <AppWindowChrome appId="prompt-workshop" title={config.title} icon={config.icon} accent={config.accent}>
      {/* Top-level tab bar */}
      <div style={{
        display: "flex",
        gap: 0,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "0 12px",
        background: "rgba(255,255,255,0.02)",
      }}>
        {(["Templates", "A/B Results"] as const).map((label) => {
          const isActive = label === "Templates" ? !abTab : abTab;
          return (
            <button
              key={label}
              onClick={() => setAbTab(label === "A/B Results")}
              style={{
                padding: "8px 16px",
                fontSize: 12,
                fontWeight: 500,
                border: "none",
                cursor: "pointer",
                background: "transparent",
                color: isActive ? "#f59e0b" : "var(--pn-text-secondary)",
                borderBottom: isActive ? "2px solid #f59e0b" : "2px solid transparent",
                marginBottom: -1,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {abTab ? (
        /* A/B Results tab */
        <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
          {abLoading && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
              <span style={{ fontSize: 13, color: "var(--pn-text-secondary)" }}>Loading A/B results...</span>
            </div>
          )}
          {abError && (
            <div style={{ padding: 16, fontSize: 13, color: "#ef4444", textAlign: "center" }}>
              {abError}
            </div>
          )}
          {!abLoading && !abError && abResults.length === 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
              <span style={{ fontSize: 13, color: "var(--pn-text-muted)" }}>No A/B variants yet</span>
            </div>
          )}
          {!abLoading && abResults.length > 0 && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 12,
            }}>
              {abResults.map((v) => {
                const color = STATUS_COLORS[v.status];
                const pct = Math.round(v.success_rate * 100);
                const canActivate = v.status === "TESTING" || v.status === "CONTROL";
                return (
                  <div key={v.id} style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 10,
                    padding: 14,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}>
                    {/* Header: name + badge */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--pn-text-primary)" }}>
                        {v.name}
                      </span>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: "2px 7px",
                        borderRadius: 4,
                        background: `${color}22`,
                        color,
                        letterSpacing: 0.5,
                      }}>
                        {v.status}
                      </span>
                    </div>

                    {/* Usage count */}
                    <div style={{ fontSize: 11, color: "var(--pn-text-secondary)" }}>
                      Uses: <span style={{ color: "var(--pn-text-primary)" }}>{v.usage_count}</span>
                    </div>

                    {/* Success rate bar */}
                    <div>
                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 11,
                        color: "var(--pn-text-secondary)",
                        marginBottom: 4,
                      }}>
                        <span>Success</span>
                        <span style={{ color: "var(--pn-text-primary)" }}>{pct}%</span>
                      </div>
                      <div style={{
                        height: 4,
                        borderRadius: 2,
                        background: "rgba(255,255,255,0.08)",
                        overflow: "hidden",
                      }}>
                        <div style={{
                          width: `${pct}%`,
                          height: "100%",
                          borderRadius: 2,
                          background: color,
                        }} />
                      </div>
                    </div>

                    {/* Activate button */}
                    <button
                      disabled={!canActivate}
                      onClick={() => handleActivate(v.id)}
                      style={{
                        marginTop: "auto",
                        padding: "6px 0",
                        fontSize: 11,
                        fontWeight: 500,
                        borderRadius: 5,
                        border: canActivate
                          ? "1px solid rgba(245, 158, 11, 0.3)"
                          : "1px solid rgba(255,255,255,0.06)",
                        background: canActivate
                          ? "rgba(245, 158, 11, 0.1)"
                          : "rgba(255,255,255,0.03)",
                        color: canActivate ? "#f59e0b" : "var(--pn-text-muted)",
                        cursor: canActivate ? "pointer" : "default",
                        opacity: canActivate ? 1 : 0.5,
                      }}
                    >
                      Activate
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
      <div style={{ display: "flex", height: "100%" }}>
        {/* Left sidebar */}
        <div style={{
          width: 240,
          minWidth: 240,
          borderRight: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          flexDirection: "column",
        }}>
          {/* Category tabs */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "10px 10px 6px" }}>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setActiveCategory(c)}
                style={{
                  padding: "4px 10px",
                  fontSize: 11,
                  fontWeight: 500,
                  borderRadius: 4,
                  border: "none",
                  cursor: "pointer",
                  background: c === activeCategory ? "rgba(245, 158, 11, 0.2)" : "transparent",
                  color: c === activeCategory ? "#f59e0b" : "var(--pn-text-secondary)",
                  textTransform: "capitalize",
                }}
              >
                {c}
              </button>
            ))}
          </div>

          {/* New button */}
          <div style={{ padding: "4px 10px 8px" }}>
            <button
              onClick={handleNew}
              style={{
                width: "100%",
                padding: 6,
                fontSize: 12,
                borderRadius: 5,
                border: "1px solid rgba(245, 158, 11, 0.3)",
                background: "rgba(245, 158, 11, 0.08)",
                color: "#f59e0b",
                cursor: "pointer",
              }}
            >
              + New Template
            </button>
          </div>

          {/* Template list */}
          <div style={{ flex: 1, overflowY: "auto", padding: "0 6px 6px" }}>
            {store.loading && (
              <p style={{ padding: 12, fontSize: 12, color: "var(--pn-text-muted)" }}>Loading...</p>
            )}
            {filtered.map((t) => (
              <button
                key={t.id}
                onClick={() => handleSelect(t)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "8px 10px",
                  marginBottom: 2,
                  fontSize: 12,
                  borderRadius: 5,
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  background: store.selected?.id === t.id ? "rgba(255,255,255,0.06)" : "transparent",
                  color: "var(--pn-text-primary)",
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.name}
                </span>
                <span style={{ fontSize: 10, color: "var(--pn-text-muted)", marginLeft: 6, flexShrink: 0 }}>
                  v{t.version}
                </span>
              </button>
            ))}
            {!store.loading && filtered.length === 0 && (
              <p style={{ padding: 12, fontSize: 12, color: "var(--pn-text-muted)" }}>No templates</p>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div style={{ flex: 1, overflow: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {!store.selected && !editing ? (
            <p style={{ color: "var(--pn-text-muted)", fontSize: 13, margin: "auto" }}>
              Select a template or create a new one
            </p>
          ) : (
            <>
              {/* Name */}
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Template name"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 13,
                  color: "var(--pn-text-primary)",
                  outline: "none",
                }}
              />

              {/* Category select */}
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 13,
                  color: "var(--pn-text-primary)",
                  outline: "none",
                }}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>

              {/* Body textarea */}
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Prompt body... Use {{variable}} for template variables"
                rows={12}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 12,
                  fontFamily: "'JetBrains Mono', monospace",
                  lineHeight: 1.6,
                  color: "var(--pn-text-primary)",
                  outline: "none",
                  resize: "vertical",
                }}
              />

              {/* Variables */}
              {variables.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "var(--pn-text-secondary)" }}>Variables:</span>
                  {variables.map((v) => (
                    <span key={v} style={{
                      padding: "2px 8px",
                      fontSize: 11,
                      fontFamily: "'JetBrains Mono', monospace",
                      borderRadius: 4,
                      background: "rgba(245, 158, 11, 0.12)",
                      color: "#f59e0b",
                      border: "1px solid rgba(245, 158, 11, 0.25)",
                    }}>
                      {`{{${v}}}`}
                    </span>
                  ))}
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={handleSave}
                  disabled={!name.trim() || !body.trim()}
                  style={{
                    padding: "7px 18px",
                    fontSize: 12,
                    fontWeight: 500,
                    borderRadius: 5,
                    border: "none",
                    cursor: "pointer",
                    background: "rgba(245, 158, 11, 0.15)",
                    color: "#f59e0b",
                    opacity: !name.trim() || !body.trim() ? 0.4 : 1,
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => store.testPrompt(body)}
                  disabled={store.testing || !body.trim()}
                  style={{
                    padding: "7px 18px",
                    fontSize: 12,
                    fontWeight: 500,
                    borderRadius: 5,
                    border: "1px solid rgba(255,255,255,0.08)",
                    cursor: "pointer",
                    background: "rgba(255,255,255,0.04)",
                    color: "var(--pn-text-secondary)",
                    opacity: store.testing || !body.trim() ? 0.4 : 1,
                  }}
                >
                  {store.testing ? "Testing..." : "Test"}
                </button>
                {store.selected && !editing && (
                  <button
                    onClick={() => store.deleteTemplate(store.selected!.id)}
                    style={{
                      padding: "7px 18px",
                      fontSize: 12,
                      borderRadius: 5,
                      border: "1px solid rgba(239, 68, 68, 0.2)",
                      cursor: "pointer",
                      background: "rgba(239, 68, 68, 0.08)",
                      color: "#ef4444",
                      marginLeft: "auto",
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>

              {/* Test result */}
              {store.testResult !== null && (
                <div style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 12,
                  fontFamily: "'JetBrains Mono', monospace",
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                  color: "var(--pn-text-secondary)",
                  maxHeight: 200,
                  overflowY: "auto",
                }}>
                  {store.testResult}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      )}
    </AppWindowChrome>
  );
}
