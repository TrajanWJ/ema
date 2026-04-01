import { useState, useMemo, type ReactNode } from "react";
import type { ChannelMessage } from "@/stores/channels-store";
import { useChannelsStore } from "@/stores/channels-store";
import { ToolCallCard } from "./ToolCallCard";

function relativeTime(ts: number): string {
  const d = Math.floor((Date.now() - ts) / 1000);
  if (d < 10) return "just now";
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function Avatar({ name, accent }: { name: string; accent?: string }) {
  const initials = name.split(/[\s\-_]/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  return (
    <div style={{ width: 32, height: 32, borderRadius: "50%", background: accent ? `${accent}22` : "rgba(255,255,255,0.08)", border: `1px solid ${accent ? `${accent}44` : "rgba(255,255,255,0.1)"}`, color: accent ?? "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "0.65rem", fontWeight: 700, userSelect: "none" }}>
      {initials || "?"}
    </div>
  );
}

function CopyBtn({ text, style }: { text: string; style?: React.CSSProperties }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }}
      style={{ fontSize: "0.6rem", padding: "2px 6px", borderRadius: "4px", color: copied ? "#23a55a" : "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", ...style }}>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1]) nodes.push(<strong key={k++} style={{ fontWeight: 600, color: "rgba(255,255,255,0.95)" }}>{m[2]}</strong>);
    else if (m[3]) nodes.push(<em key={k++}>{m[4]}</em>);
    else if (m[5]) nodes.push(<code key={k++} style={{ background: "rgba(255,255,255,0.08)", padding: "1px 4px", borderRadius: "3px", fontSize: "0.75rem", fontFamily: "monospace" }}>{m[6]}</code>);
    else if (m[7]) nodes.push(<a key={k++} href={m[9]} target="_blank" rel="noreferrer" style={{ color: "#5865F2", textDecoration: "underline" }}>{m[8]}</a>);
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes.length > 0 ? nodes : [text];
}

function MessageContent({ content }: { content: string }) {
  const parts = content.split(/(```[\s\S]*?```)/g);
  return (
    <div style={{ fontSize: "0.8rem", wordBreak: "break-word", whiteSpace: "pre-wrap", lineHeight: 1.6, color: "rgba(255,255,255,0.82)" }}>
      {parts.map((part, i) => {
        if (part.startsWith("```")) {
          const lines = part.split("\n");
          const lang = lines[0].replace("```", "").trim();
          const code = lines.slice(1, -1).join("\n");
          return (
            <div key={i} style={{ position: "relative", margin: "8px 0", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "6px", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 12px", background: "rgba(0,0,0,0.3)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <span style={{ fontSize: "0.6rem", fontFamily: "monospace", color: "rgba(255,255,255,0.3)" }}>{lang || "text"}</span>
                <CopyBtn text={code} />
              </div>
              <pre style={{ padding: "8px 12px", overflowX: "auto", fontSize: "0.7rem", fontFamily: "monospace", background: "rgba(0,0,0,0.2)", color: "rgba(255,255,255,0.75)", margin: 0 }}>{code}</pre>
            </div>
          );
        }
        return <span key={i}>{renderInline(part)}</span>;
      })}
    </div>
  );
}

function ReplyIndicator({ replyToId }: { replyToId: string }) {
  const messages = useChannelsStore((s) => s.messages);
  const parent = useMemo(() => messages.find((m) => m.id === replyToId), [messages, replyToId]);
  if (!parent) return null;
  const preview = parent.content.length > 80 ? parent.content.slice(0, 80) + "\u2026" : parent.content;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px", paddingLeft: "8px", borderLeft: `2px solid ${parent.authorAccent ?? "rgba(255,255,255,0.2)"}`, fontSize: "0.7rem", color: "rgba(255,255,255,0.3)" }}>
      <span style={{ fontWeight: 600, color: parent.authorAccent ?? "rgba(255,255,255,0.4)" }}>{parent.authorName}</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview}</span>
    </div>
  );
}

function ReactionsBar({ reactions, messageId }: { reactions: Record<string, string[]>; messageId: string }) {
  const addReaction = useChannelsStore((s) => s.addReaction);
  return (
    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "4px" }}>
      {Object.entries(reactions).map(([emoji, users]) => {
        const hasMe = users.includes("trajan");
        return (
          <button key={emoji} onClick={() => addReaction(messageId, emoji)}
            style={{ display: "flex", alignItems: "center", gap: "4px", padding: "1px 6px", borderRadius: "9999px", fontSize: "0.7rem", background: hasMe ? "rgba(88,101,242,0.15)" : "rgba(255,255,255,0.05)", border: `1px solid ${hasMe ? "rgba(88,101,242,0.3)" : "rgba(255,255,255,0.08)"}`, color: "rgba(255,255,255,0.7)", cursor: "pointer" }}>
            {emoji} <span style={{ fontSize: "0.6rem" }}>{users.length}</span>
          </button>
        );
      })}
    </div>
  );
}

function HoverActions({ messageId, content }: { messageId: string; content: string }) {
  const addReaction = useChannelsStore((s) => s.addReaction);
  const btn: React.CSSProperties = { padding: "2px 6px", border: "none", background: "transparent", cursor: "pointer", fontSize: "0.7rem", color: "rgba(255,255,255,0.5)", borderRadius: "4px" };
  return (
    <div style={{ position: "absolute", top: "-12px", right: "8px", display: "flex", gap: "2px", background: "rgba(14,16,23,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", padding: "2px", zIndex: 5 }}>
      <button style={btn} onClick={() => addReaction(messageId, "\u{1F44D}")} title="React">{"\u{1F44D}"}</button>
      <button style={btn} title="Reply">{"\u21A9"}</button>
      <CopyBtn text={content} />
    </div>
  );
}

export function MessageBubble({ message, grouped = false }: { message: ChannelMessage; grouped?: boolean }) {
  const [hovered, setHovered] = useState(false);
  const accent = message.authorAccent ?? "#6b95f0";

  if (message.toolCalls && message.toolCalls.length > 0 && !message.content) {
    return (
      <div style={{ padding: "0 16px 4px" }}>
        {message.toolCalls.map((tc) => <ToolCallCard key={tc.id} toolCall={tc} />)}
      </div>
    );
  }

  if (message.role === "system") {
    return (
      <div style={{ margin: "4px 16px", padding: "8px 12px", borderRadius: "8px", fontSize: "0.75rem", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", color: "rgba(239,68,68,0.8)" }}>
        {"\u26A0"} {message.content}
      </div>
    );
  }

  const showFull = !grouped;

  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ padding: showFull ? "6px 16px" : "1px 16px 1px 64px", display: "flex", gap: "12px", position: "relative" }}>
      {showFull && <Avatar name={message.authorName} accent={accent} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        {message.replyTo && showFull && <ReplyIndicator replyToId={message.replyTo} />}
        {showFull && (
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "2px" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: accent }}>{message.authorName}</span>
            <span style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.25)" }}>{relativeTime(message.timestamp)}</span>
            {message.edited && <span style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.2)" }}>(edited)</span>}
          </div>
        )}
        <MessageContent content={message.content} />
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
            {message.toolCalls.map((tc) => <ToolCallCard key={tc.id} toolCall={tc} />)}
          </div>
        )}
        {message.reactions && Object.keys(message.reactions).length > 0 && (
          <ReactionsBar reactions={message.reactions} messageId={message.id} />
        )}
      </div>
      {hovered && <HoverActions messageId={message.id} content={message.content} />}
    </div>
  );
}
