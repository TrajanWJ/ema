import { useState } from "react";
import { useSupermanStore } from "@/stores/superman-store";

export function AskTab() {
  const [query, setQuery] = useState("");
  const querying = useSupermanStore((s) => s.querying);
  const lastAnswer = useSupermanStore((s) => s.lastAnswer);
  const queryHistory = useSupermanStore((s) => s.queryHistory);
  const askCodebase = useSupermanStore((s) => s.askCodebase);

  async function handleAsk() {
    if (!query.trim() || querying) return;
    await askCodebase(query.trim());
    setQuery("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  }

  const answer = lastAnswer as {
    answer?: string;
    result?: string;
    context?: { relevantFiles?: string[]; mode?: string };
    relevantFiles?: string[];
    mode?: string;
  } | null;

  const answerText = answer?.answer ?? answer?.result ?? "";
  const files = answer?.context?.relevantFiles ?? answer?.relevantFiles ?? [];
  const mode = answer?.context?.mode ?? answer?.mode;

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Query input */}
      <div className="flex gap-2">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything about your code..."
          rows={2}
          className="flex-1 glass-surface rounded-lg px-3 py-2 text-[0.75rem] resize-none"
          style={{
            border: "1px solid var(--pn-border-default)",
            color: "var(--pn-text-primary)",
            background: "rgba(255,255,255,0.03)",
          }}
        />
        <button
          onClick={handleAsk}
          disabled={querying || !query.trim()}
          className="rounded-lg px-4 text-[0.75rem] font-medium transition-all active:scale-[0.98] self-end"
          style={{
            background: querying ? "rgba(0,229,255,0.3)" : "rgba(0,229,255,0.7)",
            color: "#000",
            height: "36px",
            opacity: !query.trim() ? 0.4 : 1,
          }}
        >
          {querying ? "..." : "Ask"}
        </button>
      </div>

      {/* Answer panel */}
      {answerText && (
        <div
          className="glass-surface rounded-lg p-4 flex-1 overflow-auto"
          style={{ border: "1px solid rgba(0,229,255,0.15)" }}
        >
          {mode && (
            <span
              className="inline-block px-2 py-0.5 rounded text-[0.6rem] font-mono mb-2"
              style={{
                background: "rgba(0,229,255,0.1)",
                color: "#00E5FF",
                border: "1px solid rgba(0,229,255,0.2)",
              }}
            >
              {mode}
            </span>
          )}
          <div
            className="text-[0.75rem] leading-relaxed whitespace-pre-wrap"
            style={{ color: "var(--pn-text-primary)" }}
          >
            {answerText}
          </div>

          {files.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="text-[0.6rem]" style={{ color: "var(--pn-text-tertiary)" }}>
                Files:
              </span>
              {files.map((f) => (
                <span
                  key={f}
                  className="px-1.5 py-0.5 rounded text-[0.6rem] font-mono"
                  style={{
                    background: "rgba(99,102,241,0.1)",
                    color: "#6366f1",
                    border: "1px solid rgba(99,102,241,0.15)",
                  }}
                >
                  {f}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Query history */}
      {queryHistory.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="text-[0.65rem] font-medium" style={{ color: "var(--pn-text-tertiary)" }}>
            Recent Queries
          </div>
          <div className="flex flex-col gap-1 max-h-[200px] overflow-auto">
            {queryHistory.slice(0, 10).map((entry, i) => (
              <button
                key={`${entry.timestamp}-${i}`}
                onClick={() => setQuery(entry.query)}
                className="text-left px-2 py-1.5 rounded text-[0.65rem] transition-colors hover:bg-white/5"
                style={{ color: "var(--pn-text-secondary)" }}
              >
                {entry.query}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
