import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { api } from "@/lib/api";

interface RuntimeActor {
  readonly actor_id: string;
  readonly from_state: string | null;
  readonly to_state: string;
  readonly reason: string;
  readonly observed_at: string;
}

interface RuntimeStatusResponse {
  readonly actors: readonly RuntimeActor[];
}

interface DraftMessage {
  readonly id: string;
  readonly role: "user" | "assistant" | "system";
  readonly content: string;
  readonly created_at: string;
}

interface AgentChatSurfaceProps {
  readonly accent?: string;
  readonly compact?: boolean;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function stateColor(state: string): string {
  if (state === "active" || state === "busy") return "#22c55e";
  if (state === "idle") return "#94a3b8";
  if (state === "waiting") return "#60a5fa";
  if (state === "blocked" || state === "error") return "#ef4444";
  return "#a78bfa";
}

export function AgentChatSurface({
  accent = "#a78bfa",
  compact = false,
}: AgentChatSurfaceProps) {
  const [actors, setActors] = useState<readonly RuntimeActor[]>([]);
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null);
  const [messages, setMessages] = useState<readonly DraftMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function loadActors() {
    try {
      const data = await api.get<RuntimeStatusResponse>("/agents/status");
      setActors(data.actors);
      setSelectedActorId((current) => current ?? data.actors[0]?.actor_id ?? null);
      setError(null);
    } catch (err) {
      setActors([]);
      setError(err instanceof Error ? err.message : "agent_runtime_unavailable");
    }
  }

  useEffect(() => {
    void loadActors();
    setMessages([
      {
        id: "system-boot",
        role: "system",
        content:
          "This surface stages agent requests into the live backend via Brain Dump. Full duplex agent chat is still explicitly deferred until the real conversation service exists.",
        created_at: new Date().toISOString(),
      },
    ]);
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }, [messages]);

  const selectedActor = useMemo(
    () => actors.find((actor) => actor.actor_id === selectedActorId) ?? null,
    [actors, selectedActorId],
  );

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    const target = selectedActorId ?? "ema";
    const staged = `[agent:${target}] ${text}`;
    const now = new Date().toISOString();

    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        role: "user",
        content: staged,
        created_at: now,
      },
    ]);
    setInput("");
    setSending(true);

    try {
      await api.post("/brain-dump/items", {
        content: staged,
        source: "agent_chat",
      });
      setMessages((prev) => [
        ...prev,
        {
          id: `ack-${Date.now()}`,
          role: "assistant",
          content:
            selectedActor
              ? `Queued for ${selectedActor.actor_id}. Current runtime state: ${selectedActor.to_state}.`
              : "Queued for EMA runtime triage.",
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "system",
          content: `Queueing failed: ${err instanceof Error ? err.message : "unknown_error"}`,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  }

  return (
    <div className={`flex h-full min-h-0 ${compact ? "flex-col" : ""} gap-3`}>
      <div
        className={`shrink-0 rounded-2xl p-3 ${compact ? "max-h-[14rem] overflow-y-auto" : "w-[18rem]"}`}
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center justify-between gap-2">
          <div
            className="text-[0.58rem] font-semibold uppercase tracking-[0.18em]"
            style={{ color: "var(--pn-text-muted)" }}
          >
            Target Actors
          </div>
          <button
            type="button"
            onClick={() => void loadActors()}
            className="rounded-lg px-2.5 py-1 text-[0.58rem] font-semibold uppercase tracking-[0.16em]"
            style={{
              background: "rgba(255,255,255,0.04)",
              color: "var(--pn-text-secondary)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            Refresh
          </button>
        </div>
        <div className={`mt-3 ${compact ? "grid grid-cols-1 gap-2" : "flex flex-col gap-2"}`}>
          {actors.length === 0 ? (
            <div
              className="rounded-xl p-3 text-[0.7rem]"
              style={{ background: "rgba(255,255,255,0.02)", color: "var(--pn-text-muted)" }}
            >
              {error ?? "No runtime actors available."}
            </div>
          ) : (
            actors.map((actor) => {
              const active = actor.actor_id === selectedActorId;
              const color = stateColor(actor.to_state);

              return (
                <button
                  key={actor.actor_id}
                  type="button"
                  onClick={() => setSelectedActorId(actor.actor_id)}
                  className="rounded-xl p-3 text-left"
                  style={{
                    background: active ? `${color}14` : "rgba(255,255,255,0.02)",
                    border: active ? `1px solid ${color}28` : "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[0.72rem] font-semibold" style={{ color: "var(--pn-text-primary)" }}>
                      {actor.actor_id}
                    </span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[0.56rem] font-semibold uppercase tracking-[0.14em]"
                      style={{ background: `${color}18`, color }}
                    >
                      {actor.to_state}
                    </span>
                  </div>
                  <div className="mt-2 text-[0.64rem] leading-[1.55]" style={{ color: "var(--pn-text-secondary)" }}>
                    {actor.reason}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div
        className="flex min-h-0 flex-1 flex-col gap-3 rounded-2xl p-3"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div>
          <div className="text-[0.62rem] font-semibold uppercase tracking-[0.18em]" style={{ color: accent }}>
            Agent Request Console
          </div>
          <div className="mt-1 text-[0.78rem]" style={{ color: "var(--pn-text-secondary)" }}>
            {selectedActor
              ? `Requests are staged for ${selectedActor.actor_id}. They are captured durably now, not sent through a nonexistent live agent conversation service.`
              : "Select a runtime actor, or queue a request for general EMA triage."}
          </div>
        </div>

        <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1 pb-2">
          {messages.map((message) => {
            const isUser = message.role === "user";
            const tone =
              message.role === "assistant"
                ? "#2dd4a8"
                : message.role === "system"
                  ? "#94a3b8"
                  : accent;

            return (
              <div key={message.id} className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
                <div className="text-[0.56rem] font-mono uppercase tracking-[0.14em]" style={{ color: tone }}>
                  {message.role} · {formatTime(message.created_at)}
                </div>
                <div
                  className="max-w-[88%] whitespace-pre-wrap rounded-xl px-3 py-2 text-[0.76rem] leading-[1.6]"
                  style={{
                    background: isUser ? "rgba(167,139,250,0.12)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${isUser ? "rgba(167,139,250,0.20)" : "rgba(255,255,255,0.06)"}`,
                    color: "var(--pn-text-primary)",
                  }}
                >
                  {message.content}
                </div>
              </div>
            );
          })}
          {sending ? (
            <div className="text-[0.68rem] font-mono animate-pulse" style={{ color: "var(--pn-text-muted)" }}>
              queueing...
            </div>
          ) : null}
        </div>

        <div className="flex items-end gap-2 pt-1" style={{ borderTop: "1px solid var(--pn-border-subtle)" }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={selectedActor ? `Write a request for ${selectedActor.actor_id}...` : "Write a staged request..."}
            className="flex-1 resize-none rounded-lg px-3 py-2 text-[0.78rem] leading-relaxed outline-none"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--pn-border-subtle)",
              color: "var(--pn-text-primary)",
              maxHeight: "120px",
            }}
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!input.trim() || sending}
            className="rounded-lg px-4 py-2 text-[0.72rem] font-semibold"
            style={{ background: !input.trim() || sending ? "rgba(167,139,250,0.3)" : accent, color: "#fff" }}
          >
            Queue
          </button>
        </div>
      </div>
    </div>
  );
}
