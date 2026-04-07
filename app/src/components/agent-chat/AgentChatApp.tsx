import { useCallback, useEffect, useRef, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { APP_CONFIGS } from "@/types/workspace";
import { api } from "@/lib/api";
import type { Agent, AgentMessage } from "@/types/agents";

const config = APP_CONFIGS["agent-chat"];

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function RoleBadge({
  role,
  agentSlug,
}: {
  readonly role: "user" | "assistant" | "system" | "tool";
  readonly agentSlug: string;
}) {
  const label = role === "user" ? "You" : role === "system" ? "System" : agentSlug;
  const color =
    role === "user"
      ? "#a78bfa"
      : role === "system"
        ? "var(--pn-text-muted)"
        : "#2dd4a8";
  return (
    <span
      className="text-[0.6rem] font-mono font-semibold uppercase tracking-wider"
      style={{ color }}
    >
      {label}
    </span>
  );
}

function MessageBubble({
  message,
  agentSlug,
}: {
  readonly message: AgentMessage;
  readonly agentSlug: string;
}) {
  const isUser = message.role === "user";
  return (
    <div
      className={`flex flex-col gap-0.5 max-w-[85%] ${isUser ? "self-end items-end" : "self-start items-start"}`}
    >
      <div className="flex items-center gap-2">
        <RoleBadge role={message.role} agentSlug={agentSlug} />
        <span
          className="text-[0.55rem] font-mono"
          style={{ color: "var(--pn-text-muted)" }}
        >
          {formatTime(message.created_at)}
        </span>
      </div>
      <div
        className="px-3 py-2 rounded-lg text-[0.78rem] leading-relaxed whitespace-pre-wrap"
        style={{
          background: isUser
            ? "rgba(167, 139, 250, 0.12)"
            : "rgba(255, 255, 255, 0.04)",
          border: isUser
            ? "1px solid rgba(167, 139, 250, 0.2)"
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

interface PhaseInfo {
  readonly phase: string | null;
  readonly duration: string | null;
}

function AgentPhaseBar({ agent }: { readonly agent: Agent }) {
  const [phaseInfo, setPhaseInfo] = useState<PhaseInfo>({
    phase: null,
    duration: null,
  });

  useEffect(() => {
    async function loadPhase() {
      try {
        const data = await api.get<{
          actor?: { phase?: string; phase_changed_at?: string };
        }>(`/agents/${agent.slug}`);
        const phase = data.actor?.phase ?? null;
        let duration: string | null = null;
        if (data.actor?.phase_changed_at) {
          const mins = Math.round(
            (Date.now() - new Date(data.actor.phase_changed_at).getTime()) /
              60000
          );
          duration = mins < 60 ? `${mins}m` : `${Math.round(mins / 60)}h`;
        }
        setPhaseInfo({ phase, duration });
      } catch {
        // Actor data not available
      }
    }
    loadPhase();
  }, [agent.slug]);

  if (!phaseInfo.phase) return null;

  return (
    <div
      className="px-3 py-1.5 text-[0.68rem] font-mono"
      style={{
        color: "var(--pn-text-secondary)",
        borderBottom: "1px solid var(--pn-border-subtle)",
      }}
    >
      Phase: {phaseInfo.phase}
      {phaseInfo.duration && (
        <span style={{ color: "var(--pn-text-muted)" }}>
          {" "}({phaseInfo.duration})
        </span>
      )}
    </div>
  );
}

export function AgentChatApp() {
  const [agents, setAgents] = useState<readonly Agent[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [messages, setMessages] = useState<readonly AgentMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedAgent = agents.find((a) => a.slug === selectedSlug) ?? null;

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  }, []);

  // Load agents on mount
  useEffect(() => {
    async function init() {
      try {
        const data = await api.get<{ agents: Agent[] }>("/agents");
        setAgents(data.agents);
        if (data.agents.length > 0) {
          setSelectedSlug(data.agents[0].slug);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load agents"
        );
      }
      setReady(true);
    }
    init();
  }, []);

  // Load conversation when agent changes
  useEffect(() => {
    if (!selectedSlug) return;
    setMessages([]);
    setConversationId(null);

    async function loadHistory() {
      try {
        const data = await api.get<{
          conversations: { id: string }[];
        }>(`/agents/${selectedSlug}/conversations`);
        if (data.conversations.length > 0) {
          const convId = data.conversations[0].id;
          setConversationId(convId);
          const msgData = await api.get<{
            messages: AgentMessage[];
          }>(`/agents/${selectedSlug}/conversations/${convId}/messages`);
          setMessages(msgData.messages);
        }
      } catch {
        // No conversations yet — that's fine
      }
    }
    loadHistory();
  }, [selectedSlug]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending || !selectedSlug) return;

    const userMsg: AgentMessage = {
      id: `tmp-${Date.now()}`,
      role: "user",
      content: text,
      tool_calls: [],
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const resp = await api.post<{
        reply: string;
        conversation_id: string;
        tool_calls: unknown[];
      }>(`/agents/${selectedSlug}/chat`, {
        message: text,
        conversation_id: conversationId,
      });

      const assistantMsg: AgentMessage = {
        id: `resp-${Date.now()}`,
        role: "assistant",
        content: resp.reply,
        tool_calls: resp.tool_calls ?? [],
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setConversationId(resp.conversation_id);
    } catch (err) {
      const errMsg: AgentMessage = {
        id: `err-${Date.now()}`,
        role: "system",
        content: `Error: ${err instanceof Error ? err.message : "Failed to send"}`,
        tool_calls: [],
        created_at: new Date().toISOString(),
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

  if (!ready) {
    return (
      <AppWindowChrome
        appId="agent-chat"
        title={config.title}
        icon={config.icon}
        accent={config.accent}
      >
        <div className="flex items-center justify-center h-full">
          <span
            className="text-[0.8rem]"
            style={{ color: "var(--pn-text-secondary)" }}
          >
            Loading...
          </span>
        </div>
      </AppWindowChrome>
    );
  }

  return (
    <AppWindowChrome
      appId="agent-chat"
      title={config.title}
      icon={config.icon}
      accent={config.accent}
      breadcrumb={selectedAgent?.name ?? "Select Agent"}
    >
      <div className="flex flex-col h-full" style={{ minHeight: 0 }}>
        {/* Agent selector */}
        <div
          className="shrink-0 flex items-center gap-3 pb-2 mb-2"
          style={{ borderBottom: "1px solid var(--pn-border-subtle)" }}
        >
          <label
            className="text-[0.65rem] font-mono"
            style={{ color: "var(--pn-text-muted)" }}
          >
            agent:
          </label>
          <select
            value={selectedSlug ?? ""}
            onChange={(e) => setSelectedSlug(e.target.value || null)}
            className="rounded-md px-2 py-1 text-[0.72rem] outline-none"
            style={{
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid var(--pn-border-subtle)",
              color: "var(--pn-text-primary)",
            }}
          >
            {agents.length === 0 && (
              <option value="">No agents available</option>
            )}
            {agents.map((a) => (
              <option key={a.id} value={a.slug}>
                {a.slug}
              </option>
            ))}
          </select>
          {selectedAgent && (
            <span
              className="text-[0.6rem] font-mono"
              style={{
                color:
                  selectedAgent.status === "active"
                    ? "#2dd4a8"
                    : "var(--pn-text-muted)",
              }}
            >
              {selectedAgent.status}
            </span>
          )}
        </div>

        {/* Phase bar */}
        {selectedAgent && <AgentPhaseBar agent={selectedAgent} />}

        {/* Error display */}
        {error && (
          <div
            className="mb-2 px-3 py-2 rounded-lg text-[0.7rem]"
            style={{
              background: "rgba(239, 68, 68, 0.1)",
              color: "#ef4444",
            }}
          >
            {error}
          </div>
        )}

        {/* Messages area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto flex flex-col gap-3 px-1 py-3"
          style={{ minHeight: 0 }}
        >
          {messages.length === 0 && selectedAgent && (
            <div
              className="text-center text-[0.72rem] py-8"
              style={{ color: "var(--pn-text-muted)" }}
            >
              Start a conversation with {selectedAgent.slug}
            </div>
          )}
          {messages.map((msg, i) => (
            <MessageBubble
              key={msg.id ?? `${msg.created_at}-${i}`}
              message={msg}
              agentSlug={selectedSlug ?? "agent"}
            />
          ))}
          {sending && (
            <div className="self-start">
              <span
                className="text-[0.7rem] font-mono animate-pulse"
                style={{ color: "var(--pn-text-muted)" }}
              >
                {selectedSlug} is thinking...
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
            placeholder={
              selectedSlug
                ? `Message agent:${selectedSlug}...`
                : "Select an agent first..."
            }
            disabled={!selectedSlug}
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
            disabled={!input.trim() || sending || !selectedSlug}
            className="px-4 py-2 rounded-lg text-[0.72rem] font-semibold transition-opacity"
            style={{
              background:
                sending || !input.trim() || !selectedSlug
                  ? "rgba(167, 139, 250, 0.3)"
                  : "#a78bfa",
              color: "#fff",
              cursor:
                sending || !input.trim() || !selectedSlug
                  ? "default"
                  : "pointer",
            }}
          >
            Send
          </button>
        </div>
      </div>
    </AppWindowChrome>
  );
}
