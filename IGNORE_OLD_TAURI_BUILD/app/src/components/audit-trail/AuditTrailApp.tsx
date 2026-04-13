import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { useAuditStore } from "@/stores/audit-store";
import { useSecurityStore } from "@/stores/security-store";
import { APP_CONFIGS } from "@/types/workspace";

const config = APP_CONFIGS["audit-trail"];

export function AuditTrailApp() {
  const audit = useAuditStore();
  const security = useSecurityStore();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        await Promise.all([
          audit.loadEntries(true),
          security.loadPosture(),
        ]);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load audit data");
      }
      if (!cancelled) setReady(true);
    }
    init();
    return () => { cancelled = true; };
  }, []);

  if (!ready) {
    return (
      <AppWindowChrome appId="audit-trail" title={config.title} icon={config.icon} accent={config.accent}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
          <span style={{ fontSize: 13, color: "var(--pn-text-secondary)" }}>Loading...</span>
        </div>
      </AppWindowChrome>
    );
  }

  const posture = security.posture;
  const scoreColor = posture
    ? posture.percent >= 80 ? "#22C55E" : posture.percent >= 50 ? "#f59e0b" : "#EF4444"
    : "var(--pn-text-muted)";

  async function handleRunAudit() {
    await security.runAudit();
  }

  return (
    <AppWindowChrome appId="audit-trail" title={config.title} icon={config.icon} accent={config.accent}>
      <div style={{ padding: 24, color: "var(--pn-text-primary)", height: "100%", overflow: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Audit Trail</h2>
          <button
            onClick={handleRunAudit}
            disabled={security.auditing}
            style={{
              fontSize: 12,
              padding: "6px 14px",
              borderRadius: 6,
              background: "rgba(239,68,68,0.15)",
              color: "#ef4444",
              border: "none",
              cursor: security.auditing ? "default" : "pointer",
              opacity: security.auditing ? 0.5 : 1,
            }}
          >
            {security.auditing ? "Auditing..." : "Run Audit"}
          </button>
        </div>

        {error && (
          <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,0.1)", color: "#ef4444", fontSize: 12 }}>
            {error}
          </div>
        )}

        {/* Posture summary */}
        {posture && (
          <div style={{
            background: "rgba(14, 16, 23, 0.55)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h3 style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>Security Posture</h3>
              <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: "var(--pn-text-muted)" }}>
                {posture.audited_at ? new Date(posture.audited_at).toLocaleString() : ""}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 32, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: scoreColor }}>
                {posture.score}/{posture.max_score}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ width: "100%", height: 8, borderRadius: 999, background: "rgba(255,255,255,0.06)", marginBottom: 4 }}>
                  <div style={{
                    height: "100%",
                    borderRadius: 999,
                    width: `${posture.percent}%`,
                    background: scoreColor,
                    transition: "width 0.5s",
                  }} />
                </div>
                <span style={{ fontSize: 11, color: "var(--pn-text-tertiary)" }}>{posture.percent}% secure</span>
              </div>
            </div>

            {/* Checks */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {posture.checks.map((check) => (
                <div
                  key={check.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "6px 8px",
                    borderRadius: 6,
                    background: check.passed ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)",
                    fontSize: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: check.passed ? "#22C55E" : "#EF4444" }}>
                      {check.passed ? "\u2713" : "\u2717"}
                    </span>
                    <span style={{ color: "var(--pn-text-secondary)" }}>{check.name}</span>
                  </div>
                  <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: "var(--pn-text-tertiary)" }}>
                    {check.points}/{check.max_points}
                  </span>
                </div>
              ))}
            </div>

            {/* Supply chain warnings */}
            {posture.supply_chain_warnings.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <h4 style={{ fontSize: 11, fontWeight: 500, color: "#f59e0b", marginBottom: 6 }}>
                  Supply Chain Warnings ({posture.supply_chain_warnings.length})
                </h4>
                {posture.supply_chain_warnings.map((w) => (
                  <div
                    key={w.id}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 6,
                      background: "rgba(245,158,11,0.08)",
                      marginBottom: 4,
                      fontSize: 11,
                    }}
                  >
                    <div style={{ fontWeight: 500, color: "#f59e0b", marginBottom: 2 }}>{w.title}</div>
                    <div style={{ color: "var(--pn-text-secondary)" }}>{w.description}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!posture && !security.loading && (
          <div style={{
            background: "rgba(14, 16, 23, 0.55)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: 24,
            marginBottom: 16,
            textAlign: "center",
          }}>
            <span style={{ fontSize: 12, color: "var(--pn-text-muted)" }}>No security posture data. Run an audit to get started.</span>
          </div>
        )}

        {/* Audit log */}
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 500, marginBottom: 12, color: "var(--pn-text-secondary)" }}>
            Audit Log ({audit.entries.length}{audit.hasMore ? "+" : ""})
          </h3>
          {audit.entries.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--pn-text-muted)", textAlign: "center", padding: 32 }}>
              No audit entries recorded yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {audit.entries.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    background: "rgba(14, 16, 23, 0.55)",
                    backdropFilter: "blur(20px)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 12,
                    padding: 12,
                    fontSize: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        fontSize: 10,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: "rgba(107,149,240,0.12)",
                        color: "#6b95f0",
                        fontWeight: 500,
                      }}>
                        {entry.action}
                      </span>
                      <span style={{ color: "var(--pn-text-secondary)" }}>{entry.resource_type}</span>
                    </div>
                    <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: "var(--pn-text-muted)" }}>
                      {new Date(entry.inserted_at).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: "var(--pn-text-tertiary)" }}>by {entry.actor}</span>
                    <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: "var(--pn-text-muted)" }}>
                      {entry.resource_id}
                    </span>
                  </div>
                </div>
              ))}
              {audit.hasMore && (
                <button
                  onClick={() => audit.loadEntries(false)}
                  disabled={audit.loading}
                  style={{
                    fontSize: 12,
                    padding: "8px 16px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.04)",
                    color: "var(--pn-text-secondary)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    cursor: audit.loading ? "default" : "pointer",
                    opacity: audit.loading ? 0.5 : 1,
                    marginTop: 4,
                  }}
                >
                  {audit.loading ? "Loading..." : "Load more"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </AppWindowChrome>
  );
}
