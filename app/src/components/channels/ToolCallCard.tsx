import { useState } from "react";
import type { ToolCall } from "@/stores/channels-store";

interface ToolConfig {
  icon: string;
  color: string;
  label: string;
}

const TOOL_CONFIG: Record<string, ToolConfig> = {
  read:     { icon: "📄", color: "#60a5fa", label: "Read" },
  edit:     { icon: "✏️", color: "#fbbf24", label: "Edit" },
  write:    { icon: "📝", color: "#34d399", label: "Write" },
  bash:     { icon: "⌨️", color: "#a78bfa", label: "Shell" },
  search:   { icon: "🔍", color: "#fb923c", label: "Search" },
  done:     { icon: "✅", color: "#34d399", label: "Done" },
  error:    { icon: "❌", color: "#f87171", label: "Error" },
  thinking: { icon: "✨", color: "rgba(255,255,255,0.4)", label: "Thinking" },
  generic:  { icon: "⚡", color: "rgba(255,255,255,0.4)", label: "Tool" },
};

const OUTPUT_LINE_LIMIT = 15;

function CollapsibleOutput({ text }: { text: string }) {
  const lines = text.split("\n");
  const isLong = lines.length > OUTPUT_LINE_LIMIT;
  const [showFull, setShowFull] = useState(false);
  const displayText = isLong && !showFull ? lines.slice(0, OUTPUT_LINE_LIMIT).join("\n") : text;

  return (
    <>
      <pre
        className="text-[0.7rem] font-mono overflow-x-auto max-h-[240px] overflow-y-auto whitespace-pre-wrap leading-relaxed"
        style={{ color: "rgba(255,255,255,0.6)" }}
      >
        {displayText}
      </pre>
      {isLong && (
        <button
          onClick={() => setShowFull(!showFull)}
          className="mt-1 text-[0.65rem] transition-colors flex items-center gap-1"
          style={{ color: "rgba(255,255,255,0.3)" }}
          onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "rgba(255,255,255,0.6)")}
          onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "rgba(255,255,255,0.3)")}
        >
          {showFull ? "▲ Show less" : `▼ Show ${lines.length - OUTPUT_LINE_LIMIT} more lines`}
        </button>
      )}
    </>
  );
}

export function ToolCallCard({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const config = TOOL_CONFIG[toolCall.kind] ?? TOOL_CONFIG.generic;
  const content = toolCall.output || toolCall.input;

  return (
    <div
      className="rounded-r-lg overflow-hidden my-1"
      style={{
        background: "rgba(14,16,23,0.55)",
        backdropFilter: "blur(20px)",
        borderLeft: `3px solid ${config.color}`,
        border: `1px solid rgba(255,255,255,0.06)`,
        borderLeftWidth: "3px",
        borderLeftColor: config.color,
      }}
    >
      <button
        onClick={() => content && setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2 text-[0.75rem] transition-colors"
        style={{ color: "rgba(255,255,255,0.5)" }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.8)")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.5)")}
      >
        <span style={{ color: config.color }}>{config.icon}</span>
        <span className="font-semibold truncate">{toolCall.title}</span>
        {toolCall.filePath && toolCall.kind !== "bash" && (
          <span
            className="ml-auto truncate max-w-[200px] font-mono text-[0.65rem]"
            style={{ color: "rgba(255,255,255,0.3)" }}
          >
            {toolCall.filePath}
          </span>
        )}
        {content && (
          <span className="shrink-0 ml-auto" style={{ color: "rgba(255,255,255,0.3)" }}>
            {expanded ? "▾" : "▸"}
          </span>
        )}
      </button>

      {expanded && content && (
        <div
          className="px-3 pb-2"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="mt-2">
            <CollapsibleOutput text={content} />
          </div>
        </div>
      )}
    </div>
  );
}
