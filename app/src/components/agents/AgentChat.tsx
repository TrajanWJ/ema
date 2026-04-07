import { useState, useRef, useEffect, memo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useAgentsStore } from "@/stores/agents-store";
import type { Agent } from "@/types/agents";

interface AgentChatProps {
  readonly agent: Agent;
}

export function AgentChat({ agent }: AgentChatProps) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const messages = useAgentsStore((s) => s.messages);
  const sendMessage = useAgentsStore((s) => s.sendMessage);
  const listRef = useRef<HTMLDivElement>(null);

  // Total count includes error/sending indicator rows
  const totalItems =
    messages.length + (sendError ? 1 : 0) + (sending ? 1 : 0);

  const virtualizer = useVirtualizer({
    count: totalItems,
    getScrollElement: () => listRef.current,
    estimateSize: () => 72,
    overscan: 8,
  });

  useEffect(() => {
    if (totalItems > 0) {
      virtualizer.scrollToIndex(totalItems - 1, { align: "end" });
    }
  }, [totalItems, virtualizer]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    setInput("");
    setSending(true);
    setSendError(null);
    try {
      await sendMessage(agent.slug, trimmed);
    } catch {
      setSendError("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div
        ref={listRef}
        className="flex-1 overflow-auto mb-3"
        style={{ minHeight: 0 }}
      >
        {messages.length === 0 && !sending && (
          <div className="flex items-center justify-center py-8">
            <span
              className="text-[0.75rem]"
              style={{ color: "var(--pn-text-tertiary)" }}
            >
              Start a conversation with {agent.name}
            </span>
          </div>
        )}
        {totalItems > 0 && (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const idx = virtualRow.index;
              let content: React.ReactNode;

              if (idx < messages.length) {
                const msg = messages[idx];
                content = (
                  <ChatMessage msg={msg} agentName={agent.name} />
                );
              } else if (sendError && idx === messages.length) {
                content = (
                  <div
                    className="text-[0.7rem] px-3 py-2 rounded-lg"
                    style={{
                      background: "rgba(239, 68, 68, 0.1)",
                      color: "#ef4444",
                    }}
                  >
                    {sendError}
                  </div>
                );
              } else {
                content = (
                  <div
                    className="text-[0.7rem] px-3 py-2"
                    style={{ color: "var(--pn-text-tertiary)" }}
                  >
                    {agent.name} is thinking...
                  </div>
                );
              }

              return (
                <div
                  key={
                    idx < messages.length
                      ? messages[idx].id
                      : `special-${idx}`
                  }
                  ref={virtualizer.measureElement}
                  data-index={virtualRow.index}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div className="pb-2">{content}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Message ${agent.name}...`}
          disabled={sending}
          className="flex-1 text-[0.8rem] px-3 py-2 rounded-lg outline-none"
          style={{
            background: "var(--pn-surface-3)",
            color: "var(--pn-text-primary)",
            border: "1px solid var(--pn-border-default)",
          }}
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="text-[0.8rem] px-4 py-2 rounded-lg font-medium transition-opacity disabled:opacity-30"
          style={{ background: "#a78bfa", color: "#fff" }}
        >
          Send
        </button>
      </form>
    </div>
  );
}

const ChatMessage = memo(function ChatMessage({
  msg,
  agentName,
}: {
  readonly msg: {
    readonly id: string;
    readonly role: string;
    readonly content: string;
    readonly tool_calls?: readonly unknown[];
  };
  readonly agentName: string;
}) {
  return (
    <div
      className="rounded-lg p-2.5"
      style={{
        background:
          msg.role === "user"
            ? "rgba(167, 139, 250, 0.08)"
            : "rgba(255, 255, 255, 0.03)",
        marginLeft: msg.role === "user" ? "2rem" : "0",
        marginRight: msg.role === "assistant" ? "2rem" : "0",
      }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className="text-[0.6rem] font-semibold uppercase"
          style={{
            color:
              msg.role === "user" ? "#a78bfa" : "var(--pn-text-tertiary)",
          }}
        >
          {msg.role === "user" ? "You" : agentName}
        </span>
      </div>
      <div
        className="text-[0.75rem] whitespace-pre-wrap"
        style={{ color: "var(--pn-text-primary)" }}
      >
        {msg.content}
      </div>
      {Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0 && (
        <div
          className="mt-1.5 pt-1.5"
          style={{ borderTop: "1px solid var(--pn-border-subtle)" }}
        >
          <span
            className="text-[0.6rem]"
            style={{ color: "var(--pn-text-tertiary)" }}
          >
            Used {msg.tool_calls.length} tool(s)
          </span>
        </div>
      )}
    </div>
  );
});
