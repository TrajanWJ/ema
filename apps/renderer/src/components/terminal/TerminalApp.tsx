import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { TerminalViewport } from "@/components/terminal/TerminalViewport";
import {
  useRuntimeFabricStore,
  type RuntimeSession,
  type RuntimeSessionEvent,
  type RuntimeTool,
} from "@/stores/runtime-fabric-store";
import { APP_CONFIGS } from "@/types/workspace";

const config = APP_CONFIGS["terminal"];

function toolAccent(kind: string): string {
  switch (kind) {
    case "claude":
      return "#7dd3fc";
    case "codex":
      return "#2dd4bf";
    case "gemini":
      return "#f59e0b";
    case "aider":
      return "#f472b6";
    case "cursor":
      return "#c084fc";
    case "shell":
      return "#94a3b8";
    default:
      return "#64748b";
  }
}

function formatTimestamp(value: string | null): string {
  if (!value) return "never";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatRelativeTimestamp(value: string | null): string {
  if (!value) return "never";
  const deltaMs = Date.now() - Date.parse(value);
  if (Number.isNaN(deltaMs)) return formatTimestamp(value);
  const seconds = Math.max(0, Math.round(deltaMs / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function parseEventPayload(payload: string | null): Record<string, unknown> | null {
  if (!payload) return null;
  try {
    const parsed = JSON.parse(payload) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || target.isContentEditable;
}

function ToolOption({ tool }: { readonly tool: RuntimeTool }) {
  return (
    <option value={tool.kind} disabled={!tool.available}>
      {tool.name}{tool.available ? "" : " (unavailable)"}
    </option>
  );
}

function ToolPill({ tool, active, onClick }: {
  readonly tool: RuntimeTool;
  readonly active: boolean;
  readonly onClick: () => void;
}) {
  const accent = toolAccent(tool.kind);
  return (
    <button
      onClick={onClick}
      disabled={!tool.available}
      style={{
        padding: "8px 10px",
        borderRadius: 999,
        border: active
          ? `1px solid ${accent}66`
          : "1px solid rgba(255,255,255,0.08)",
        background: active
          ? `${accent}18`
          : "rgba(255,255,255,0.04)",
        color: tool.available ? "rgba(255,255,255,0.84)" : "rgba(255,255,255,0.34)",
        fontSize: 11,
        fontWeight: 600,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: tool.available ? accent : "rgba(255,255,255,0.24)",
        }}
      />
      {tool.name}
    </button>
  );
}

function RuntimeStatePill({ state }: { readonly state: string | null }) {
  const label = state ?? "unknown";
  const color = state === "working"
    ? "#4ade80"
    : state === "blocked"
      ? "#fb7185"
      : state === "context-full"
        ? "#f59e0b"
        : state === "error" || state === "crashed"
          ? "#f87171"
          : "#94a3b8";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 8px",
        borderRadius: 999,
        border: `1px solid ${color}33`,
        background: `${color}18`,
        color,
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
      {label}
    </span>
  );
}

function SessionBadge({ session }: { readonly session: RuntimeSession }) {
  const color = session.source === "external"
    ? "#f59e0b"
    : session.runtime_state === "working"
      ? "#22c55e"
      : session.runtime_state === "blocked"
        ? "#fb7185"
        : session.runtime_state === "context-full"
          ? "#f59e0b"
          : "#94a3b8";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11,
        color,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: color,
        }}
      />
      {session.source} · {session.status}
    </span>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  readonly label: string;
  readonly value: string;
  readonly accent: string;
}) {
  return (
    <div
      style={{
        padding: "12px 10px",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.03)",
      }}
    >
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.46)" }}>
        {label}
      </div>
      <div style={{ marginTop: 6, fontSize: 22, fontWeight: 700, color: accent }}>
        {value}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "88px 1fr", gap: 10, alignItems: "start" }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.42)" }}>
        {label}
      </div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.82)", lineHeight: 1.5, wordBreak: "break-word" }}>
        {value}
      </div>
    </div>
  );
}

function SessionCard({
  session,
  selected,
  onSelect,
  canForget = false,
  onForget,
}: {
  readonly session: RuntimeSession;
  readonly selected: boolean;
  readonly onSelect: () => void;
  readonly canForget?: boolean;
  readonly onForget?: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      style={{
        textAlign: "left",
        padding: 12,
        borderRadius: 16,
        border: selected
          ? "1px solid rgba(125,211,252,0.38)"
          : "1px solid rgba(255,255,255,0.06)",
        background: selected
          ? "linear-gradient(180deg, rgba(125,211,252,0.16), rgba(125,211,252,0.08))"
          : "rgba(255,255,255,0.03)",
        color: "rgba(255,255,255,0.88)",
        boxShadow: selected ? "0 12px 32px rgba(6,12,18,0.24)" : "none",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {session.session_name}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 5 }}>
            {session.tool_name} · {formatRelativeTimestamp(session.last_output_at ?? session.last_seen_at)}
          </div>
        </div>
        <RuntimeStatePill state={session.runtime_state} />
      </div>
      {session.tail_preview ? (
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.48)", marginTop: 8, lineHeight: 1.45 }}>
          {session.tail_preview}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.34)", marginTop: 8 }}>
          No captured tail yet.
        </div>
      )}
      <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <SessionBadge session={session} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.40)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {session.source}
          </span>
          {canForget && onForget ? (
            <span
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onForget();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  onForget();
                }
              }}
              role="button"
              tabIndex={0}
              style={{
                padding: "4px 7px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.64)",
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Forget
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function SessionGroup({
  label,
  sessions,
  selectedSessionId,
  onSelect,
  onForget,
}: {
  readonly label: string;
  readonly sessions: RuntimeSession[];
  readonly selectedSessionId: string | null;
  readonly onSelect: (id: string) => void;
  readonly onForget: (id: string) => void;
}) {
  if (sessions.length === 0) return null;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ ...panelHeaderStyle, color: "rgba(255,255,255,0.44)" }}>
        <span>{label}</span>
        <span>{sessions.length}</span>
      </div>
      {sessions.map((session) => (
        <SessionCard
          key={session.id}
          session={session}
          selected={selectedSessionId === session.id}
          onSelect={() => onSelect(session.id)}
          canForget={session.source === "external" || session.status === "stopped"}
          onForget={() => onForget(session.id)}
        />
      ))}
    </div>
  );
}

function EventCard({ event }: { readonly event: RuntimeSessionEvent }) {
  const payload = parseEventPayload(event.payload_json);
  const payloadPreview = payload
    ? Object.entries(payload)
      .slice(0, 3)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(" · ")
    : null;

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.03)",
        borderRadius: 12,
        padding: "10px 11px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 11, color: "#bae6fd", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {event.event_kind.replaceAll("_", " ")}
        </span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.42)" }}>
          {new Date(event.inserted_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
      </div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.82)", marginTop: 5, lineHeight: 1.5 }}>
        {event.summary}
      </div>
      {payloadPreview ? (
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.44)", marginTop: 6, lineHeight: 1.45 }}>
          {payloadPreview}
        </div>
      ) : null}
    </div>
  );
}

export function TerminalApp() {
  const {
    tools,
    sessions,
    selectedSessionId,
    screen,
    events,
    error,
    loadTools,
    scanTools,
    loadSessions,
    selectSession,
    refreshScreen,
    refreshEvents,
    createSession,
    dispatchPrompt,
    sendText,
    sendKey,
    stopSession,
    forgetSession,
  } = useRuntimeFabricStore();

  const [toolKind, setToolKind] = useState("claude");
  const [cwd, setCwd] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [command, setCommand] = useState("");
  const [prompt, setPrompt] = useState("");
  const [input, setInput] = useState("");
  const [sessionQueryInput, setSessionQueryInput] = useState("");
  const [sessionFilter, setSessionFilter] = useState<"all" | "working" | "blocked" | "external" | "stopped">("all");
  const [simulateTyping, setSimulateTyping] = useState(false);
  const [sendMode, setSendMode] = useState<"paste" | "type">("paste");
  const searchRef = useRef<HTMLInputElement | null>(null);
  const deferredSessionQuery = useDeferredValue(sessionQueryInput);

  useEffect(() => {
    void loadTools();
    void loadSessions();
  }, [loadTools, loadSessions]);

  useEffect(() => {
    if (tools.length === 0) return;
    const activeTool = tools.find((tool) => tool.kind === toolKind && tool.available);
    if (activeTool) return;
    const fallback = tools.find((tool) => tool.available);
    if (fallback) {
      setToolKind(fallback.kind);
    }
  }, [toolKind, tools]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadSessions();
      if (selectedSessionId) {
        void refreshScreen();
        void refreshEvents();
      }
    }, 1500);
    return () => window.clearInterval(timer);
  }, [loadSessions, refreshEvents, refreshScreen, selectedSessionId]);

  useEffect(() => {
    if (sessions.length === 0) {
      if (selectedSessionId) {
        selectSession(null);
      }
      return;
    }
    if (!selectedSessionId || !sessions.some((session) => session.id === selectedSessionId)) {
      selectSession(sessions[0]?.id ?? null);
    }
  }, [selectSession, selectedSessionId, sessions]);

  useEffect(() => {
    if (selectedSessionId) {
      void refreshScreen();
      void refreshEvents();
    }
  }, [selectedSessionId, refreshEvents, refreshScreen]);

  const selected = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId],
  );

  const availableTools = tools.filter((tool) => tool.available);
  const filteredSessions = useMemo(() => {
    const query = deferredSessionQuery.trim().toLowerCase();
    return sessions.filter((session) => {
      if (sessionFilter === "working" && session.runtime_state !== "working") return false;
      if (sessionFilter === "blocked" && session.runtime_state !== "blocked") return false;
      if (sessionFilter === "external" && session.source !== "external") return false;
      if (sessionFilter === "stopped" && session.status !== "stopped") return false;
      if (!query) return true;
      const haystack = [
        session.session_name,
        session.tool_name,
        session.tool_kind,
        session.cwd ?? "",
        session.tail_preview ?? "",
        session.summary ?? "",
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [deferredSessionQuery, sessionFilter, sessions]);
  const managedSessions = filteredSessions.filter((session) => session.source === "managed");
  const externalSessions = filteredSessions.filter((session) => session.source === "external");
  const blockedSessions = sessions.filter((session) => session.runtime_state === "blocked").length;
  const workingSessions = sessions.filter((session) => session.runtime_state === "working").length;
  const stoppedSessions = sessions.filter((session) => session.status === "stopped").length;
  const selectedTool = tools.find((tool) => tool.kind === toolKind) ?? null;

  useEffect(() => {
    if (filteredSessions.length === 0) return;
    if (!selectedSessionId || !filteredSessions.some((session) => session.id === selectedSessionId)) {
      selectSession(filteredSessions[0]?.id ?? null);
    }
  }, [filteredSessions, selectSession, selectedSessionId]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isTextEntryTarget(event.target)) return;

      if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        if (!selected || input.trim().length === 0) return;
        event.preventDefault();
        void handleSend(sendMode, true);
        return;
      }

      if (event.key.toLowerCase() === "r") {
        if (!selected) return;
        event.preventDefault();
        void loadSessions();
        void refreshScreen();
        void refreshEvents();
        return;
      }

      if (event.key.toLowerCase() === "j" || event.key === "ArrowDown") {
        if (filteredSessions.length === 0) return;
        event.preventDefault();
        const currentIndex = filteredSessions.findIndex((session) => session.id === selectedSessionId);
        const nextIndex = currentIndex < 0
          ? 0
          : Math.min(filteredSessions.length - 1, currentIndex + 1);
        selectSession(filteredSessions[nextIndex]?.id ?? null);
        return;
      }

      if (event.key.toLowerCase() === "k" || event.key === "ArrowUp") {
        if (filteredSessions.length === 0) return;
        event.preventDefault();
        const currentIndex = filteredSessions.findIndex((session) => session.id === selectedSessionId);
        const nextIndex = currentIndex <= 0 ? 0 : currentIndex - 1;
        selectSession(filteredSessions[nextIndex]?.id ?? null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    filteredSessions,
    input,
    loadSessions,
    refreshEvents,
    refreshScreen,
    selectSession,
    selected,
    selectedSessionId,
    sendMode,
  ]);

  async function handleLaunch(): Promise<void> {
    if (prompt.trim()) {
      await dispatchPrompt({
        tool_kind: toolKind,
        prompt: prompt.trim(),
        ...(cwd.trim() ? { cwd: cwd.trim() } : {}),
        ...(sessionName.trim() ? { session_name: sessionName.trim() } : {}),
        ...(command.trim() ? { command: command.trim() } : {}),
        ...(simulateTyping ? { simulate_typing: true } : {}),
      });
      setPrompt("");
      return;
    }

    await createSession({
      tool_kind: toolKind,
      ...(cwd.trim() ? { cwd: cwd.trim() } : {}),
      ...(sessionName.trim() ? { session_name: sessionName.trim() } : {}),
      ...(command.trim() ? { command: command.trim() } : {}),
      ...(simulateTyping ? { simulate_typing: true } : {}),
    });
  }

  async function handleSend(mode: "paste" | "type", submit = true): Promise<void> {
    if (!selected || !input.trim()) return;
    await sendText(selected.id, input, mode, submit);
    setInput("");
  }

  return (
    <AppWindowChrome appId="terminal" title={config.title} icon={config.icon} accent={config.accent}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "320px minmax(0, 1fr) 320px",
          height: "100%",
          overflow: "hidden",
          background:
            "radial-gradient(circle at top left, rgba(37,99,235,0.14), transparent 28%), radial-gradient(circle at top right, rgba(45,212,191,0.10), transparent 22%), linear-gradient(180deg, rgba(7,10,15,0.98), rgba(10,14,20,0.96))",
        }}
      >
        <div
          style={{
            borderRight: "1px solid rgba(255,255,255,0.08)",
            padding: 18,
            display: "flex",
            flexDirection: "column",
            gap: 18,
            overflowY: "auto",
            background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
          }}
        >
          <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: "rgba(125,211,252,0.82)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                  Runtime Fabric
                </div>
                <strong style={{ fontSize: 20, fontWeight: 700, color: "rgba(255,255,255,0.95)" }}>
                  EMA Terminal
                </strong>
              </div>
              <button
                onClick={() => {
                  void scanTools();
                  void loadSessions();
                }}
                title="Rescan tools and running sessions"
                style={{
                  fontSize: 11,
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid rgba(125,211,252,0.18)",
                  background: "rgba(125,211,252,0.08)",
                  color: "#c6efff",
                }}
              >
                Rescan
              </button>
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.58)", lineHeight: 1.6 }}>
              A cmux-style operator console over EMA’s tmux-backed runtime backend. Launch managed sessions, attach discovered agent sessions, inspect live terminal state, and steer work without leaving the same surface.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10 }}>
              <StatCard label="Tools" value={String(availableTools.length)} accent="#7dd3fc" />
              <StatCard label="Working" value={String(workingSessions)} accent="#4ade80" />
              <StatCard label="Blocked" value={String(blockedSessions)} accent="#fb7185" />
              <StatCard label="Attached" value={String(sessions.filter((session) => session.source === "external").length)} accent="#f59e0b" />
            </div>
            {availableTools.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {availableTools.map((tool) => (
                  <ToolPill
                    key={tool.id}
                    tool={tool}
                    active={tool.kind === toolKind}
                    onClick={() => setToolKind(tool.kind)}
                  />
                ))}
              </div>
            ) : null}
          </section>

          <section style={panelStyle}>
            <div style={panelHeaderStyle}>
              <span>Launch Pad</span>
              {selectedTool ? <RuntimeStatePill state={selectedTool.available ? selectedTool.auth_state : "unknown"} /> : null}
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              <label style={labelStyle}>Tool</label>
              <select
                value={toolKind}
                onChange={(event) => setToolKind(event.target.value)}
                style={fieldStyle}
              >
                {tools.map((tool) => <ToolOption key={tool.id} tool={tool} />)}
              </select>
              {selectedTool ? (
                <div style={toolCardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.88)" }}>{selectedTool.name}</div>
                    <span style={{ fontSize: 10, color: toolAccent(selectedTool.kind), textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      {selectedTool.auth_state}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.46)", marginTop: 4 }}>
                    {selectedTool.binary_path ?? "No binary on PATH"}
                  </div>
                  {selectedTool.config_dir ? (
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.40)", marginTop: 4 }}>
                      config: {selectedTool.config_dir}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <label style={labelStyle}>Working Directory</label>
              <input
                value={cwd}
                onChange={(event) => setCwd(event.target.value)}
                placeholder="Working directory"
                style={fieldStyle}
              />
              <label style={labelStyle}>Session Name</label>
              <input
                value={sessionName}
                onChange={(event) => setSessionName(event.target.value)}
                placeholder="Session name (optional)"
                style={fieldStyle}
              />
              <label style={labelStyle}>Command Override</label>
              <input
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                placeholder="Override command (optional)"
                style={fieldStyle}
              />
              <label style={labelStyle}>Initial Prompt</label>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Optional first prompt to dispatch immediately"
                rows={4}
                style={{ ...fieldStyle, resize: "vertical", minHeight: 84 }}
              />
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: "rgba(255,255,255,0.64)" }}>
                <input
                  type="checkbox"
                  checked={simulateTyping}
                  onChange={(event) => setSimulateTyping(event.target.checked)}
                />
                Simulate typing for fragile TUIs
              </label>
              <button
                onClick={() => {
                  void handleLaunch();
                }}
                style={primaryButtonStyle}
              >
                {prompt.trim() ? "Launch + Dispatch" : "Launch Session"}
              </button>
            </div>
          </section>

          <section style={panelStyle}>
            <div style={panelHeaderStyle}>
              <span>Sessions</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{filteredSessions.length}/{sessions.length}</span>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              <input
                ref={searchRef}
                value={sessionQueryInput}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  startTransition(() => {
                    setSessionQueryInput(nextValue);
                  });
                }}
                placeholder="Filter by name, tool, cwd, or tail"
                style={fieldStyle}
              />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <button onClick={() => setSessionFilter("all")} style={sessionFilter === "all" ? activeChipStyle : inactiveChipStyle}>All</button>
                <button onClick={() => setSessionFilter("working")} style={sessionFilter === "working" ? activeChipStyle : inactiveChipStyle}>Working</button>
                <button onClick={() => setSessionFilter("blocked")} style={sessionFilter === "blocked" ? activeChipStyle : inactiveChipStyle}>Blocked</button>
                <button onClick={() => setSessionFilter("external")} style={sessionFilter === "external" ? activeChipStyle : inactiveChipStyle}>Attached</button>
                <button onClick={() => setSessionFilter("stopped")} style={sessionFilter === "stopped" ? activeChipStyle : inactiveChipStyle}>Stopped {stoppedSessions > 0 ? `(${stoppedSessions})` : ""}</button>
              </div>
              <SessionGroup
                label="Managed"
                sessions={managedSessions}
                selectedSessionId={selectedSessionId}
                onSelect={selectSession}
                onForget={(id) => {
                  void forgetSession(id);
                }}
              />
              <SessionGroup
                label="External"
                sessions={externalSessions}
                selectedSessionId={selectedSessionId}
                onSelect={selectSession}
                onForget={(id) => {
                  void forgetSession(id);
                }}
              />
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.42)", lineHeight: 1.5 }}>
                Shortcuts: <kbd style={kbdStyle}>/</kbd> search, <kbd style={kbdStyle}>J</kbd>/<kbd style={kbdStyle}>K</kbd> move, <kbd style={kbdStyle}>R</kbd> refresh, <kbd style={kbdStyle}>Ctrl</kbd>/<kbd style={kbdStyle}>Cmd</kbd>+<kbd style={kbdStyle}>Enter</kbd> send.
              </div>
              {filteredSessions.length === 0 ? (
                <div style={emptyCardStyle}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.84)" }}>
                    {sessions.length === 0 ? "No runtime sessions yet" : "No sessions match the current filter"}
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.46)", lineHeight: 1.55, marginTop: 6 }}>
                    {sessions.length === 0
                      ? "Launch a managed shell, Claude, or Codex session here, or attach to an existing tmux session already running on the machine."
                      : "Clear the search, broaden the filter, or forget stale external and stopped sessions to reduce noise."}
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <div style={{ display: "grid", gridTemplateRows: "auto minmax(0,1fr) auto", minWidth: 0, minHeight: 0 }}>
          <div
            style={{
              padding: "16px 18px 14px",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.95)" }}>
                  {selected?.session_name ?? "Select a session"}
                </div>
                {selected ? <RuntimeStatePill state={selected.runtime_state} /> : null}
                {selected ? <SessionBadge session={selected} /> : null}
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.58)", marginTop: 8, lineHeight: 1.5 }}>
                {selected
                  ? `${selected.tool_name} · ${selected.cwd ?? "no cwd"} · last output ${formatTimestamp(selected.last_output_at)}`
                  : "Launch a managed session or attach to a discovered tmux session."}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.42)", marginTop: 6, lineHeight: 1.5 }}>
                {selected?.summary ?? "Session summary will appear here as runtime output is captured."}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  void loadSessions();
                  void refreshScreen();
                  void refreshEvents();
                }}
                style={secondaryButtonStyle}
                disabled={!selected}
              >
                Refresh
              </button>
              <button
                onClick={() => {
                  if (selected) {
                    void sendText(selected.id, "/compact", sendMode, true);
                  }
                }}
                style={secondaryButtonStyle}
                disabled={!selected}
              >
                /compact
              </button>
              <button
                onClick={() => {
                  if (selected) {
                    void stopSession(selected.id);
                  }
                }}
                style={{
                  ...secondaryButtonStyle,
                  borderColor: "rgba(239,68,68,0.35)",
                  color: "#fca5a5",
                }}
                disabled={!selected || selected.source !== "managed"}
              >
                Stop
              </button>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateRows: "auto minmax(0,1fr)",
              minHeight: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 16px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                background: "rgba(255,255,255,0.02)",
                flexWrap: "wrap",
              }}
            >
              <span style={workspaceChipStyle}>Workspace</span>
              <span style={workspaceChipStyle}>
                {selected?.source === "external" ? "Attached" : selected ? "Managed" : "No Session"}
              </span>
              <span style={workspaceChipStyle}>{selected?.tool_name ?? "Idle"}</span>
              {screen ? (
                <>
                  <span style={workspaceChipStyle}>{screen.line_count} lines</span>
                  <span style={workspaceChipStyle}>captured {formatTimestamp(screen.captured_at)}</span>
                </>
              ) : null}
            </div>
            <div
              style={{
                minHeight: 0,
                padding: 16,
                background:
                  "radial-gradient(circle at top, rgba(23,37,84,0.24), transparent 30%), linear-gradient(180deg, #060b12 0%, #09111a 100%)",
              }}
            >
              <div
                style={{
                  height: "100%",
                  borderRadius: 18,
                  overflow: "hidden",
                  border: "1px solid rgba(125,211,252,0.14)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 18px 54px rgba(0,0,0,0.28)",
                  background: "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.00))",
                }}
              >
                {selected ? (
                  <TerminalViewport
                    content={screen?.tail ?? ""}
                    title={selected.session_name}
                  />
                ) : (
                  <div
                    style={{
                      height: "100%",
                      display: "grid",
                      placeItems: "center",
                      padding: 32,
                    }}
                  >
                    <div style={emptyConsoleCardStyle}>
                      <div style={{ fontSize: 12, color: "rgba(125,211,252,0.82)", textTransform: "uppercase", letterSpacing: "0.10em" }}>
                        EMA Terminal
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: "rgba(255,255,255,0.94)", marginTop: 10 }}>
                        Launch or attach to a session
                      </div>
                      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.52)", lineHeight: 1.65, marginTop: 10 }}>
                        Use the left rail to start a managed coding session, or rescan to discover external tmux sessions already running on the machine.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: 14,
              borderTop: "1px solid rgba(255,255,255,0.08)",
              display: "grid",
              gap: 10,
              background: "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.56)" }}>
                Dispatch into the selected session. Use typing mode for fragile TUIs, paste mode for speed.
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => setSendMode("paste")}
                  style={sendMode === "paste" ? activeChipStyle : inactiveChipStyle}
                >
                  Paste
                </button>
                <button
                  onClick={() => setSendMode("type")}
                  style={sendMode === "type" ? activeChipStyle : inactiveChipStyle}
                >
                  Type
                </button>
              </div>
            </div>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Send text to the selected session"
              rows={3}
              style={{ ...fieldStyle, resize: "vertical", background: "rgba(255,255,255,0.04)" }}
              disabled={!selected}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  void handleSend(sendMode, true);
                }
              }}
            />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button
                onClick={() => {
                  void handleSend(sendMode, true);
                }}
                style={primaryButtonStyle}
                disabled={!selected || input.trim().length === 0}
              >
                {sendMode === "type" ? "Type + Enter" : "Paste + Enter"}
              </button>
              <button
                onClick={() => {
                  if (selected) {
                    void sendKey(selected.id, "Enter");
                  }
                }}
                style={secondaryButtonStyle}
                disabled={!selected}
              >
                Enter
              </button>
              <button
                onClick={() => {
                  if (selected) {
                    void sendKey(selected.id, "ctrl-c");
                  }
                }}
                style={secondaryButtonStyle}
                disabled={!selected}
              >
                Ctrl-C
              </button>
              <button
                onClick={() => {
                  if (selected) {
                    void sendKey(selected.id, "Up");
                  }
                }}
                style={secondaryButtonStyle}
                disabled={!selected}
              >
                Up
              </button>
            </div>
            {error ? (
              <div style={{ fontSize: 12, color: "#fca5a5" }}>{error}</div>
            ) : null}
          </div>
        </div>

        <div
          style={{
            borderLeft: "1px solid rgba(255,255,255,0.08)",
            padding: 18,
            display: "grid",
            gridTemplateRows: "auto auto minmax(0,1fr)",
            gap: 18,
            minHeight: 0,
            background: "linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01))",
          }}
        >
          <section style={panelStyle}>
            <div style={panelHeaderStyle}>Inspector</div>
            {selected ? (
              <div style={{ display: "grid", gap: 10 }}>
                <InfoRow label="Tool" value={selected.tool_name} />
                <InfoRow label="Source" value={selected.source} />
                <InfoRow label="Runtime" value={selected.runtime_state ?? "unknown"} />
                <InfoRow label="Session" value={selected.session_name} />
                <InfoRow label="PID" value={selected.pid ? String(selected.pid) : "—"} />
                <InfoRow label="CWD" value={selected.cwd ?? "—"} />
                <InfoRow label="Started" value={formatTimestamp(selected.started_at)} />
                <InfoRow label="Last Output" value={formatTimestamp(selected.last_output_at)} />
                <div style={inspectorCalloutStyle}>
                  <div style={{ ...labelStyle, color: "rgba(255,255,255,0.42)" }}>Tail Preview</div>
                  <div style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.80)", lineHeight: 1.55 }}>
                    {selected.tail_preview ?? "No preview captured yet."}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", lineHeight: 1.5 }}>
                  {selected.command}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
                Select a session to inspect its runtime metadata.
              </div>
            )}
          </section>

          <section style={panelStyle}>
            <div style={panelHeaderStyle}>Quick Actions</div>
            <div style={{ display: "grid", gap: 8 }}>
              <button
                onClick={() => {
                  if (selected) {
                    void sendText(selected.id, "status", sendMode, true);
                  }
                }}
                style={secondaryButtonStyle}
                disabled={!selected}
              >
                Ask for Status
              </button>
              <button
                onClick={() => {
                  if (selected) {
                    void sendText(selected.id, "pwd", sendMode, true);
                  }
                }}
                style={secondaryButtonStyle}
                disabled={!selected}
              >
                Print Working Dir
              </button>
              <button
                onClick={() => {
                  if (selected) {
                    void refreshScreen();
                    void refreshEvents();
                  }
                }}
                style={secondaryButtonStyle}
                disabled={!selected}
              >
                Refresh Session
              </button>
              <button
                onClick={() => {
                  if (selected && (selected.source === "external" || selected.status === "stopped")) {
                    void forgetSession(selected.id);
                  }
                }}
                style={secondaryButtonStyle}
                disabled={!selected || (selected.source !== "external" && selected.status !== "stopped")}
              >
                Forget Session
              </button>
            </div>
          </section>

          <section style={{ ...panelStyle, minHeight: 0, overflow: "hidden" }}>
            <div style={panelHeaderStyle}>Session Activity</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, overflow: "auto", minHeight: 0 }}>
              {events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
              {events.length === 0 ? (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
                  No recorded session activity yet.
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </AppWindowChrome>
  );
}

const fieldStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.05)",
  color: "rgba(255,255,255,0.88)",
};

const primaryButtonStyle: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid rgba(125,211,252,0.28)",
  background: "linear-gradient(180deg, rgba(56,189,248,0.22), rgba(56,189,248,0.12))",
  color: "#d9f7ff",
  fontSize: 12,
  fontWeight: 600,
};

const secondaryButtonStyle: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.04)",
  color: "rgba(255,255,255,0.86)",
  fontSize: 12,
  fontWeight: 600,
};

const panelStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  padding: 14,
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
};

const panelHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: 11,
  color: "rgba(255,255,255,0.56)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const labelStyle: CSSProperties = {
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "rgba(255,255,255,0.44)",
};

const toolCardStyle: CSSProperties = {
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
};

const workspaceChipStyle: CSSProperties = {
  padding: "4px 8px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  color: "rgba(255,255,255,0.72)",
  fontSize: 11,
};

const activeChipStyle: CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(125,211,252,0.24)",
  background: "rgba(125,211,252,0.12)",
  color: "#d1f3ff",
  fontSize: 11,
  fontWeight: 600,
};

const inactiveChipStyle: CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  color: "rgba(255,255,255,0.70)",
  fontSize: 11,
  fontWeight: 600,
};

const kbdStyle: CSSProperties = {
  display: "inline-block",
  minWidth: 20,
  padding: "2px 6px",
  borderRadius: 6,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.04)",
  color: "rgba(255,255,255,0.72)",
  fontSize: 10,
  textAlign: "center",
};

const emptyCardStyle: CSSProperties = {
  padding: 14,
  borderRadius: 14,
  border: "1px dashed rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.02)",
};

const emptyConsoleCardStyle: CSSProperties = {
  width: "min(460px, 100%)",
  padding: 24,
  borderRadius: 20,
  border: "1px solid rgba(125,211,252,0.16)",
  background: "linear-gradient(180deg, rgba(9,15,24,0.92), rgba(8,13,21,0.86))",
  boxShadow: "0 28px 72px rgba(0,0,0,0.32)",
};

const inspectorCalloutStyle: CSSProperties = {
  padding: 12,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.025)",
};
