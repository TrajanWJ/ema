import { useCallback, useEffect, useRef, useState } from "react";

import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { api } from "@/lib/api";
import { APP_CONFIGS } from "@/types/workspace";

const config = APP_CONFIGS["operator-chat"];

interface ChatMessage {
  readonly role: "user" | "system" | "assistant";
  readonly content: string;
  readonly timestamp: string;
}

interface DashboardStats {
  readonly date: string;
  readonly inbox_count: number;
  readonly recent_inbox: readonly {
    readonly id: string;
    readonly content: string;
    readonly source: string;
    readonly created_at: string;
  }[];
}

const QUICK_PROMPTS = [
  "Create an execution seed for the current bottleneck",
  "Capture this as an intent follow-up",
  "Queue research from the latest open question",
] as const;

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
        <span className="text-[0.55rem] font-mono" style={{ color: "var(--pn-text-muted)" }}>
          {formatTime(message.timestamp)}
        </span>
      </div>
      <div
        className="px-3 py-2 rounded-lg text-[0.78rem] leading-relaxed whitespace-pre-wrap"
        style={{
          background: isUser ? "rgba(99, 102, 241, 0.12)" : "rgba(255, 255, 255, 0.04)",
          border: isUser
            ? "1px solid rgba(99, 102, 241, 0.2)"
            : "1px solid var(--pn-border-subtle)",
          color: "var(--pn-text-primary)",
        }}
      >
        {message.content}
      </div>
    </div>
  );
}

export function OperatorChatApp() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardStats | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }, []);

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await api.get<DashboardStats>("/dashboard/today");
        setDashboard(data);
        setMessages([
          {
            role: "system",
            content:
              data.recent_inbox.length > 0
                ? `EMA ready. ${data.inbox_count} inbox items waiting. Recent capture: ${data.recent_inbox[0]?.content ?? "none"}`
                : `EMA ready. Inbox is empty for ${data.date}. Use this surface to stage capture into the live backend.`,
            timestamp: new Date().toISOString(),
          },
        ]);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "dashboard_unavailable");
        setMessages([
          {
            role: "system",
            content: "EMA ready. Dashboard snapshot unavailable, but operator capture still works.",
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    }

    void loadStats();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  async function handleSend(prefilled?: string) {
    const text = (prefilled ?? input).trim();
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
      await api.post("/brain-dump/items", {
        content: text,
        source: "operator_chat",
      });
      const ack: ChatMessage = {
        role: "assistant",
        content:
          "Captured into Brain Dump. This surface is the operator staging console: it writes real inbox items now, and downstream intent/proposal/execution routing stays explicit.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, ack]);
      if (dashboard) {
        setDashboard({
          ...dashboard,
          inbox_count: dashboard.inbox_count + 1,
          recent_inbox: [
            {
              id: `local-${Date.now()}`,
              content: text,
              source: "operator_chat",
              created_at: new Date().toISOString(),
            },
            ...dashboard.recent_inbox,
          ].slice(0, 5),
        });
      }
    } catch (error) {
      const errMsg: ChatMessage = {
        role: "system",
        content: `Capture failed: ${error instanceof Error ? error.message : "unknown_error"}`,
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
      void handleSend();
    }
  }

  return (
    <AppWindowChrome appId="operator-chat" title={config.title} icon={config.icon} accent={config.accent}>
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div
          className="rounded-xl p-3"
          style={{
            background: "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(45,212,168,0.06))",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div className="text-[0.62rem] font-semibold uppercase tracking-[0.18em]" style={{ color: config.accent }}>
            Operator Staging Console
          </div>
          <div className="mt-1 text-[0.82rem]" style={{ color: "var(--pn-text-secondary)" }}>
            Real backend action today: capture requests and instructions into Brain Dump. This app is intentionally honest about not being a full autonomous control shell yet.
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatPill label="Inbox" value={String(dashboard?.inbox_count ?? 0)} color="#fb923c" />
            <StatPill label="Recent captures" value={String(dashboard?.recent_inbox.length ?? 0)} color="#6366f1" />
            {loadError ? <StatPill label="Dashboard" value="offline" color="#ef4444" /> : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => {
                setInput(prompt);
                textareaRef.current?.focus();
              }}
              className="rounded-full px-3 py-1.5 text-[0.64rem] font-medium"
              style={{
                background: "rgba(255,255,255,0.04)",
                color: "var(--pn-text-secondary)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              {prompt}
            </button>
          ))}
        </div>

        <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1 pb-3">
          {messages.map((msg, i) => (
            <MessageBubble key={`${msg.timestamp}-${i}`} message={msg} />
          ))}
          {sending ? (
            <div className="self-start text-[0.7rem] font-mono animate-pulse" style={{ color: "var(--pn-text-muted)" }}>
              capturing...
            </div>
          ) : null}
        </div>

        {dashboard?.recent_inbox?.length ? (
          <div
            className="rounded-xl p-3"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div className="text-[0.58rem] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--pn-text-muted)" }}>
              Recent Inbox
            </div>
            <div className="mt-2 flex flex-col gap-1.5">
              {dashboard.recent_inbox.slice(0, 3).map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-3 text-[0.68rem]">
                  <span style={{ color: "var(--pn-text-secondary)" }}>{item.content}</span>
                  <span className="font-mono" style={{ color: "var(--pn-text-muted)" }}>
                    {formatTime(item.created_at)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="shrink-0 flex items-end gap-2 pt-1" style={{ borderTop: "1px solid var(--pn-border-subtle)" }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Capture an operator request, AI work order, or question..."
            rows={1}
            className="flex-1 resize-none rounded-lg px-3 py-2 text-[0.78rem] leading-relaxed outline-none"
            style={{
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid var(--pn-border-subtle)",
              color: "var(--pn-text-primary)",
              maxHeight: "120px",
            }}
          />
          <button
            onClick={() => void handleSend()}
            disabled={!input.trim() || sending}
            className="px-4 py-2 rounded-lg text-[0.72rem] font-semibold transition-opacity"
            style={{
              background: sending || !input.trim() ? "rgba(99, 102, 241, 0.3)" : "#6366f1",
              color: "#fff",
              cursor: sending || !input.trim() ? "default" : "pointer",
            }}
          >
            Capture
          </button>
        </div>
      </div>
    </AppWindowChrome>
  );
}

function StatPill({ label, value, color }: { readonly label: string; readonly value: string; readonly color: string }) {
  return (
    <span
      className="rounded-full px-2.5 py-1 text-[0.6rem] font-medium"
      style={{ background: `${color}18`, color, border: `1px solid ${color}28` }}
    >
      {label}: {value}
    </span>
  );
}
