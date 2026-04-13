import { useEffect, useRef, useState } from "react";
import { useClaudeBridgeStore } from "@/stores/claude-bridge-store";

export function SessionView() {
  const activeSessionId = useClaudeBridgeStore((s) => s.activeSessionId);
  const sessions = useClaudeBridgeStore((s) => s.sessions);
  const output = useClaudeBridgeStore((s) => s.output);
  const sendPrompt = useClaudeBridgeStore((s) => s.sendPrompt);

  const [input, setInput] = useState("");
  const outputRef = useRef<HTMLPreElement>(null);
  const shouldAutoScroll = useRef(true);

  const session = sessions.find((s) => s.id === activeSessionId);

  // Auto-scroll on new output
  useEffect(() => {
    const el = outputRef.current;
    if (el && shouldAutoScroll.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [output]);

  // Track whether user has scrolled up
  function handleScroll() {
    const el = outputRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    shouldAutoScroll.current = distanceFromBottom < 40;
  }

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || !activeSessionId) return;
    sendPrompt(activeSessionId, trimmed);
    setInput("");
  }

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-[1.2rem] mb-2" style={{ color: "var(--pn-text-muted)" }}>
            ⌘
          </div>
          <span className="text-[0.75rem]" style={{ color: "var(--pn-text-tertiary)" }}>
            Select or create a session
          </span>
        </div>
      </div>
    );
  }

  const isStreaming = session.status === "streaming";
  const canSend = session.status === "idle" || session.status === "streaming";

  return (
    <div className="flex-1 flex flex-col h-full min-w-0">
      {/* Session header */}
      <div
        className="flex items-center justify-between px-3 py-2 shrink-0"
        style={{ borderBottom: "1px solid var(--pn-border-subtle)" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[0.75rem] font-medium" style={{ color: "var(--pn-text-primary)" }}>
            {session.project_path.split("/").pop()}
          </span>
          <span
            className="text-[0.6rem] font-mono px-1.5 py-0.5 rounded"
            style={{
              background: isStreaming ? "rgba(45, 212, 168, 0.12)" : "var(--color-pn-surface-2)",
              color: isStreaming ? "#2dd4a8" : "var(--pn-text-tertiary)",
            }}
          >
            {session.status}
          </span>
        </div>
        <span className="text-[0.6rem] font-mono" style={{ color: "var(--pn-text-muted)" }}>
          {session.model}
        </span>
      </div>

      {/* Streaming output */}
      <pre
        ref={outputRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto p-3 text-[0.75rem] leading-relaxed whitespace-pre-wrap break-words"
        style={{
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
          color: "var(--pn-text-primary)",
          background: "var(--color-pn-base)",
        }}
      >
        {output.length > 0 ? output.join("") : (
          <span style={{ color: "var(--pn-text-muted)" }}>
            Waiting for output...
          </span>
        )}
        {isStreaming && (
          <span
            className="inline-block w-1.5 h-3.5 ml-0.5 animate-pulse"
            style={{ background: "#2dd4a8" }}
          />
        )}
      </pre>

      {/* Input bar */}
      {canSend && (
        <div
          className="flex items-center gap-2 px-3 py-2 shrink-0"
          style={{ borderTop: "1px solid var(--pn-border-subtle)" }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Send a follow-up..."
            className="flex-1 rounded-md px-2.5 py-1.5 text-[0.75rem] font-mono outline-none"
            style={{
              background: "var(--color-pn-surface-2)",
              color: "var(--pn-text-primary)",
              border: "1px solid var(--pn-border-default)",
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="rounded-md px-3 py-1.5 text-[0.7rem] font-medium transition-opacity"
            style={{
              background: input.trim() ? "#2dd4a8" : "var(--color-pn-surface-2)",
              color: input.trim() ? "#060610" : "var(--pn-text-muted)",
              opacity: input.trim() ? 1 : 0.5,
            }}
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
