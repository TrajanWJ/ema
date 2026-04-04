import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { APP_CONFIGS } from "@/types/workspace";
import { api } from "@/lib/api";

const config = APP_CONFIGS["outcome-dashboard"];

interface DomainStats {
  count: number;
  success_rate: number;
  avg_tokens: number;
  avg_minutes: number;
}

interface RecentOutcome {
  task_id?: string;
  intent?: string;
  agent?: string;
  domain?: string;
  status?: string;
  tokens_used?: number;
  time_minutes?: number;
  timestamp?: string;
}

interface MetricsSummary {
  total_executions: number;
  success_rate: number;
  avg_tokens: number;
  avg_duration_minutes: number;
  by_domain: Record<string, number>;
  by_agent: Record<string, number>;
  recent: RecentOutcome[];
}

interface ByDomainResponse {
  domains: Record<string, DomainStats>;
}

interface RoutingStats {
  by_intent: Array<{ intent: string; task_count: number; success_rate: number }>;
  most_common_intent: string | null;
  misroute_count: number;
}

const STATUS_COLOR: Record<string, string> = {
  success: "#22C55E",
  completed: "#22C55E",
  failed: "#ef4444",
  running: "#10b981",
  pending: "#f59e0b",
};

function statusColor(status?: string): string {
  if (!status) return "#6b7280";
  return STATUS_COLOR[status] ?? "#6b7280";
}

function fmt(n: number, decimals = 1): string {
  if (!n && n !== 0) return "—";
  return n.toFixed(decimals);
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div
      className="glass-surface"
      style={{
        flex: 1,
        minWidth: 120,
        padding: "14px 16px",
        borderRadius: 8,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        border: "1px solid var(--pn-border-subtle)",
      }}
    >
      <span style={{ fontSize: 11, color: "var(--pn-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </span>
      <span style={{ fontSize: 22, fontWeight: 600, color: accent ?? "var(--pn-text-primary)", fontFamily: "monospace" }}>
        {value}
      </span>
    </div>
  );
}

export function OutcomeDashboard() {
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [byDomain, setByDomain] = useState<Record<string, DomainStats>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [routingStats, setRoutingStats] = useState<RoutingStats | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const [summaryRes, domainRes] = await Promise.all([
        api.get<MetricsSummary>("/metrics/summary"),
        api.get<ByDomainResponse>("/metrics/by_domain"),
      ]);
      setSummary(summaryRes);
      setByDomain(domainRes.domains ?? {});
      setLastRefresh(new Date());
      // Fetch routing stats (best-effort)
      api.get<RoutingStats>("/routing/stats").then((r) => setRoutingStats(r)).catch(() => {});
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Pattern candidates: domains with 5+ successful runs
  const patternCandidates = Object.entries(byDomain).filter(
    ([, stats]) => stats.count >= 5 && stats.success_rate >= 70
  );

  const agentEntries = summary
    ? Object.entries(summary.by_agent).sort(([, a], [, b]) => (b as number) - (a as number))
    : [];

  const domainEntries = Object.entries(byDomain).sort(([, a], [, b]) => b.count - a.count);

  return (
    <AppWindowChrome appId="outcome-dashboard" title={config.title} icon={config.icon} accent={config.accent}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%", overflow: "auto", padding: "0 2px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: "var(--pn-text-muted)", fontFamily: "monospace" }}>
            {lastRefresh ? `refreshed ${lastRefresh.toLocaleTimeString()}` : "loading..."}
          </span>
          <button
            onClick={load}
            style={{
              fontSize: 11,
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid var(--pn-border-subtle)",
              background: "var(--pn-surface)",
              color: "var(--pn-text-secondary)",
              cursor: "pointer",
            }}
          >
            ↻ Refresh
          </button>
        </div>

        {error && (
          <div style={{ padding: 12, borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", fontSize: 12, color: "#ef4444" }}>
            {error}
          </div>
        )}

        {loading && !summary && (
          <div style={{ color: "var(--pn-text-muted)", textAlign: "center", paddingTop: 40, fontSize: 12 }}>
            Loading outcome data...
          </div>
        )}

        {summary && (
          <>
            {/* Top Stats Row */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <StatCard label="Total Executions" value={String(summary.total_executions)} accent={config.accent} />
              <StatCard label="Success Rate" value={`${fmt(summary.success_rate)}%`} accent="#22C55E" />
              <StatCard label="Avg Tokens" value={fmt(summary.avg_tokens, 0)} accent="#6b95f0" />
              <StatCard label="Avg Duration" value={`${fmt(summary.avg_duration_minutes)}m`} accent="#f59e0b" />
            </div>

            {/* Pattern Candidates */}
            {patternCandidates.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: "var(--pn-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                  🔮 Pattern Candidates ({patternCandidates.length})
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {patternCandidates.map(([domain, stats]) => (
                    <div
                      key={domain}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 20,
                        background: "rgba(167,139,250,0.12)",
                        border: "1px solid rgba(167,139,250,0.3)",
                        fontSize: 12,
                        color: "#a78bfa",
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{domain}</span>
                      <span style={{ opacity: 0.7 }}>{stats.count} runs · {fmt(stats.success_rate)}% success</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 12, flex: 1, minHeight: 0 }}>
              {/* Left: By Domain */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: "var(--pn-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                  By Domain
                </div>
                <div className="glass-surface" style={{ borderRadius: 8, border: "1px solid var(--pn-border-subtle)", overflow: "hidden" }}>
                  {domainEntries.length === 0 ? (
                    <div style={{ padding: 16, textAlign: "center", fontSize: 12, color: "var(--pn-text-muted)" }}>No domain data yet</div>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--pn-border-subtle)" }}>
                          <th style={{ padding: "8px 12px", textAlign: "left", color: "var(--pn-text-muted)", fontWeight: 500 }}>Domain</th>
                          <th style={{ padding: "8px 12px", textAlign: "right", color: "var(--pn-text-muted)", fontWeight: 500 }}>Count</th>
                          <th style={{ padding: "8px 12px", textAlign: "right", color: "var(--pn-text-muted)", fontWeight: 500 }}>Success</th>
                          <th style={{ padding: "8px 12px", textAlign: "right", color: "var(--pn-text-muted)", fontWeight: 500 }}>Avg Tokens</th>
                          <th style={{ padding: "8px 12px", textAlign: "right", color: "var(--pn-text-muted)", fontWeight: 500 }}>Avg Min</th>
                        </tr>
                      </thead>
                      <tbody>
                        {domainEntries.map(([domain, stats], i) => (
                          <tr
                            key={domain}
                            style={{ borderBottom: i < domainEntries.length - 1 ? "1px solid var(--pn-border-subtle)" : "none" }}
                          >
                            <td style={{ padding: "7px 12px", color: "var(--pn-text-primary)", fontFamily: "monospace" }}>{domain ?? "—"}</td>
                            <td style={{ padding: "7px 12px", textAlign: "right", color: "var(--pn-text-secondary)" }}>{stats.count}</td>
                            <td style={{ padding: "7px 12px", textAlign: "right", color: stats.success_rate >= 70 ? "#22C55E" : stats.success_rate >= 40 ? "#f59e0b" : "#ef4444" }}>
                              {fmt(stats.success_rate)}%
                            </td>
                            <td style={{ padding: "7px 12px", textAlign: "right", color: "var(--pn-text-secondary)", fontFamily: "monospace" }}>{fmt(stats.avg_tokens, 0)}</td>
                            <td style={{ padding: "7px 12px", textAlign: "right", color: "var(--pn-text-secondary)", fontFamily: "monospace" }}>{fmt(stats.avg_minutes)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Right: By Agent */}
              <div style={{ width: 200 }}>
                <div style={{ fontSize: 11, color: "var(--pn-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                  By Agent
                </div>
                <div className="glass-surface" style={{ borderRadius: 8, border: "1px solid var(--pn-border-subtle)", overflow: "hidden" }}>
                  {agentEntries.length === 0 ? (
                    <div style={{ padding: 16, textAlign: "center", fontSize: 12, color: "var(--pn-text-muted)" }}>No agent data yet</div>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--pn-border-subtle)" }}>
                          <th style={{ padding: "8px 10px", textAlign: "left", color: "var(--pn-text-muted)", fontWeight: 500 }}>Agent</th>
                          <th style={{ padding: "8px 10px", textAlign: "right", color: "var(--pn-text-muted)", fontWeight: 500 }}>Runs</th>
                        </tr>
                      </thead>
                      <tbody>
                        {agentEntries.map(([agent, count], i) => (
                          <tr
                            key={agent ?? "unknown"}
                            style={{ borderBottom: i < agentEntries.length - 1 ? "1px solid var(--pn-border-subtle)" : "none" }}
                          >
                            <td style={{ padding: "7px 10px", color: "var(--pn-text-primary)", fontFamily: "monospace", fontSize: 11 }}>{agent ?? "unknown"}</td>
                            <td style={{ padding: "7px 10px", textAlign: "right", color: "var(--pn-text-secondary)" }}>{count as number}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>

            {/* Recent Executions */}
            <div>
              <div style={{ fontSize: 11, color: "var(--pn-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                Recent Executions
              </div>
              <div className="glass-surface" style={{ borderRadius: 8, border: "1px solid var(--pn-border-subtle)", overflow: "hidden" }}>
                {summary.recent.length === 0 ? (
                  <div style={{ padding: 24, textAlign: "center", fontSize: 12, color: "var(--pn-text-muted)" }}>
                    No executions recorded yet. Run some tasks to see the learning loop in action.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {summary.recent.map((outcome, i) => (
                      <div
                        key={outcome.task_id ?? i}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "8px 12px",
                          borderBottom: i < summary.recent.length - 1 ? "1px solid var(--pn-border-subtle)" : "none",
                        }}
                      >
                        {/* Status badge */}
                        <span
                          style={{
                            fontSize: 10,
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: `${statusColor(outcome.status)}20`,
                            border: `1px solid ${statusColor(outcome.status)}50`,
                            color: statusColor(outcome.status),
                            fontFamily: "monospace",
                            minWidth: 54,
                            textAlign: "center",
                          }}
                        >
                          {outcome.status ?? "?"}
                        </span>
                        {/* Intent */}
                        <span style={{ flex: 1, fontSize: 12, color: "var(--pn-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {outcome.intent ?? outcome.task_id ?? "—"}
                        </span>
                        {/* Domain */}
                        <span style={{ fontSize: 11, color: "var(--pn-text-muted)", fontFamily: "monospace", minWidth: 60, textAlign: "right" }}>
                          {outcome.domain ?? "—"}
                        </span>
                        {/* Tokens */}
                        {outcome.tokens_used != null && (
                          <span style={{ fontSize: 11, color: "#6b95f0", fontFamily: "monospace", minWidth: 50, textAlign: "right" }}>
                            {outcome.tokens_used.toLocaleString()}t
                          </span>
                        )}
                        {/* Duration */}
                        {outcome.time_minutes != null && (
                          <span style={{ fontSize: 11, color: "#f59e0b", fontFamily: "monospace", minWidth: 40, textAlign: "right" }}>
                            {fmt(outcome.time_minutes)}m
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {/* Routing Stats */}
            {routingStats && (
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--pn-text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 8,
                  }}
                >
                  Intent Routing
                </div>
                <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                  <div
                    className="glass-surface"
                    style={{
                      flex: 1,
                      padding: "12px 16px",
                      borderRadius: 8,
                      border: "1px solid var(--pn-border-subtle)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--pn-text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      Most Common Intent
                    </span>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 600,
                        color: "#a78bfa",
                        fontFamily: "monospace",
                        marginTop: 4,
                      }}
                    >
                      {routingStats.most_common_intent ?? "—"}
                    </div>
                  </div>
                  <div
                    className="glass-surface"
                    style={{
                      flex: 1,
                      padding: "12px 16px",
                      borderRadius: 8,
                      border: "1px solid var(--pn-border-subtle)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--pn-text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      Misroutes
                    </span>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 600,
                        color:
                          routingStats.misroute_count > 0 ? "#f59e0b" : "#22c55e",
                        fontFamily: "monospace",
                        marginTop: 4,
                      }}
                    >
                      {routingStats.misroute_count}
                    </div>
                  </div>
                </div>
                <div
                  className="glass-surface"
                  style={{
                    borderRadius: 8,
                    border: "1px solid var(--pn-border-subtle)",
                    overflow: "hidden",
                  }}
                >
                  {routingStats.by_intent.length === 0 ? (
                    <div
                      style={{
                        padding: 16,
                        textAlign: "center",
                        fontSize: 12,
                        color: "var(--pn-text-muted)",
                      }}
                    >
                      No routing data yet
                    </div>
                  ) : (
                    <table
                      style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
                    >
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--pn-border-subtle)" }}>
                          <th
                            style={{
                              padding: "8px 12px",
                              textAlign: "left",
                              color: "var(--pn-text-muted)",
                              fontWeight: 500,
                            }}
                          >
                            Intent
                          </th>
                          <th
                            style={{
                              padding: "8px 12px",
                              textAlign: "right",
                              color: "var(--pn-text-muted)",
                              fontWeight: 500,
                            }}
                          >
                            Tasks
                          </th>
                          <th
                            style={{
                              padding: "8px 12px",
                              textAlign: "right",
                              color: "var(--pn-text-muted)",
                              fontWeight: 500,
                            }}
                          >
                            Success
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {routingStats.by_intent.map((row, i) => (
                          <tr
                            key={row.intent}
                            style={{
                              borderBottom:
                                i < routingStats.by_intent.length - 1
                                  ? "1px solid var(--pn-border-subtle)"
                                  : "none",
                            }}
                          >
                            <td
                              style={{
                                padding: "7px 12px",
                                color: "var(--pn-text-primary)",
                                fontFamily: "monospace",
                              }}
                            >
                              {row.intent}
                            </td>
                            <td
                              style={{
                                padding: "7px 12px",
                                textAlign: "right",
                                color: "var(--pn-text-secondary)",
                              }}
                            >
                              {row.task_count}
                            </td>
                            <td
                              style={{
                                padding: "7px 12px",
                                textAlign: "right",
                                color:
                                  row.success_rate >= 0.7
                                    ? "#22C55E"
                                    : row.success_rate >= 0.4
                                    ? "#f59e0b"
                                    : "#ef4444",
                              }}
                            >
                              {fmt(row.success_rate * 100)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppWindowChrome>
  );
}
