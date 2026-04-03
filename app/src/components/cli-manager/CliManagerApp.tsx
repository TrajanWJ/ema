import { useEffect, useState } from "react";
import { useCliManagerStore } from "@/stores/cli-manager-store";
import type { CliTool, CliSession } from "@/stores/cli-manager-store";
import { useProjectsStore } from "@/stores/projects-store";

type Tab = "active" | "tools" | "history";

const STATUS_COLORS: Record<string, string> = {
  running: "#22c55e",
  idle: "#eab308",
  completed: "#3b82f6",
  stopped: "#6b7280",
  crashed: "#ef4444",
};

function formatDuration(startedAt: string | null): string {
  if (!startedAt) return "—";
  const ms = Date.now() - new Date(startedAt).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

function ActiveSessionCard({
  session,
  onStop,
}: {
  readonly session: CliSession;
  readonly onStop: (id: string) => void;
}) {
  return (
    <div className="glass-surface rounded-lg p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full inline-block"
            style={{ backgroundColor: STATUS_COLORS[session.status] ?? "#6b7280" }}
          />
          <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.87)" }}>
            {session.tool_name ?? "Unknown CLI"}
          </span>
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
          >
            {session.status}
          </span>
        </div>
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
          {formatDuration(session.started_at)}
        </span>
      </div>

      <div
        className="text-xs truncate"
        style={{ color: "rgba(255,255,255,0.5)" }}
        title={session.project_path}
      >
        {session.project_path}
      </div>

      <div
        className="text-xs line-clamp-2"
        style={{ color: "rgba(255,255,255,0.6)" }}
        title={session.prompt}
      >
        {session.prompt}
      </div>

      {session.status === "running" && (
        <button
          type="button"
          onClick={() => onStop(session.id)}
          className="self-end text-xs px-2 py-1 rounded"
          style={{
            backgroundColor: "rgba(239, 68, 68, 0.15)",
            color: "#ef4444",
            border: "1px solid rgba(239, 68, 68, 0.3)",
          }}
        >
          Stop
        </button>
      )}

      {session.output_summary && session.status !== "running" && (
        <div
          className="text-xs mt-1 p-2 rounded"
          style={{ backgroundColor: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.4)" }}
        >
          {session.output_summary.slice(0, 200)}
          {session.output_summary.length > 200 ? "..." : ""}
        </div>
      )}
    </div>
  );
}

function ToolCard({
  tool,
  onStartSession,
}: {
  readonly tool: CliTool;
  readonly onStartSession: (toolName: string) => void;
}) {
  return (
    <div className="glass-surface rounded-lg p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.87)" }}>
          {tool.name}
        </span>
        <button
          type="button"
          onClick={() => onStartSession(tool.name)}
          className="text-xs px-2 py-1 rounded"
          style={{
            backgroundColor: "rgba(20, 184, 166, 0.15)",
            color: "#14b8a6",
            border: "1px solid rgba(20, 184, 166, 0.3)",
          }}
        >
          New Session
        </button>
      </div>

      <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
        {tool.binary_path}
      </div>

      {tool.version && (
        <div className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
          v{tool.version}
        </div>
      )}

      {tool.capabilities.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {tool.capabilities.map((cap) => (
            <span
              key={cap}
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
            >
              {cap}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function NewSessionDialog({
  tools,
  initialTool,
  onClose,
  onSubmit,
}: {
  readonly tools: readonly CliTool[];
  readonly initialTool: string;
  readonly onClose: () => void;
  readonly onSubmit: (toolName: string, projectPath: string, prompt: string) => void;
}) {
  const [toolName, setToolName] = useState(initialTool);
  const [projectPath, setProjectPath] = useState("");
  const [prompt, setPrompt] = useState("");
  const { projects } = useProjectsStore();

  const handleSubmit = () => {
    if (!toolName || !projectPath.trim() || !prompt.trim()) return;
    onSubmit(toolName, projectPath.trim(), prompt.trim());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
    >
      <div
        className="glass-elevated rounded-xl p-6 flex flex-col gap-4 w-full max-w-lg"
        style={{ border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <h2 className="text-base font-semibold" style={{ color: "rgba(255,255,255,0.87)" }}>
          New CLI Session
        </h2>

        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
            CLI Tool
          </label>
          <select
            value={toolName}
            onChange={(e) => setToolName(e.target.value)}
            className="rounded px-3 py-2 text-sm"
            style={{
              backgroundColor: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.87)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            {tools.map((t) => (
              <option key={t.id} value={t.name}>
                {t.name} {t.version ? `(v${t.version})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
            Project Path
          </label>
          {projects.length > 0 && (
            <div className="flex gap-1 flex-wrap mb-1">
              {projects.map((p) =>
                p.linked_path ? (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setProjectPath(p.linked_path ?? "")}
                    className="text-xs px-2 py-0.5 rounded"
                    style={{
                      backgroundColor:
                        projectPath === p.linked_path
                          ? "rgba(20, 184, 166, 0.2)"
                          : "rgba(255,255,255,0.06)",
                      color:
                        projectPath === p.linked_path ? "#14b8a6" : "rgba(255,255,255,0.5)",
                      border: `1px solid ${projectPath === p.linked_path ? "rgba(20,184,166,0.3)" : "rgba(255,255,255,0.08)"}`,
                    }}
                  >
                    {p.name}
                  </button>
                ) : null,
              )}
            </div>
          )}
          <input
            value={projectPath}
            onChange={(e) => setProjectPath(e.target.value)}
            placeholder="/path/to/project"
            className="rounded px-3 py-2 text-sm"
            style={{
              backgroundColor: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.87)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
            Prompt
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the task..."
            rows={4}
            className="rounded px-3 py-2 text-sm resize-none"
            style={{
              backgroundColor: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.87)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          />
        </div>

        <div className="flex justify-end gap-2 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="text-sm px-4 py-2 rounded"
            style={{
              backgroundColor: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.6)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!toolName || !projectPath.trim() || !prompt.trim()}
            className="text-sm px-4 py-2 rounded"
            style={{
              backgroundColor:
                toolName && projectPath.trim() && prompt.trim()
                  ? "rgba(20, 184, 166, 0.2)"
                  : "rgba(255,255,255,0.04)",
              color:
                toolName && projectPath.trim() && prompt.trim()
                  ? "#14b8a6"
                  : "rgba(255,255,255,0.25)",
              border: "1px solid rgba(20, 184, 166, 0.3)",
            }}
          >
            Launch Session
          </button>
        </div>
      </div>
    </div>
  );
}

export function CliManagerApp() {
  const {
    tools,
    sessions,
    activeSessions,
    loading,
    error,
    loadViaRest,
    connect,
    scan,
    startSession,
    stopSession,
  } = useCliManagerStore();

  const [tab, setTab] = useState<Tab>("active");
  const [showNewSession, setShowNewSession] = useState(false);
  const [newSessionTool, setNewSessionTool] = useState("");

  useEffect(() => {
    loadViaRest();
    connect();
  }, [loadViaRest, connect]);

  const handleScan = async () => {
    await scan();
  };

  const handleStartSession = (toolName: string) => {
    setNewSessionTool(toolName);
    setShowNewSession(true);
  };

  const handleSubmitSession = async (toolName: string, projectPath: string, prompt: string) => {
    await startSession(toolName, projectPath, prompt);
    setShowNewSession(false);
    setNewSessionTool("");
  };

  const historySessions = sessions.filter((s) => s.status !== "running");

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "active", label: "Active Sessions", count: activeSessions.length },
    { key: "tools", label: "All Tools", count: tools.length },
    { key: "history", label: "History", count: historySessions.length },
  ];

  return (
    <div className="flex flex-col gap-4 p-6 h-full overflow-hidden">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold" style={{ color: "rgba(255,255,255,0.87)" }}>
          CLI Manager
        </h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleScan}
            className="text-xs px-3 py-1.5 rounded"
            style={{
              backgroundColor: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.6)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            Scan for CLIs
          </button>
          {tools.length > 0 && (
            <button
              type="button"
              onClick={() => handleStartSession(tools[0].name)}
              className="text-xs px-3 py-1.5 rounded"
              style={{
                backgroundColor: "rgba(20, 184, 166, 0.15)",
                color: "#14b8a6",
                border: "1px solid rgba(20, 184, 166, 0.3)",
              }}
            >
              + New Session
            </button>
          )}
        </div>
      </div>

      {error && (
        <div
          className="text-xs px-3 py-2 rounded"
          style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#ef4444" }}
        >
          {error}
        </div>
      )}

      {/* Tab bar */}
      <div
        className="flex gap-1 p-1 rounded-lg"
        style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className="flex-1 text-xs py-1.5 rounded-md transition-colors"
            style={{
              backgroundColor: tab === t.key ? "rgba(255,255,255,0.08)" : "transparent",
              color: tab === t.key ? "rgba(255,255,255,0.87)" : "rgba(255,255,255,0.4)",
            }}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-3">
        {loading && (
          <div className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
            Loading...
          </div>
        )}

        {tab === "active" && (
          <>
            {activeSessions.length === 0 && !loading && (
              <div
                className="text-sm text-center py-8"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                No active sessions. Start one from the Tools tab.
              </div>
            )}
            {activeSessions.map((session) => (
              <ActiveSessionCard
                key={session.id}
                session={session}
                onStop={stopSession}
              />
            ))}
          </>
        )}

        {tab === "tools" && (
          <>
            {tools.length === 0 && !loading && (
              <div
                className="text-sm text-center py-8"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                No CLI tools detected. Click &quot;Scan for CLIs&quot; to find installed tools.
              </div>
            )}
            {tools.map((tool) => (
              <ToolCard
                key={tool.id}
                tool={tool}
                onStartSession={handleStartSession}
              />
            ))}
          </>
        )}

        {tab === "history" && (
          <>
            {historySessions.length === 0 && !loading && (
              <div
                className="text-sm text-center py-8"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                No session history yet.
              </div>
            )}
            {historySessions.map((session) => (
              <ActiveSessionCard
                key={session.id}
                session={session}
                onStop={stopSession}
              />
            ))}
          </>
        )}
      </div>

      {showNewSession && (
        <NewSessionDialog
          tools={tools}
          initialTool={newSessionTool}
          onClose={() => setShowNewSession(false)}
          onSubmit={handleSubmitSession}
        />
      )}
    </div>
  );
}
