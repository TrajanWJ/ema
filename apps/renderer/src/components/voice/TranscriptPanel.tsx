import { useEffect, useRef } from "react";
import type { TranscriptEntry } from "@/stores/voice-store";

interface TranscriptPanelProps {
  readonly transcript: readonly TranscriptEntry[];
}

export function TranscriptPanel({ transcript }: TranscriptPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript.length]);

  if (transcript.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p
          className="text-sm"
          style={{ color: "var(--pn-text-tertiary)" }}
        >
          Start speaking or type a command...
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
      {transcript.map((entry) => (
        <TranscriptLine key={entry.id} entry={entry} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

function TranscriptLine({ entry }: { readonly entry: TranscriptEntry }) {
  const isUser = entry.role === "user";
  const time = formatTime(entry.timestamp);

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
          isUser ? "ml-auto" : ""
        }`}
        style={{
          background: isUser
            ? "rgba(30, 144, 255, 0.12)"
            : "rgba(255, 255, 255, 0.04)",
          border: `1px solid ${
            isUser
              ? "rgba(30, 144, 255, 0.2)"
              : "var(--pn-border-subtle)"
          }`,
          color: "var(--pn-text-primary)",
        }}
      >
        <div className="flex items-center gap-2 mb-1">
          <span
            className="text-[0.65rem] font-medium uppercase tracking-wider"
            style={{
              color: isUser
                ? "rgba(30, 144, 255, 0.7)"
                : "rgba(0, 210, 255, 0.7)",
            }}
          >
            {isUser ? "You" : "Jarvis"}
          </span>
          {entry.type === "command" && (
            <span
              className="text-[0.6rem] px-1.5 py-0.5 rounded"
              style={{
                background: "rgba(138, 43, 226, 0.15)",
                color: "rgba(138, 43, 226, 0.8)",
              }}
            >
              command
            </span>
          )}
          <span
            className="text-[0.6rem] ml-auto"
            style={{ color: "var(--pn-text-muted)" }}
          >
            {time}
          </span>
        </div>
        <p className="leading-relaxed whitespace-pre-wrap">{entry.text}</p>
      </div>
    </div>
  );
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
