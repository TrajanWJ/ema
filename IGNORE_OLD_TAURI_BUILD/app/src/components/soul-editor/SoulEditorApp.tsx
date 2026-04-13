import { useEffect } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { useSoulStore } from "@/stores/soul-store";
import { APP_CONFIGS } from "@/types/workspace";
import type { SoulVersion, TestResult } from "@/stores/soul-store";

const config = APP_CONFIGS["soul-editor"];

function simpleMarkdown(md: string): string {
  return md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, '<h3 style="font-size:1rem;font-weight:600;margin:0.8em 0 0.3em;color:var(--pn-text-primary)">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:1.15rem;font-weight:600;margin:1em 0 0.4em;color:var(--pn-text-primary)">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size:1.35rem;font-weight:700;margin:1em 0 0.5em;color:var(--pn-text-primary)">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.06);padding:0.1em 0.35em;border-radius:3px;font-size:0.9em">$1</code>')
    .replace(/^- (.+)$/gm, '<li style="margin:0.2em 0;padding-left:0.3em">$1</li>')
    .replace(/(<li.*<\/li>\n?)+/g, (m) => `<ul style="list-style:disc;padding-left:1.2em;margin:0.4em 0">${m}</ul>`)
    .replace(/\n{2,}/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

function scoreColor(score: number): string {
  if (score >= 7) return "#10b981";
  if (score >= 5) return "#f59e0b";
  return "#ef4444";
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function VersionItem({ v, active, onClick }: {
  readonly v: SoulVersion;
  readonly active: boolean;
  readonly onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      type="button"
      style={{
        display: "block",
        width: "100%",
        padding: "8px 10px",
        textAlign: "left",
        background: active ? "rgba(45,212,168,0.12)" : "transparent",
        border: "none",
        borderLeft: active ? "2px solid var(--pn-accent, #2dd4a8)" : "2px solid transparent",
        cursor: "pointer",
        color: "var(--pn-text-primary)",
        fontSize: "0.8rem",
      }}
    >
      <div style={{ fontWeight: 600 }}>v{v.version}</div>
      <div style={{ color: "var(--pn-text-tertiary)", fontSize: "0.7rem" }}>
        {formatTime(v.timestamp)}
        {v.testResult && (
          <span style={{ marginLeft: 6, color: scoreColor(v.testResult.score) }}>
            {v.testResult.score.toFixed(1)}
          </span>
        )}
      </div>
    </button>
  );
}

function TestPanel({ result, testing }: {
  readonly result: TestResult | null;
  readonly testing: boolean;
}) {
  if (testing) {
    return (
      <div style={{ padding: 16, color: "var(--pn-text-secondary)", fontSize: "0.8rem" }}>
        Running tests…
      </div>
    );
  }
  if (!result) return null;

  return (
    <div style={{ padding: 16, display: "flex", gap: 20, alignItems: "flex-start" }}>
      <div style={{ textAlign: "center", minWidth: 80 }}>
        <div style={{
          fontSize: "2rem",
          fontWeight: 700,
          color: scoreColor(result.score),
          lineHeight: 1,
        }}>
          {result.score.toFixed(1)}
        </div>
        <div style={{
          marginTop: 4,
          fontSize: "0.7rem",
          fontWeight: 600,
          padding: "2px 8px",
          borderRadius: 4,
          display: "inline-block",
          background: result.passed ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
          color: result.passed ? "#10b981" : "#ef4444",
        }}>
          {result.passed ? "PASSED" : "FAILED"}
        </div>
      </div>
      <div style={{ flex: 1, fontSize: "0.78rem", lineHeight: 1.6 }}>
        {result.details.map((d) => (
          <div key={d} style={{ color: d.startsWith("✓") ? "#10b981" : "#ef4444" }}>
            {d}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SoulEditorApp() {
  const {
    content, versions, activeVersionId, saving, testing, deploying,
    testResult, testPanelOpen,
    setContent, save, test, deploy, loadVersion, toggleTestPanel,
  } = useSoulStore();

  useEffect(() => {
    // Auto-save initial version on first mount if none exist
    if (useSoulStore.getState().versions.length === 0) {
      useSoulStore.getState().save();
    }
  }, []);

  const canDeploy = testResult !== null && testResult.score >= 7.0;

  return (
    <AppWindowChrome appId="soul-editor" title={config.title} icon={config.icon} accent={config.accent}>
      <div style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--pn-void, #060610)",
        color: "var(--pn-text-primary)",
      }}>
        {/* Toolbar */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.03)",
          flexShrink: 0,
        }}>
          <span style={{ fontWeight: 600, fontSize: "0.85rem", marginRight: "auto" }}>
            SOUL.md Editor
          </span>

          {testResult && (
            <button
              type="button"
              onClick={toggleTestPanel}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "0.75rem",
                color: scoreColor(testResult.score),
                fontWeight: 600,
              }}
            >
              Score: {testResult.score.toFixed(1)}
            </button>
          )}

          <button
            type="button"
            onClick={save}
            disabled={saving}
            style={{
              padding: "4px 12px",
              fontSize: "0.75rem",
              fontWeight: 600,
              borderRadius: 4,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.06)",
              color: "var(--pn-text-primary)",
              cursor: saving ? "default" : "pointer",
              opacity: saving ? 0.5 : 1,
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>

          <button
            type="button"
            onClick={test}
            disabled={testing}
            style={{
              padding: "4px 12px",
              fontSize: "0.75rem",
              fontWeight: 600,
              borderRadius: 4,
              border: "1px solid rgba(45,212,168,0.3)",
              background: "rgba(45,212,168,0.1)",
              color: "#2dd4a8",
              cursor: testing ? "default" : "pointer",
              opacity: testing ? 0.5 : 1,
            }}
          >
            {testing ? "Testing…" : "Test"}
          </button>

          <div style={{ position: "relative" }} title={canDeploy ? "Deploy SOUL.md" : "Score must be >= 7.0 to deploy"}>
            <button
              type="button"
              onClick={deploy}
              disabled={!canDeploy || deploying}
              style={{
                padding: "4px 12px",
                fontSize: "0.75rem",
                fontWeight: 600,
                borderRadius: 4,
                border: canDeploy ? "1px solid rgba(16,185,129,0.4)" : "1px solid rgba(255,255,255,0.06)",
                background: canDeploy ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.03)",
                color: canDeploy ? "#10b981" : "var(--pn-text-muted)",
                cursor: canDeploy && !deploying ? "pointer" : "default",
                opacity: deploying ? 0.5 : 1,
              }}
            >
              {deploying ? "Deploying…" : "Deploy"}
            </button>
          </div>
        </div>

        {/* Main 3-column area */}
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          {/* Version history */}
          <div style={{
            width: 220,
            flexShrink: 0,
            borderRight: "1px solid rgba(255,255,255,0.06)",
            overflowY: "auto",
            background: "rgba(255,255,255,0.02)",
          }}>
            <div style={{
              padding: "8px 10px",
              fontSize: "0.7rem",
              fontWeight: 600,
              color: "var(--pn-text-tertiary)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
            }}>
              History ({versions.length})
            </div>
            {versions.map((v) => (
              <VersionItem
                key={v.id}
                v={v}
                active={v.id === activeVersionId}
                onClick={() => loadVersion(v.id)}
              />
            ))}
          </div>

          {/* Editor */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              spellCheck={false}
              style={{
                flex: 1,
                resize: "none",
                padding: 16,
                background: "rgba(0,0,0,0.3)",
                border: "none",
                outline: "none",
                color: "var(--pn-text-primary)",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.82rem",
                lineHeight: 1.6,
                tabSize: 2,
              }}
            />
          </div>

          {/* Preview */}
          <div style={{
            flex: 1,
            minWidth: 0,
            borderLeft: "1px solid rgba(255,255,255,0.06)",
            overflowY: "auto",
            padding: 16,
            background: "rgba(255,255,255,0.02)",
          }}>
            <div style={{
              fontSize: "0.7rem",
              fontWeight: 600,
              color: "var(--pn-text-tertiary)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 12,
            }}>
              Preview
            </div>
            <div
              style={{
                fontSize: "0.82rem",
                lineHeight: 1.7,
                color: "var(--pn-text-secondary)",
              }}
              dangerouslySetInnerHTML={{ __html: simpleMarkdown(content) }}
            />
          </div>
        </div>

        {/* Test results panel */}
        {testPanelOpen && (
          <div style={{
            borderTop: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(255,255,255,0.02)",
            flexShrink: 0,
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              padding: "6px 14px",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
            }}>
              <span style={{
                fontSize: "0.7rem",
                fontWeight: 600,
                color: "var(--pn-text-tertiary)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                flex: 1,
              }}>
                Test Results
              </span>
              <button
                type="button"
                onClick={toggleTestPanel}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--pn-text-tertiary)",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                }}
              >
                ×
              </button>
            </div>
            <TestPanel result={testResult} testing={testing} />
          </div>
        )}
      </div>
    </AppWindowChrome>
  );
}
