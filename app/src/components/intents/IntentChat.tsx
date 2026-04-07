import { useState, useRef, useEffect } from "react";
import { useIntentSchematicStore } from "@/stores/intent-schematic-store";

export function IntentChat() {
  const [input, setInput] = useState("");
  const messages = useIntentSchematicStore((s) => s.chatMessages);
  const chatLoading = useIntentSchematicStore((s) => s.chatLoading);
  const sendChat = useIntentSchematicStore((s) => s.sendChat);
  const selectedPath = useIntentSchematicStore((s) => s.selectedPath);
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

  if (!selectedPath) return null;

  return (
    <div
      className="flex flex-col rounded-lg overflow-hidden"
      style={{
        background: "rgba(255, 255, 255, 0.02)",
        border: "1px solid var(--pn-border-subtle)",
        height: "200px",
      }}
    >
      <div
        className="px-3 py-1.5 flex items-center gap-2 shrink-0"
        style={{
          borderBottom: "1px solid var(--pn-border-subtle)",
          background: "rgba(167, 139, 250, 0.04)",
        }}
      >
        <span className="text-[0.65rem] font-medium" style={{ color: "#a78bfa" }}>
          Agent Chat
        </span>
        <span className="text-[0.55rem]" style={{ color: "var(--pn-text-muted)" }}>
          Ask the agent to review, update, or explain this intent
        </span>
      </div>

      <div ref={listRef} className="flex-1 overflow-auto px-3 py-2 space-y-1.5">
        {messages.length === 0 && (
          <div
            className="flex items-center justify-center py-3"
          >
            <span className="text-[0.7rem]" style={{ color: "var(--pn-text-tertiary)" }}>
              Chat with an agent about this intent page
            </span>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className="rounded px-2.5 py-1.5 text-[0.75rem]"
            style={{
              background:
                msg.role === "user"
                  ? "rgba(167, 139, 250, 0.08)"
                  : "rgba(255, 255, 255, 0.03)",
              marginLeft: msg.role === "user" ? "3rem" : "0",
              marginRight: msg.role === "assistant" ? "3rem" : "0",
              color: "var(--pn-text-secondary)",
            }}
          >
            {msg.content}
          </div>
        ))}
        {chatLoading && (
          <div
            className="rounded px-2.5 py-1.5 text-[0.7rem]"
            style={{
              background: "rgba(255, 255, 255, 0.03)",
              color: "var(--pn-text-muted)",
            }}
          >
            Thinking...
          </div>
        )}
      </div>

      <form
        onSubmit={handleSend}
        className="flex items-center gap-2 px-3 py-2 shrink-0"
        style={{ borderTop: "1px solid var(--pn-border-subtle)" }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about this intent..."
          className="flex-1 text-[0.75rem] px-2.5 py-1.5 rounded outline-none"
          style={{
            background: "var(--pn-field-bg)",
            color: "var(--pn-text-primary)",
            border: "1px solid var(--pn-border-subtle)",
          }}
        />
        <button
          type="submit"
          disabled={chatLoading || !input.trim()}
          className="px-3 py-1.5 rounded text-[0.7rem] font-medium transition-colors"
          style={{
            background: chatLoading ? "rgba(167,139,250,0.1)" : "rgba(167,139,250,0.2)",
            color: "#a78bfa",
            opacity: chatLoading || !input.trim() ? 0.5 : 1,
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
