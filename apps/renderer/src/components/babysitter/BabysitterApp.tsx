import { useEffect, useState, useCallback, useRef } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { APP_CONFIGS } from "@/types/workspace";
import { api } from "@/lib/api";

const config = APP_CONFIGS["babysitter"];

type Tab = "health" | "streams";

const REFRESH_MS = 10_000;

interface SubsystemHealth {
  readonly name: string;
  readonly status: "ok" | "degraded" | "down";
  readonly detail: string;
}

interface Anomaly {
  readonly id: string;
  readonly message: string;
  readonly severity: "warning" | "critical";
}

interface StreamInfo {
  readonly name: string;
  readonly rate: number; // events per minute
}

interface BabysitterState {
  readonly subsystems: readonly SubsystemHealth[];
  readonly streams: readonly StreamInfo[];
}

function statusDot(status: "ok" | "degraded" | "down"): { color: string; symbol: string } {
  switch (status) {
    case "ok": return { color: "#10b981", symbol: "\u25CF" };
    case "degraded": return { color: "#f59e0b", symbol: "\u25CF" };
    case "down": return { color: "#ef4444", symbol: "\u25CB" };
  }
}

const MOCK_SUBSYSTEMS: readonly SubsystemHealth[] = [
  { name: "Daemon", status: "ok", detail: "connected (4488)" },
  { name: "WebSocket", status: "ok", detail: "channels active" },
  { name: "Proposal Engine", status: "ok", detail: "running" },
  { name: "VaultWatcher", status: "ok", detail: "synced" },
  { name: "Bridge", status: "down", detail: "not running (fallback)" },
];

const MOCK_STREAMS: readonly StreamInfo[] = [
  { name: "brain_dump", rate: 0 },
  { name: "executions", rate: 0 },
  { name: "intents", rate: 0 },
  { name: "proposals", rate: 0 },
  { name: "tasks", rate: 0 },
  { name: "pipes", rate: 0 },
];

export function BabysitterApp() {
  const [tab, setTab] = useState<Tab>("health");
  const [subsystems, setSubsystems] = useState<readonly SubsystemHealth[]>(MOCK_SUBSYSTEMS);
  const [streams, setStreams] = useState<readonly StreamInfo[]>(MOCK_STREAMS);
  const [anomalies, setAnomalies] = useState<readonly Anomaly[]>([]);
  const [ready, setReady] = useState(false);
  const [babysitterReachable, setBabysitterReachable] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchHealth = useCallback(async () => {
    // Check daemon health
    let daemonOk = false;
    try {
      await api.get<{ status: string }>("/health");
      daemonOk = true;
    } catch {
      daemonOk = false;
    }

    // Try babysitter state
    let babysitterData: BabysitterState | null = null;
    try {
      babysitterData = await api.get<BabysitterState>("/babysitter/state");
      setBabysitterReachable(true);
    } catch {
      setBabysitterReachable(false);
    }

    if (babysitterData?.subsystems) {
      setSubsystems(babysitterData.subsystems);
    } else {
      // Build from what we know
      setSubsystems(
        MOCK_SUBSYSTEMS.map((s) => {
          if (s.name === "Daemon") {
            return daemonOk
              ? { ...s, status: "ok" as const, detail: "connected (4488)" }
              : { ...s, status: "down" as const, detail: "unreachable" };
          }
          return s;
        }),
      );
    }

    if (babysitterData?.streams) {
      setStreams(babysitterData.streams);
    }

    // Check for stuck executions
    const newAnomalies: Anomaly[] = [];
    try {
      const execRes = await api.get<{ executions: readonly { id: string; status: string; updated_at: string; title: string }[] }>("/executions");
      const oneHourAgo = Date.now() - 3600_000;
      const stuck = execRes.executions.filter(
        (e) => e.status === "running" && new Date(e.updated_at).getTime() < oneHourAgo,
      );
      if (stuck.length > 0) {
        newAnomalies.push({
          id: "stuck_executions",
          message: `${stuck.length} execution${stuck.length > 1 ? "s" : ""} stuck >1h`,
          severity: "warning",
        });
      }
    } catch {
      // executions endpoint unavailable
    }

    if (!babysitterReachable) {
      newAnomalies.push({
        id: "babysitter_unreachable",
        message: "Babysitter endpoint unreachable",
        severity: "warning",
      });
    }

    if (!daemonOk) {
      newAnomalies.push({
        id: "daemon_down",
        message: "Daemon health check failed",
        severity: "critical",
      });
    }

    // Check for bridge fallback
    const bridgeSub = subsystems.find((s) => s.name === "Bridge");
    if (bridgeSub?.status === "down") {
      newAnomalies.push({
        id: "bridge_fallback",
        message: "Bridge fallback active",
        severity: "warning",
      });
    }

    setAnomalies(newAnomalies);
    setReady(true);
  }, [babysitterReachable, subsystems]);

  useEffect(() => {
    fetchHealth();
    timerRef.current = setInterval(fetchHealth, REFRESH_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) {
    return (
      <AppWindowChrome appId="babysitter" title={config.title} icon={config.icon} accent={config.accent}>
        <div className="flex items-center justify-center h-full">
          <span className="text-[0.8rem]" style={{ color: "var(--pn-text-secondary)" }}>Loading...</span>
        </div>
      </AppWindowChrome>
    );
  }

  return (
    <AppWindowChrome
      appId="babysitter"
      title={config.title}
      icon={config.icon}
      accent={config.accent}
      breadcrumb={tab === "health" ? "Health" : "Streams"}
    >
      {!babysitterReachable && (
        <div className="mb-3 px-3 py-2 rounded-lg text-[0.7rem]" style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>
          Unable to reach babysitter — showing partial data
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-0 mb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {(["health", "streams"] as const).map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-2 transition-colors capitalize"
              style={{
                fontSize: "12px",
                background: active ? "rgba(245,158,11,0.15)" : "transparent",
                borderBottom: active ? "2px solid #f59e0b" : "2px solid transparent",
                color: active ? "var(--pn-text-primary)" : "var(--pn-text-tertiary)",
              }}
            >
              {t}
            </button>
          );
        })}
      </div>

      {tab === "health" && (
        <div className="flex flex-col gap-5">
          {/* System Health */}
          <Section title="System Health">
            <div className="flex flex-col gap-2">
              {subsystems.map((s) => {
                const dot = statusDot(s.status);
                return (
                  <div key={s.name} className="flex items-center gap-2">
                    <span style={{ color: dot.color, fontSize: "10px" }}>{dot.symbol}</span>
                    <span className="text-[0.75rem] w-32" style={{ color: "var(--pn-text-primary)" }}>
                      {s.name}
                    </span>
                    <span className="text-[0.7rem] font-mono" style={{ color: "var(--pn-text-muted)" }}>
                      {s.detail}
                    </span>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* Anomalies */}
          <Section title="Recent Anomalies">
            {anomalies.length === 0 ? (
              <p className="text-[0.7rem]" style={{ color: "var(--pn-text-muted)" }}>
                No anomalies detected
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {anomalies.map((a) => (
                  <div key={a.id} className="flex items-center gap-2">
                    <span style={{ color: a.severity === "critical" ? "#ef4444" : "#f59e0b", fontSize: "12px" }}>
                      {a.severity === "critical" ? "\u26D4" : "\u26A0"}
                    </span>
                    <span
                      className="text-[0.7rem]"
                      style={{ color: a.severity === "critical" ? "#ef4444" : "#f59e0b" }}
                    >
                      {a.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}

      {tab === "streams" && (
        <div className="flex flex-col gap-5">
          <Section title="Stream Monitor">
            <div className="flex flex-col gap-2">
              {streams.map((s) => (
                <StreamRow key={s.name} name={s.name} rate={s.rate} />
              ))}
            </div>
          </Section>
        </div>
      )}
    </AppWindowChrome>
  );
}

/* --- Sub-components --- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-lg p-3"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div
        className="text-[0.6rem] font-semibold uppercase tracking-widest mb-3"
        style={{ color: "var(--pn-text-muted)" }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function StreamRow({ name, rate }: { name: string; rate: number }) {
  const maxBars = 10;
  const filled = Math.min(Math.round(rate), maxBars);
  const barColor = rate > 5 ? "#10b981" : rate > 0 ? "#3b82f6" : "rgba(255,255,255,0.08)";
  const label = rate > 0 ? `${rate} events/min` : "idle";

  return (
    <div className="flex items-center gap-3">
      <span
        className="text-[0.7rem] font-mono w-28 truncate"
        style={{ color: "var(--pn-text-secondary)" }}
      >
        {name}
      </span>
      <div className="flex gap-0.5 flex-1">
        {Array.from({ length: maxBars }, (_, i) => (
          <div
            key={i}
            className="h-2 flex-1 rounded-sm"
            style={{
              background: i < filled ? barColor : "rgba(255,255,255,0.06)",
            }}
          />
        ))}
      </div>
      <span className="text-[0.6rem] font-mono w-24 text-right" style={{ color: "var(--pn-text-muted)" }}>
        {label}
      </span>
    </div>
  );
}
