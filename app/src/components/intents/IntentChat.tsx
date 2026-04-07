import { useState, useRef, useEffect } from "react";
import { useIntentSchematicStore } from "@/stores/intent-schematic-store";

export function IntentChat() {
  const [input, setInput] = useState("");
  const messages = useIntentSchematicStore((s) => s.chatMessages);
  const chatLoading = useIntentSchematicStore((s) => s.chatLoading);
  const sendChat = useIntentSchematicStore((s) => s.sendChat);
  const selectedIntent = useIntentSchematicStore((s) => s.selectedIntent);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || chatLoading) return;
    setInput("");
    await sendChat(trimmed);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="px-4 py-3 shrink-0"
        style={{ borderBottom: "1px solid var(--pn-border-subtle)" }}
      >
        <div className="text-[0.75rem] font-semibold" style={{ color: "#a78bfa" }}>
          Talk Page
        </div>
        {selectedIntent && (
          <div className="text-[0.65rem] mt-0.5" style={{ color: "var(--pn-text-muted)" }}>
            Discussing: {selectedIntent.title}
          </div>
        )}
      </div>

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-auto px-4 py-3 space-y-2.5">
        {messages.length === 0 && (
          <div className="py-8 text-center">
            <div className="text-[0.8rem] mb-1" style={{ color: "var(--pn-text-tertiary)" }}>
              Agent discussion
            </div>
            <div className="text-[0.65rem]" style={{ color: "var(--pn-text-muted)" }}>
              Ask the agent to review, update, explain, or expand this intent page.
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <span
                className="text-[0.6rem] font-semibold"
                style={{
                  color: msg.role === "user" ? "var(--pn-text-secondary)" : "#a78bfa",
                }}
              >
                {msg.role === "user" ? "You" : "Agent"}
              </span>
              <span className="text-[0.5rem]" style={{ color: "var(--pn-text-muted)" }}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <div
              className="text-[0.75rem] leading-relaxed"
              style={{ color: "var(--pn-text-secondary)" }}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {chatLoading && (
          <div className="flex items-center gap-2 py-2">
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: "#a78bfa" }}
            />
            <span className="text-[0.7rem]" style={{ color: "var(--pn-text-muted)" }}>
              Thinking...
            </span>
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="shrink-0 px-4 py-3 flex gap-2"
        style={{ borderTop: "1px solid var(--pn-border-subtle)" }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about this intent..."
          className="flex-1 text-[0.75rem] px-3 py-2 rounded-lg outline-none"
          style={{
            background: "var(--pn-field-bg)",
            color: "var(--pn-text-primary)",
            border: "1px solid var(--pn-border-subtle)",
          }}
        />
        <button
          type="submit"
          disabled={chatLoading || !input.trim()}
          className="px-4 py-2 rounded-lg text-[0.7rem] font-medium transition-colors"
          style={{
            background: "rgba(167,139,250,0.15)",
            color: "#a78bfa",
            opacity: chatLoading || !input.trim() ? 0.4 : 1,
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
