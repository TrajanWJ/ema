import { useEffect, useRef, useState } from "react";
import type { Session } from "@/stores/sessions-store";
import { useSessionsStore } from "@/stores/sessions-store";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadge(status: string): { bg: string; color: string } {
  switch (status) {
    case "active":
    case "running":
      return { bg: "rgba(34, 197, 94, 0.15)", color: "#22c55e" };
    case "idle":
    case "ended":
      return { bg: "rgba(255,255,255,0.06)", color: "var(--pn-text-secondary)" };
    case "error":
    case "killed":
      return { bg: "rgba(239, 68, 68, 0.15)", color: "#ef4444" };
    default:
      return { bg: "rgba(255,255,255,0.06)", color: "var(--pn-text-muted)" };
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SessionDetailProps {
  readonly session: Session;
}

export function SessionDetail({ session }: SessionDetailProps) {
  const [input, setInput] = useState("");
  const terminalRef = useRef<HTMLDivElement>(null);
  const outputLines = useSessionsStore(
    (s) => s.sessionOutput[session.id] ?? [],
  );
  const continueSession = useSessionsStore((s) => s.continueSession);
  const killSession = useSessionsStore((s) => s.killSession);

  // Auto-scroll terminal to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [outputLines]);

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed) return;
    continueSession(session.id, trimmed);
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const badge = statusBadge(session.status);
  const isActive = session.status === "active" || session.status === "running";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: "1px solid var(--pn-border-subtle)" }}
      >
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="text-[0.8rem] font-medium truncate"
              style={{ color: "var(--pn-text-primary)" }}
            >
              {session.project_path ?? "No project"}
            </span>
            <span
              className="text-[0.6rem] px-1.5 py-0.5 rounded-full shrink-0"
              style={{ background: badge.bg, color: badge.color }}
            >
              {session.status}
            </span>
          </div>
          {session.model && (
            <span
              className="text-[0.65rem]"
              style={{ color: "var(--pn-text-muted)" }}
            >
              Model: {session.model}
            </span>
          )}
        </div>

        {isActive && (
          <button
            onClick={() => killSession(session.id)}
            className="text-[0.65rem] px-2.5 py-1 rounded transition-opacity hover:opacity-80 shrink-0"
            style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}
          >
            Kill
          </button>
        )}
      </div>

      {/* Terminal output */}
      <div
        ref={terminalRef}
        className="flex-1 overflow-y-auto px-4 py-3 font-mono text-[0.75rem]"
        style={{
          background: "rgba(0, 0, 0, 0.3)",
          color: "#4ade80",
          lineHeight: 1.6,
        }}
      >
        {outputLines.length === 0 ? (
          <span style={{ color: "var(--pn-text-muted)" }}>
            {isActive
              ? "Waiting for output..."
              : "No output recorded for this session."}
          </span>
        ) : (
          outputLines.map((line, i) => (
            <div key={i} className="whitespace-pre-wrap break-all">
              {line}
            </div>
          ))
        )}
      </div>

      {/* Input */}
      {isActive && (
        <div
          className="flex items-center gap-2 px-4 py-2.5 shrink-0"
          style={{ borderTop: "1px solid var(--pn-border-subtle)" }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send a message..."
            className="flex-1 bg-transparent text-[0.8rem] outline-none"
            style={{
              color: "var(--pn-text-primary)",
              caretColor: "#6b95f0",
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="text-[0.65rem] px-3 py-1 rounded transition-opacity hover:opacity-80 disabled:opacity-30"
            style={{ background: "#6b95f0", color: "#fff" }}
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
