import { useEffect, useState } from "react";

import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { api } from "@/lib/api";
import { APP_CONFIGS } from "@/types/workspace";

const config = APP_CONFIGS["agents"];

interface RuntimeActor {
  readonly actor_id: string;
  readonly from_state: string | null;
  readonly to_state: string;
  readonly reason: string;
  readonly observed_at: string;
}

interface RuntimeStatusResponse {
  readonly actors: readonly RuntimeActor[];
  readonly count: number;
}

function formatAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function stateColor(state: string): string {
  if (state === "active" || state === "busy") return "#22c55e";
  if (state === "idle") return "#94a3b8";
  if (state === "waiting") return "#60a5fa";
  if (state === "blocked" || state === "error") return "#ef4444";
  return "#a78bfa";
}

export function AgentsApp() {
  const [data, setData] = useState<RuntimeStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<RuntimeStatusResponse>("/agents/status");
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "agents_runtime_unavailable");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <AppWindowChrome appId="agents" title={config.title} icon={config.icon} accent={config.accent}>
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div
          className="rounded-2xl p-4"
          style={{
            background: "linear-gradient(135deg, rgba(167,139,250,0.12), rgba(99,102,241,0.08))",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div className="text-[0.62rem] font-semibold uppercase tracking-[0.18em]" style={{ color: config.accent }}>
            Agent Runtime Monitor
          </div>
          <div className="mt-1 text-[1rem] font-semibold" style={{ color: "var(--pn-text-primary)" }}>
            Honest view of the live agent surface
          </div>
          <p className="mt-2 max-w-3xl text-[0.75rem] leading-[1.6]" style={{ color: "var(--pn-text-secondary)" }}>
            The current services stack does not expose full agent CRUD or duplex chat. What is real today is runtime classification and heartbeat state under `/api/agents/status`, and this app now reflects that directly.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Pill label="Runtime actors" value={String(data?.count ?? 0)} color="#a78bfa" />
            <Pill label="Polling" value="15s" color="#60a5fa" />
            {error ? <Pill label="Status" value="offline" color="#ef4444" /> : null}
          </div>
        </div>

        {error ? (
          <div className="rounded-xl px-3 py-2 text-[0.72rem]" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
            {error}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2">
          <div className="text-[0.58rem] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--pn-text-muted)" }}>
            Runtime transitions
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg px-3 py-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.16em]"
            style={{ background: "rgba(255,255,255,0.04)", color: "var(--pn-text-secondary)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            Refresh
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          {loading ? (
            <Empty label="Loading runtime state..." />
          ) : !data || data.actors.length === 0 ? (
            <Empty label="No runtime actors reported yet." />
          ) : (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {data.actors.map((actor) => (
                <div key={actor.actor_id} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[0.78rem] font-semibold" style={{ color: "var(--pn-text-primary)" }}>
                        {actor.actor_id}
                      </div>
                      <div className="mt-1 text-[0.62rem] font-mono" style={{ color: "var(--pn-text-muted)" }}>
                        observed {formatAgo(actor.observed_at)}
                      </div>
                    </div>
                    <span className="rounded-full px-2.5 py-1 text-[0.58rem] font-semibold uppercase tracking-[0.16em]" style={{ background: `${stateColor(actor.to_state)}18`, color: stateColor(actor.to_state), border: `1px solid ${stateColor(actor.to_state)}28` }}>
                      {actor.to_state}
                    </span>
                  </div>
                  <div className="mt-3 text-[0.7rem]" style={{ color: "var(--pn-text-secondary)" }}>
                    {actor.reason}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[0.62rem] font-mono" style={{ color: "var(--pn-text-muted)" }}>
                    <span>from {actor.from_state ?? "unknown"}</span>
                    <span>to {actor.to_state}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppWindowChrome>
  );
}

function Pill({ label, value, color }: { readonly label: string; readonly value: string; readonly color: string }) {
  return <span className="rounded-full px-2.5 py-1 text-[0.6rem] font-medium" style={{ background: `${color}18`, color, border: `1px solid ${color}28` }}>{label}: {value}</span>;
}

function Empty({ label }: { readonly label: string }) {
  return <div className="flex h-full items-center justify-center text-[0.75rem]" style={{ color: "var(--pn-text-muted)" }}>{label}</div>;
}
