// Blueprint Planner vApp — live view of canon, GAC queue, research, intents.
// Uses the blueprint/server.js HTTP API + SSE for live state mirroring.
// Matches the Tauri-era AppWindowChrome pattern used by every other vApp in this renderer.

import { useEffect, useState, useCallback } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { APP_CONFIGS } from "@/types/workspace";
import { GACCardView } from "./GACCardView";

const config = APP_CONFIGS["blueprint-planner"];
const BLUEPRINT_API = "http://127.0.0.1:7777";

interface Decision {
  id: string;
  filename: string;
  title: string;
  status: string;
  subtype?: string;
  decided_by?: string;
}

export interface GACOption {
  label: string;
  title: string;
  description: string;
  implications: string;
}

export interface ParsedGAC {
  question: string;
  context: string;
  options: GACOption[];
  recommendation: string;
  resolution?: string;
}

export interface GACCard {
  dir: string;
  id: string;
  title: string;
  status: string;
  priority: string;
  category: string;
  resolution: string;
  answered_at: string;
  body: string;
  parsed: ParsedGAC;
}

interface ResearchStats {
  total: number;
  categories: Record<string, number>;
}

interface BlueprintState {
  decisions: Decision[];
  gacCards: GACCard[];
  researchStats: ResearchStats;
  extractionStats: { count: number };
  cloneStats: { count: number; names?: string[] };
  scannedAt: string;
}

type TabId = "gac" | "blockers" | "aspirations" | "intents" | "research";

export function BlueprintPlannerApp() {
  const [state, setState] = useState<BlueprintState | null>(null);
  const [tab, setTab] = useState<TabId>("gac");
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const loadState = useCallback(async () => {
    try {
      const res = await fetch(`${BLUEPRINT_API}/api/state`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as BlueprintState;
      setState(data);
      setLastUpdate(new Date().toLocaleTimeString());
      setError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(
        `Can't reach blueprint server at ${BLUEPRINT_API}. Run: node /home/trajan/Projects/ema/blueprint/server.js (${msg})`
      );
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadState();
  }, [loadState]);

  // SSE subscription — re-fetches state when any genesis .md file changes
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource(`${BLUEPRINT_API}/api/events`);
      es.onopen = () => setConnected(true);
      es.onerror = () => setConnected(false);
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.type === "file-change") {
            loadState();
          }
        } catch {
          // ignore
        }
      };
    } catch {
      // EventSource not available
    }
    return () => {
      if (es) es.close();
    };
  }, [loadState]);

  const answerGAC = useCallback(
    async (id: string, option: string) => {
      const ok = window.confirm(`Answer ${id} with option [${option}]?`);
      if (!ok) return;
      try {
        const res = await fetch(`${BLUEPRINT_API}/api/gac/${id}/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ option }),
        });
        if (!res.ok) {
          const err = await res.text();
          throw new Error(err || `HTTP ${res.status}`);
        }
        // Optimistic re-fetch; SSE will also fire but UI feels instant
        await loadState();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        alert(`Failed to save answer: ${msg}`);
      }
    },
    [loadState]
  );

  const appId = "blueprint-planner";
  const title = config?.title || "Blueprint Planner";
  const icon = config?.icon || "📐";
  const accent = config?.accent || "#2dd4a8";

  if (!state && !error) {
    return (
      <AppWindowChrome appId={appId} title={title} icon={icon} accent={accent}>
        <div
          className="flex items-center justify-center h-full text-[0.75rem]"
          style={{ color: "var(--pn-text-secondary)" }}
        >
          Loading blueprint state from ema-genesis/...
        </div>
      </AppWindowChrome>
    );
  }

  if (error && !state) {
    return (
      <AppWindowChrome appId={appId} title={title} icon={icon} accent={accent}>
        <div className="flex flex-col items-center justify-center h-full gap-3 p-8">
          <div
            className="text-[0.75rem] text-center max-w-md"
            style={{ color: "var(--color-pn-error, #E24B4A)" }}
          >
            {error}
          </div>
          <button
            onClick={loadState}
            className="px-3 py-1.5 text-[0.7rem] rounded font-semibold tracking-wider uppercase"
            style={{
              background: "rgba(45, 212, 168, 0.12)",
              color: accent,
              border: "1px solid rgba(45, 212, 168, 0.3)",
            }}
          >
            Retry
          </button>
        </div>
      </AppWindowChrome>
    );
  }

  if (!state) return null;

  const pending = state.gacCards.filter((c) => c.status !== "answered");
  const answered = state.gacCards.filter((c) => c.status === "answered");

  const breadcrumbLabels: Record<TabId, string> = {
    gac: "GAC Queue",
    blockers: "Blockers",
    aspirations: "Aspirations",
    intents: "Intent Graph",
    research: "Research Layer",
  };

  const tabs: { id: TabId; label: string; count: number | null }[] = [
    { id: "gac", label: "GAC Queue", count: pending.length },
    { id: "blockers", label: "Blockers", count: 0 },
    { id: "aspirations", label: "Aspirations", count: 0 },
    { id: "intents", label: "Intent Graph", count: null },
    { id: "research", label: "Research", count: state.researchStats.total || 0 },
  ];

  return (
    <AppWindowChrome
      appId={appId}
      title={title}
      icon={icon}
      accent={accent}
      breadcrumb={breadcrumbLabels[tab]}
    >
      <div className="flex flex-col h-full">
        {/* Tab bar */}
        <div
          className="flex items-stretch px-4 shrink-0"
          style={{
            height: "38px",
            background: "rgba(10, 12, 20, 0.55)",
            borderBottom: "1px solid var(--pn-border-subtle)",
          }}
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5 px-3.5 text-[0.65rem] font-semibold tracking-wider uppercase transition-colors"
              style={{
                color: tab === t.id ? accent : "var(--pn-text-secondary)",
                borderBottom:
                  tab === t.id ? `2px solid ${accent}` : "2px solid transparent",
                background: "transparent",
              }}
            >
              {t.label}
              {t.count !== null && t.count > 0 && (
                <span
                  className="px-1.5 rounded text-[0.5rem] font-mono"
                  style={{
                    background: "rgba(45, 212, 168, 0.12)",
                    color: accent,
                    border: "1px solid rgba(45, 212, 168, 0.25)",
                  }}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
          <div
            className="ml-auto flex items-center gap-2 text-[0.55rem] font-mono"
            style={{ color: "var(--pn-text-muted)" }}
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{
                background: connected
                  ? "var(--color-pn-success, #22C55E)"
                  : "var(--color-pn-warning, #EAB308)",
              }}
            />
            {connected ? "LIVE" : "OFFLINE"}
            {lastUpdate && ` · ${lastUpdate}`}
          </div>
        </div>

        {/* Panels */}
        <div className="flex-1 overflow-auto p-5">
          {tab === "gac" && (
            <div className="flex flex-col gap-4">
              {pending.length === 0 && (
                <div
                  className="text-center py-10 text-[0.75rem]"
                  style={{ color: "var(--pn-text-muted)" }}
                >
                  No pending GAC cards. All locked.
                </div>
              )}
              {pending.map((card, i) => (
                <GACCardView
                  key={card.id}
                  card={card}
                  index={i}
                  total={pending.length}
                  accent={accent}
                  onAnswer={answerGAC}
                />
              ))}

              {answered.length > 0 && (
                <div className="mt-4">
                  <div
                    className="text-[0.55rem] font-mono uppercase tracking-wider mb-2"
                    style={{ color: "var(--pn-text-tertiary)" }}
                  >
                    Answered ({answered.length})
                  </div>
                  {answered.map((card) => (
                    <div
                      key={card.id}
                      className="py-2 px-3 mb-1 rounded flex items-center gap-3 text-[0.7rem]"
                      style={{
                        background: "rgba(20, 23, 33, 0.4)",
                        border: "1px solid var(--pn-border-subtle)",
                      }}
                    >
                      <span
                        className="font-mono font-semibold"
                        style={{ color: accent }}
                      >
                        {card.id}
                      </span>
                      <span
                        className="flex-1 truncate"
                        style={{ color: "var(--pn-text-secondary)" }}
                      >
                        {card.title.replace(/^"|"$/g, "")}
                      </span>
                      <span
                        className="text-[0.5rem] font-mono px-1.5 py-0.5 rounded"
                        style={{
                          background: "rgba(34, 197, 94, 0.1)",
                          color: "var(--color-pn-success, #22C55E)",
                          border: "1px solid rgba(34, 197, 94, 0.25)",
                        }}
                      >
                        ANSWERED
                      </span>
                      {card.resolution && (
                        <span
                          className="text-[0.5rem] font-mono truncate max-w-xs"
                          style={{ color: "var(--pn-text-muted)" }}
                        >
                          → {card.resolution}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Recent Decisions (locked canon) */}
              <div
                className="mt-6 rounded-lg p-4"
                style={{
                  background: "rgba(14, 16, 23, 0.65)",
                  border: "1px solid var(--pn-border-surface)",
                }}
              >
                <div
                  className="text-[0.55rem] font-mono uppercase tracking-wider mb-3"
                  style={{ color: "var(--pn-text-tertiary)" }}
                >
                  Recent Decisions (locked)
                </div>
                <ul className="flex flex-col gap-1.5 list-none p-0 m-0">
                  {state.decisions.map((d) => (
                    <li
                      key={d.filename}
                      className="flex items-center gap-2 text-[0.7rem]"
                      style={{ color: "var(--pn-text-secondary)" }}
                    >
                      <span style={{ color: "var(--color-pn-success, #22C55E)" }}>
                        ✓
                      </span>
                      <span
                        className="font-mono font-semibold"
                        style={{ color: accent, minWidth: "64px" }}
                      >
                        {d.id}
                      </span>
                      <span>{d.title.replace(/^"|"$/g, "")}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {tab === "blockers" && (
            <div
              className="text-center py-10 text-[0.7rem]"
              style={{ color: "var(--pn-text-muted)" }}
            >
              No blocker cards yet.
              <br />
              Blockers surface when a GAC card is deferred with option [1].
              <br />
              Canon spec: canon/specs/BLUEPRINT-PLANNER.md §Blocker Card
            </div>
          )}

          {tab === "aspirations" && (
            <div
              className="text-center py-10 text-[0.7rem]"
              style={{ color: "var(--pn-text-muted)" }}
            >
              Aspirations log is empty.
              <br />
              v0.3 will auto-populate from brain dumps and journal entries
              <br />
              via LLM detection per DEC-003 (empty niche claimed).
            </div>
          )}

          {tab === "intents" && (
            <pre
              className="rounded-lg p-5 font-mono text-[0.65rem] leading-relaxed"
              style={{
                background: "rgba(10, 12, 20, 0.75)",
                border: "1px solid var(--pn-border-surface)",
                color: "var(--pn-text-secondary)",
                whiteSpace: "pre",
                overflowX: "auto",
              }}
            >{`Intent graph — SVG rendering target v0.3

      DEC-001 ─┐           ┌─ DEC-002
               ├─ graph  ──┤
      DEC-003 ─┘           └─ DEC-004/5/6
                │
                └── GAC-001..010 (${answered.length} answered, ${pending.length} open)

      → Full text at canon/specs/SCHEMATIC-v0.md`}</pre>
          )}

          {tab === "research" && (
            <div className="flex flex-col gap-2">
              <div
                className="text-[0.55rem] font-mono uppercase tracking-wider mb-2"
                style={{ color: "var(--pn-text-tertiary)" }}
              >
                Research Layer — {state.researchStats.total} nodes
              </div>
              {Object.entries(state.researchStats.categories || {})
                .sort((a, b) => (b[1] as number) - (a[1] as number))
                .map(([name, count]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between px-3 py-2 rounded text-[0.7rem]"
                    style={{
                      background: "rgba(20, 23, 33, 0.4)",
                      border: "1px solid var(--pn-border-subtle)",
                    }}
                  >
                    <span style={{ color: "var(--pn-text-secondary)" }}>
                      {name}
                    </span>
                    <span
                      className="font-mono font-semibold"
                      style={{ color: accent }}
                    >
                      {count as number}
                    </span>
                  </div>
                ))}
              <div
                className="text-[0.55rem] font-mono mt-3"
                style={{ color: "var(--pn-text-tertiary)" }}
              >
                Extractions:{" "}
                <span style={{ color: accent }}>{state.extractionStats.count}</span>{" "}
                · Clones on disk:{" "}
                <span style={{ color: accent }}>{state.cloneStats.count}</span>
              </div>
            </div>
          )}
        </div>

        {/* Stats strip footer */}
        <div
          className="flex items-center gap-5 px-5 shrink-0"
          style={{
            height: "30px",
            background: "rgba(6, 6, 16, 0.80)",
            borderTop: "1px solid var(--pn-border-subtle)",
          }}
        >
          <StatsItem label="CANON" value={state.decisions.length} accent={accent} />
          <StatsItem label="ANSWERED" value={answered.length} accent={accent} />
          <StatsItem label="OPEN" value={pending.length} accent={accent} />
          <StatsItem
            label="RESEARCH"
            value={state.researchStats.total}
            accent={accent}
          />
          <StatsItem
            label="EXTRACT"
            value={state.extractionStats.count}
            accent={accent}
          />
          <StatsItem label="CLONES" value={state.cloneStats.count} accent={accent} />
          <div
            className="ml-auto text-[0.55rem] font-mono"
            style={{ color: "var(--pn-text-muted)" }}
          >
            v0.2 · live from ema-genesis/
          </div>
        </div>
      </div>
    </AppWindowChrome>
  );
}

function StatsItem({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div
      className="flex items-center gap-1.5 text-[0.55rem] font-mono uppercase tracking-wider"
      style={{ color: "var(--pn-text-tertiary)" }}
    >
      {label}
      <span className="font-semibold" style={{ color: accent }}>
        {value}
      </span>
    </div>
  );
}
