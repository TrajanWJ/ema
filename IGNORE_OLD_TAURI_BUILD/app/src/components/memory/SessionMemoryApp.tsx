import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { useMemoryStore } from "@/stores/memory-store";
import { APP_CONFIGS } from "@/types/workspace";

const config = APP_CONFIGS["memory"];

function formatTokens(n: number | null): string {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function projectName(path: string | null): string {
  if (!path) return "Unknown";
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

export function SessionMemoryApp() {
  const [ready, setReady] = useState(false);
  const sessions = useMemoryStore((s) => s.sessions);
  const fragments = useMemoryStore((s) => s.fragments);
  const stats = useMemoryStore((s) => s.stats);
  const selectedSession = useMemoryStore((s) => s.selectedSession);
  const selectSession = useMemoryStore((s) => s.selectSession);
  const search = useMemoryStore((s) => s.search);
  const searchQuery = useMemoryStore((s) => s.searchQuery);
  const [contextText, setContextText] = useState<string | null>(null);
  const [view, setView] = useState<"sessions" | "fragments">("sessions");

  useEffect(() => {
    async function init() {
      await useMemoryStore.getState().loadViaRest().catch(() => {});
      setReady(true);
      useMemoryStore.getState().connect().catch(() => {});
    }
    init();
  }, []);

  if (!ready) {
    return (
      <AppWindowChrome appId="memory" title={config.title} icon={config.icon} accent={config.accent}>
        <div className="flex items-center justify-center h-full">
          <span className="text-[0.8rem]" style={{ color: "var(--pn-text-secondary)" }}>Loading...</span>
        </div>
      </AppWindowChrome>
    );
  }

  // Group sessions by project
  const grouped = new Map<string, typeof sessions[number][]>();
  for (const s of sessions) {
    const key = s.project_path ?? "unknown";
    const arr = grouped.get(key) ?? [];
    arr.push(s);
    grouped.set(key, arr);
  }

  async function handleInjectContext(projectPath: string) {
    const ctx = await useMemoryStore.getState().getContext(projectPath);
    setContextText(ctx);
  }

  return (
    <AppWindowChrome appId="memory" title={config.title} icon={config.icon} accent={config.accent}>
      <div className="flex flex-col gap-3 h-full">
        {/* Stats bar */}
        <div className="flex items-center gap-4">
          <StatBadge label="Sessions" value={String(stats?.total_sessions ?? 0)} color="#5eead4" />
          <StatBadge label="Tokens" value={formatTokens(stats?.total_tokens ?? 0)} color="#6b95f0" />
          <StatBadge
            label="Top Project"
            value={stats?.most_active_project?.project_path ? projectName(stats.most_active_project.project_path) : "—"}
            color="#a78bfa"
          />

          {/* View toggle */}
          <div className="ml-auto flex gap-1" style={{ background: "rgba(255,255,255,0.04)", borderRadius: "6px", padding: "2px" }}>
            {(["sessions", "fragments"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="px-3 py-1 rounded text-[0.65rem] transition-all"
                style={{
                  background: view === v ? "rgba(94,234,212,0.15)" : "transparent",
                  color: view === v ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)",
                }}
              >
                {v === "sessions" ? "Sessions" : "Fragments"}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <input
          placeholder="Search sessions..."
          value={searchQuery}
          onChange={(e) => search(e.target.value)}
          className="w-full px-3 py-2 rounded-md text-[0.8rem]"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.87)",
            outline: "none",
          }}
        />

        {/* Content area */}
        <div className="flex flex-1 gap-3 min-h-0">
          {/* Left: session list */}
          <div className="flex-1 overflow-auto" style={{ minWidth: 0 }}>
            {view === "sessions" ? (
              Array.from(grouped.entries()).map(([path, group]) => (
                <div key={path} className="mb-4">
                  <div
                    className="text-[0.65rem] font-mono px-2 py-1 mb-1 rounded"
                    style={{ color: "var(--pn-text-tertiary)", background: "rgba(255,255,255,0.02)" }}
                  >
                    {projectName(path)} ({group.length})
                  </div>
                  {group.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => selectSession(s)}
                      className="w-full text-left px-3 py-2 rounded-md mb-1 transition-all hover:bg-[rgba(94,234,212,0.06)]"
                      style={{
                        background: selectedSession?.id === s.id ? "rgba(94,234,212,0.1)" : "transparent",
                        border: selectedSession?.id === s.id ? "1px solid rgba(94,234,212,0.2)" : "1px solid transparent",
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[0.75rem] truncate" style={{ color: "rgba(255,255,255,0.87)" }}>
                          {s.summary ? s.summary.slice(0, 60) : `Session ${s.session_id?.slice(0, 8) ?? s.id.slice(0, 8)}`}
                        </span>
                        <span className="text-[0.6rem] font-mono shrink-0 ml-2" style={{ color: "var(--pn-text-muted)" }}>
                          {formatRelative(s.last_active)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[0.6rem] font-mono" style={{ color: "var(--pn-text-tertiary)" }}>
                          {formatTokens(s.token_count)} tokens
                        </span>
                        <StatusPill status={s.status} />
                      </div>
                    </button>
                  ))}
                </div>
              ))
            ) : (
              <FragmentsList fragments={fragments} />
            )}
          </div>

          {/* Right: detail panel */}
          <div
            className="overflow-auto rounded-lg p-3"
            style={{
              width: "320px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {selectedSession ? (
              <SessionDetail
                session={selectedSession}
                fragments={fragments}
                onInject={() => handleInjectContext(selectedSession.project_path ?? "")}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <span className="text-[0.75rem]" style={{ color: "var(--pn-text-muted)" }}>
                  Select a session
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Context injection modal */}
        {contextText !== null && (
          <div
            className="fixed inset-0 flex items-center justify-center z-50"
            style={{ background: "rgba(0,0,0,0.6)" }}
            onClick={() => setContextText(null)}
          >
            <div
              className="rounded-lg p-4 max-w-lg w-full max-h-[60vh] overflow-auto"
              style={{ background: "rgba(14,16,23,0.95)", border: "1px solid rgba(94,234,212,0.2)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[0.8rem] font-medium" style={{ color: "rgba(255,255,255,0.87)" }}>
                  Context for Injection
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(contextText);
                    setContextText(null);
                  }}
                  className="px-3 py-1 rounded text-[0.7rem]"
                  style={{ background: "rgba(94,234,212,0.15)", color: "#5eead4" }}
                >
                  Copy & Close
                </button>
              </div>
              <pre
                className="text-[0.7rem] font-mono whitespace-pre-wrap"
                style={{ color: "var(--pn-text-secondary)" }}
              >
                {contextText}
              </pre>
            </div>
          </div>
        )}
      </div>
    </AppWindowChrome>
  );
}

function StatBadge({ label, value, color }: { readonly label: string; readonly value: string; readonly color: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md" style={{ background: `${color}10`, border: `1px solid ${color}20` }}>
      <span className="text-[0.6rem] font-mono uppercase" style={{ color: `${color}90` }}>{label}</span>
      <span className="text-[0.75rem] font-semibold font-mono" style={{ color }}>{value}</span>
    </div>
  );
}

function StatusPill({ status }: { readonly status: string }) {
  const color = status === "active" ? "#22C55E" : status === "completed" ? "#6b95f0" : "#EAB308";
  return (
    <span
      className="text-[0.55rem] font-mono px-1.5 py-0.5 rounded-full"
      style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}
    >
      {status}
    </span>
  );
}

function SessionDetail({
  session,
  fragments,
  onInject,
}: {
  readonly session: { readonly id: string; readonly session_id: string | null; readonly project_path: string | null; readonly status: string; readonly token_count: number | null; readonly tool_calls: number | null; readonly summary: string | null; readonly last_active: string | null; readonly started_at: string | null };
  readonly fragments: readonly { readonly id: string; readonly fragment_type: string; readonly content: string; readonly importance_score: number }[];
  readonly onInject: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-[0.8rem] font-medium" style={{ color: "rgba(255,255,255,0.87)" }}>
        {projectName(session.project_path)}
      </div>
      <div className="grid grid-cols-2 gap-2 text-[0.65rem] font-mono" style={{ color: "var(--pn-text-tertiary)" }}>
        <div>Status: <StatusPill status={session.status} /></div>
        <div>Tokens: {formatTokens(session.token_count)}</div>
        <div>Tools: {session.tool_calls ?? 0}</div>
        <div>Active: {formatRelative(session.last_active)}</div>
      </div>
      {session.summary && (
        <div className="text-[0.7rem] leading-relaxed" style={{ color: "var(--pn-text-secondary)" }}>
          {session.summary}
        </div>
      )}

      <button
        onClick={onInject}
        className="w-full py-2 rounded-md text-[0.7rem] font-medium transition-all hover:brightness-110"
        style={{ background: "rgba(94,234,212,0.15)", color: "#5eead4", border: "1px solid rgba(94,234,212,0.2)" }}
      >
        Inject Context
      </button>

      {fragments.length > 0 && (
        <div className="mt-2">
          <div className="text-[0.65rem] font-mono mb-2" style={{ color: "var(--pn-text-tertiary)" }}>
            Memory Fragments ({fragments.length})
          </div>
          {fragments.map((f) => (
            <div
              key={f.id}
              className="px-2 py-1.5 rounded mb-1"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <FragmentTypeBadge type={f.fragment_type} />
                <span className="text-[0.55rem] font-mono" style={{ color: "var(--pn-text-muted)" }}>
                  {(f.importance_score * 100).toFixed(0)}%
                </span>
              </div>
              <div className="text-[0.65rem]" style={{ color: "var(--pn-text-secondary)" }}>
                {f.content}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FragmentTypeBadge({ type }: { readonly type: string }) {
  const colors: Record<string, string> = {
    decision: "#f59e0b",
    insight: "#5eead4",
    code_change: "#6b95f0",
    blocker: "#ef4444",
  };
  const color = colors[type] ?? "#a78bfa";
  return (
    <span
      className="text-[0.5rem] font-mono uppercase px-1.5 py-0.5 rounded"
      style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}
    >
      {type}
    </span>
  );
}

function FragmentsList({ fragments }: { readonly fragments: readonly { readonly id: string; readonly fragment_type: string; readonly content: string; readonly importance_score: number; readonly project_path: string | null; readonly created_at: string }[] }) {
  if (fragments.length === 0) {
    return (
      <div className="flex items-center justify-center h-32">
        <span className="text-[0.75rem]" style={{ color: "var(--pn-text-muted)" }}>No fragments yet</span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {fragments.map((f) => (
        <div
          key={f.id}
          className="px-3 py-2 rounded-md"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
        >
          <div className="flex items-center gap-2 mb-1">
            <FragmentTypeBadge type={f.fragment_type} />
            <span className="text-[0.6rem] font-mono" style={{ color: "var(--pn-text-muted)" }}>
              {projectName(f.project_path)}
            </span>
            <span className="text-[0.55rem] font-mono ml-auto" style={{ color: "var(--pn-text-muted)" }}>
              {(f.importance_score * 100).toFixed(0)}%
            </span>
          </div>
          <div className="text-[0.7rem]" style={{ color: "var(--pn-text-secondary)" }}>
            {f.content}
          </div>
        </div>
      ))}
    </div>
  );
}
