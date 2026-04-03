import { useEffect, useMemo, useState } from "react";
import { usePromptStore } from "@/stores/prompt-store";
import type { PromptTemplate } from "@/stores/prompt-store";

const CATEGORIES = ["system", "agent", "task", "custom"] as const;
type Category = (typeof CATEGORIES)[number];

function extractVariables(body: string): string[] {
  const matches = body.match(/\{\{(\w+)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.slice(2, -2)))];
}

const panel = {
  background: "rgba(255, 255, 255, 0.04)",
  border: "1px solid rgba(255, 255, 255, 0.06)",
  borderRadius: "8px",
} as const;

const inputStyle = {
  width: "100%",
  padding: "8px 12px",
  background: "rgba(255, 255, 255, 0.04)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "6px",
  color: "var(--pn-text-primary, rgba(255,255,255,0.87))",
  fontSize: "13px",
  outline: "none",
} as const;

export function PromptWorkshopApp() {
  const {
    templates,
    selected,
    loading,
    testing,
    testResult,
    loadTemplates,
    selectTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    testPrompt,
  } = usePromptStore();

  const [activeCategory, setActiveCategory] = useState<Category>("system");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("custom");
  const [body, setBody] = useState("");

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    if (selected && !editing) {
      setName(selected.name);
      setCategory(selected.category);
      setBody(selected.body);
    }
  }, [selected, editing]);

  const filtered = useMemo(
    () => templates.filter((t) => t.category === activeCategory),
    [templates, activeCategory],
  );

  const variables = useMemo(() => extractVariables(body), [body]);

  function handleNew() {
    selectTemplate(null);
    setEditing(true);
    setName("");
    setCategory(activeCategory);
    setBody("");
  }

  async function handleSave() {
    const attrs = { name, category, body, variables };
    if (selected && !editing) {
      await updateTemplate(selected.id, attrs);
    } else {
      await createTemplate(attrs);
      setEditing(false);
    }
  }

  function handleSelect(t: PromptTemplate) {
    setEditing(false);
    selectTemplate(t);
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "rgba(8, 9, 14, 0.95)",
        color: "var(--pn-text-primary, rgba(255,255,255,0.87))",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Title bar */}
      <div
        data-tauri-drag-region
        style={{
          display: "flex",
          alignItems: "center",
          padding: "10px 16px",
          gap: "8px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          fontSize: "13px",
          fontWeight: 600,
          color: "#f59e0b",
          userSelect: "none",
        }}
      >
        ✦ Prompt Workshop
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left sidebar */}
        <div
          style={{
            width: "240px",
            minWidth: "240px",
            ...panel,
            borderRadius: 0,
            borderTop: "none",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Category tabs */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "4px",
              padding: "10px 10px 6px",
            }}
          >
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setActiveCategory(c)}
                style={{
                  padding: "4px 10px",
                  fontSize: "11px",
                  fontWeight: 500,
                  borderRadius: "4px",
                  border: "none",
                  cursor: "pointer",
                  background:
                    c === activeCategory
                      ? "rgba(245, 158, 11, 0.2)"
                      : "transparent",
                  color:
                    c === activeCategory
                      ? "#f59e0b"
                      : "var(--pn-text-secondary, rgba(255,255,255,0.6))",
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
                padding: "6px",
                fontSize: "12px",
                borderRadius: "5px",
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
            {loading && (
              <p
                style={{
                  padding: "12px",
                  fontSize: "12px",
                  color: "var(--pn-text-muted, rgba(255,255,255,0.25))",
                }}
              >
                Loading…
              </p>
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
                  marginBottom: "2px",
                  fontSize: "12px",
                  borderRadius: "5px",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  background:
                    selected?.id === t.id
                      ? "rgba(255,255,255,0.06)"
                      : "transparent",
                  color: "var(--pn-text-primary, rgba(255,255,255,0.87))",
                }}
              >
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t.name}
                </span>
                <span
                  style={{
                    fontSize: "10px",
                    color: "var(--pn-text-muted, rgba(255,255,255,0.25))",
                    marginLeft: "6px",
                    flexShrink: 0,
                  }}
                >
                  v{t.version}
                </span>
              </button>
            ))}
            {!loading && filtered.length === 0 && (
              <p
                style={{
                  padding: "12px",
                  fontSize: "12px",
                  color: "var(--pn-text-muted, rgba(255,255,255,0.25))",
                }}
              >
                No templates
              </p>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {!selected && !editing ? (
            <p
              style={{
                color: "var(--pn-text-muted, rgba(255,255,255,0.25))",
                fontSize: "13px",
                margin: "auto",
              }}
            >
              Select a template or create a new one
            </p>
          ) : (
            <>
              {/* Name */}
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Template name"
                style={inputStyle}
              />

              {/* Category select */}
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>

              {/* Body textarea */}
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Prompt body… Use {{variable}} for template variables"
                rows={12}
                style={{
                  ...inputStyle,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "12px",
                  lineHeight: 1.6,
                  resize: "vertical",
                }}
              />

              {/* Variables */}
              {variables.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "6px",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: "11px",
                      color:
                        "var(--pn-text-secondary, rgba(255,255,255,0.6))",
                    }}
                  >
                    Variables:
                  </span>
                  {variables.map((v) => (
                    <span
                      key={v}
                      style={{
                        padding: "2px 8px",
                        fontSize: "11px",
                        fontFamily: "'JetBrains Mono', monospace",
                        borderRadius: "4px",
                        background: "rgba(245, 158, 11, 0.12)",
                        color: "#f59e0b",
                        border: "1px solid rgba(245, 158, 11, 0.25)",
                      }}
                    >
                      {`{{${v}}}`}
                    </span>
                  ))}
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={handleSave}
                  disabled={!name.trim() || !body.trim()}
                  style={{
                    padding: "7px 18px",
                    fontSize: "12px",
                    fontWeight: 500,
                    borderRadius: "5px",
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
                  onClick={() => testPrompt(body)}
                  disabled={testing || !body.trim()}
                  style={{
                    padding: "7px 18px",
                    fontSize: "12px",
                    fontWeight: 500,
                    borderRadius: "5px",
                    border: "1px solid rgba(255,255,255,0.08)",
                    cursor: "pointer",
                    background: "rgba(255,255,255,0.04)",
                    color:
                      "var(--pn-text-secondary, rgba(255,255,255,0.6))",
                    opacity: testing || !body.trim() ? 0.4 : 1,
                  }}
                >
                  {testing ? "Testing…" : "Test"}
                </button>
                {selected && !editing && (
                  <button
                    onClick={() => deleteTemplate(selected.id)}
                    style={{
                      padding: "7px 18px",
                      fontSize: "12px",
                      borderRadius: "5px",
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
              {testResult !== null && (
                <div
                  style={{
                    ...panel,
                    padding: "12px",
                    fontSize: "12px",
                    fontFamily: "'JetBrains Mono', monospace",
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    color:
                      "var(--pn-text-secondary, rgba(255,255,255,0.6))",
                    maxHeight: "200px",
                    overflowY: "auto",
                  }}
                >
                  {testResult}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
