import { useCallback, useEffect, useRef, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { APP_CONFIGS } from "@/types/workspace";
import { api } from "@/lib/api";

const config = APP_CONFIGS["operator-chat"];

interface ChatMessage {
  readonly role: "user" | "system" | "assistant";
  readonly content: string;
  readonly timestamp: string;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function RoleBadge({ role }: { readonly role: ChatMessage["role"] }) {
  const labels: Record<ChatMessage["role"], string> = {
    user: "You",
    system: "System",
    assistant: "EMA",
  };
  const colors: Record<ChatMessage["role"], string> = {
    user: "#6366f1",
    system: "var(--pn-text-muted)",
    assistant: "#2dd4a8",
  };
  return (
    <span
      className="text-[0.6rem] font-mono font-semibold uppercase tracking-wider"
      style={{ color: colors[role] }}
    >
      {labels[role]}
    </span>
  );
}

function MessageBubble({ message }: { readonly message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div
      className={`flex flex-col gap-0.5 max-w-[85%] ${isUser ? "self-end items-end" : "self-start items-start"}`}
    >
      <div className="flex items-center gap-2">
        <RoleBadge role={message.role} />
        <span
          className="text-[0.55rem] font-mono"
          style={{ color: "var(--pn-text-muted)" }}
        >
          {formatTime(message.timestamp)}
        </span>
      </div>
      <div
        className="px-3 py-2 rounded-lg text-[0.78rem] leading-relaxed whitespace-pre-wrap"
        style={{
          background: isUser
            ? "rgba(99, 102, 241, 0.12)"
            : "rgba(255, 255, 255, 0.04)",
          border: isUser
            ? "1px solid rgba(99, 102, 241, 0.2)"
            : "1px solid var(--pn-border-subtle)",
          color: "var(--pn-text-primary)",
          fontFamily: "inherit",
        }}
      >
        {message.content}
      </div>
    </div>
  );
}

interface DashboardStats {
  readonly tasks_count?: number;
  readonly inbox_count?: number;
  readonly intents_count?: number;
  readonly executions_running?: number;
}

export function OperatorChatApp() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  }, []);

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await api.get<DashboardStats>("/dashboard/today");
        const parts: string[] = ["EMA ready."];
        if (data.intents_count) parts.push(`${data.intents_count} active intents`);
        if (data.tasks_count) parts.push(`${data.tasks_count} tasks`);
        if (data.inbox_count) parts.push(`${data.inbox_count} inbox`);
        if (data.executions_running) parts.push(`${data.executions_running} running`);

        const summary = parts.length > 1
          ? `${parts[0]} ${parts.slice(1).join(", ")}.`
          : "EMA ready. Send a message to get started.";

        setMessages([{
          role: "system",
          content: summary,
          timestamp: new Date().toISOString(),
        }]);
      } catch {
        setMessages([{
          role: "system",
          content: "EMA ready. Daemon stats unavailable — send a message to get started.",
          timestamp: new Date().toISOString(),
        }]);
      }
    }
    loadStats();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: ChatMessage = {
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      await api.post("/brain_dump", { content: text, source: "operator_chat" });
      const ack: ChatMessage = {
        role: "assistant",
        content: `Captured: "${text.length > 80 ? text.slice(0, 80) + "..." : text}"`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, ack]);
    } catch (err) {
      const errMsg: ChatMessage = {
        role: "system",
        content: `Error: ${err instanceof Error ? err.message : "Failed to send"}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <AppWindowChrome
      appId="operator-chat"
      title={config.title}
      icon={config.icon}
      accent={config.accent}
    >
      <div className="flex flex-col h-full" style={{ minHeight: 0 }}>
        {/* Messages area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto flex flex-col gap-3 px-1 pb-3"
          style={{ minHeight: 0 }}
        >
          {messages.map((msg, i) => (
            <MessageBubble key={`${msg.timestamp}-${i}`} message={msg} />
          ))}
          {sending && (
            <div className="self-start">
              <span
                className="text-[0.7rem] font-mono animate-pulse"
                style={{ color: "var(--pn-text-muted)" }}
              >
                thinking...
              </span>
            </div>
          )}
        </div>

        {/* Input area */}
        <div
          className="shrink-0 flex items-end gap-2 pt-3"
          style={{ borderTop: "1px solid var(--pn-border-subtle)" }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 resize-none rounded-lg px-3 py-2 text-[0.78rem] leading-relaxed outline-none"
            style={{
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid var(--pn-border-subtle)",
              color: "var(--pn-text-primary)",
              maxHeight: "120px",
              fontFamily: "inherit",
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="px-4 py-2 rounded-lg text-[0.72rem] font-semibold transition-opacity"
            style={{
              background: sending || !input.trim()
                ? "rgba(99, 102, 241, 0.3)"
                : "#6366f1",
              color: "#fff",
              cursor: sending || !input.trim() ? "default" : "pointer",
            }}
          >
            Send
          </button>
        </div>
      </div>
    </AppWindowChrome>
  );
}
