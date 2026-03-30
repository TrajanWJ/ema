import { useState } from "react";
import type { ChannelMessage } from "@/stores/channels-store";
import { ToolCallCard } from "./ToolCallCard";

function relativeTime(timestamp: number): string {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 10) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

function Avatar({ name, accent }: { name: string; accent?: string }) {
  const initials = name
    .split(/[\s-_]/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div
      className="flex items-center justify-center shrink-0 rounded-full text-[0.65rem] font-bold"
      style={{
        width: "32px",
        height: "32px",
        background: accent ? `${accent}22` : "rgba(255,255,255,0.08)",
        border: `1px solid ${accent ? `${accent}44` : "rgba(255,255,255,0.1)"}`,
        color: accent ?? "rgba(255,255,255,0.6)",
      }}
    >
      {initials || "?"}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      className="opacity-0 group-hover:opacity-100 transition-opacity text-[0.65rem] px-1.5 py-0.5 rounded"
      style={{
        color: "rgba(255,255,255,0.3)",
        background: "rgba(255,255,255,0.05)",
      }}
      title="Copy"
    >
      {copied ? "✓" : "⎘"}
    </button>
  );
}

/** Simple pre-formatted content renderer (no extra deps) */
function MessageContent({ content }: { content: string }) {
  // Basic code block detection
  const parts = content.split(/(```[\s\S]*?```)/g);
  return (
    <div className="text-[0.8rem] break-words whitespace-pre-wrap leading-relaxed" style={{ color: "rgba(255,255,255,0.82)" }}>
      {parts.map((part, i) => {
        if (part.startsWith("```")) {
          const lines = part.split("\n");
          const lang = lines[0].replace("```", "").trim();
          const code = lines.slice(1, -1).join("\n");
          return (
            <pre
              key={i}
              className="my-2 px-3 py-2 rounded-md overflow-x-auto text-[0.7rem] font-mono"
              style={{
                background: "rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.75)",
              }}
            >
              {lang && (
                <div className="text-[0.6rem] mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                  {lang}
                </div>
              )}
              {code}
            </pre>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </div>
  );
}

export function MessageBubble({ message }: { message: ChannelMessage }) {
  const isUser = message.role === "user";
  const accentColor = message.authorAccent ?? "#6b95f0";
  const timeStr = relativeTime(message.timestamp);

  // Tool call only message
  if (message.toolCalls && message.toolCalls.length > 0 && !message.content) {
    return (
      <div className="px-4 py-1">
        {message.toolCalls.map((tc) => (
          <ToolCallCard key={tc.id} toolCall={tc} />
        ))}
      </div>
    );
  }

  // System message
  if (message.role === "system") {
    return (
      <div
        className="mx-4 my-1 px-3 py-2 rounded-lg text-[0.75rem]"
        style={{
          background: "rgba(239,68,68,0.06)",
          border: "1px solid rgba(239,68,68,0.15)",
          color: "rgba(239,68,68,0.8)",
        }}
      >
        ⚠ {message.content}
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="px-4 py-1.5 flex justify-end group">
        <div className="max-w-[70%] flex items-start gap-2">
          <CopyButton text={message.content} />
          <div
            className="rounded-lg px-4 py-2.5"
            style={{
              background: "rgba(88,101,242,0.12)",
              border: "1px solid rgba(88,101,242,0.2)",
              borderLeftWidth: "3px",
              borderLeftColor: accentColor,
            }}
          >
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-[0.7rem] font-semibold" style={{ color: accentColor }}>
                {message.authorName}
              </span>
              <span className="text-[0.65rem]" style={{ color: "rgba(255,255,255,0.25)" }}>
                {timeStr}
              </span>
            </div>
            <MessageContent content={message.content} />
          </div>
          <Avatar name={message.authorName} accent={accentColor} />
        </div>
      </div>
    );
  }

  // Assistant / agent message
  return (
    <div className="px-4 py-1.5 flex gap-3 group">
      <Avatar name={message.authorName} accent={accentColor} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-[0.7rem] font-semibold" style={{ color: accentColor }}>
            {message.authorName}
          </span>
          <span className="text-[0.65rem]" style={{ color: "rgba(255,255,255,0.25)" }}>
            {timeStr}
          </span>
          <CopyButton text={message.content} />
        </div>
        <div
          className="rounded-lg px-4 py-2.5"
          style={{
            background: "rgba(14,16,23,0.55)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderLeftWidth: "3px",
            borderLeftColor: accentColor,
          }}
        >
          <MessageContent content={message.content} />
          {message.toolCalls && message.toolCalls.length > 0 && (
            <div className="mt-2 space-y-1">
              {message.toolCalls.map((tc) => (
                <ToolCallCard key={tc.id} toolCall={tc} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
