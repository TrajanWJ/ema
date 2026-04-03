import { useEffect, useMemo, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { usePromptStore } from "@/stores/prompt-store";
import type { PromptTemplate } from "@/stores/prompt-store";
import { APP_CONFIGS } from "@/types/workspace";

const config = APP_CONFIGS["prompt-workshop"];

const CATEGORIES = ["system", "agent", "task", "custom"] as const;
type Category = (typeof CATEGORIES)[number];

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
    </AppWindowChrome>
  );
}
