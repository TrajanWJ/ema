import { useEffect, useState, useRef } from "react";
import { useMessageHubStore } from "@/stores/message-hub-store";
import type { Conversation, Message } from "@/stores/message-hub-store";

const card = {
  background: "rgba(14,16,23,0.55)",
  backdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  padding: 16,
  marginBottom: 12,
} as const;

const inputStyle = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "8px 12px",
  color: "var(--pn-text-primary)",
  width: "100%",
  outline: "none",
  fontSize: 13,
} as const;

const btnPrimary = {
  background: "#2DD4A8",
  color: "#000",
  border: "none",
  borderRadius: 8,
  padding: "8px 16px",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
} as const;

const PLATFORM_COLORS: Record<string, string> = {
  discord: "#5865F2",
  telegram: "#26A5E4",
  webchat: "#2DD4A8",
};

function formatTime(ts: string): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 60_000) return "just now";
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
  return d.toLocaleDateString();
}

function ConversationItem({
  conv,
  active,
  onSelect,
}: {
  readonly conv: Conversation;
  readonly active: boolean;
  readonly onSelect: () => void;
}) {
  const platformColor =
    PLATFORM_COLORS[conv.platform] ?? "var(--pn-text-secondary)";
  return (
    <div
      onClick={onSelect}
      style={{
        padding: "10px 14px",
        cursor: "pointer",
        borderRadius: 8,
        background: active ? "rgba(45,212,168,0.08)" : "transparent",
        borderLeft: active
          ? "2px solid rgba(45,212,168,0.6)"
          : "2px solid transparent",
        marginBottom: 2,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 2,
        }}
      >
        <span
          style={{
            fontSize: 9,
            padding: "1px 6px",
            borderRadius: 4,
            background: `${platformColor}18`,
            color: platformColor,
            fontWeight: 500,
          }}
        >
          {conv.platform}
        </span>
        <span
          style={{
            color: "var(--pn-text-secondary)",
            fontSize: 10,
            marginLeft: "auto",
          }}
        >
          {formatTime(conv.updated_at)}
        </span>
      </div>
      <div
        style={{
          color: "var(--pn-text-primary)",
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        {conv.title}
      </div>
      {conv.last_message && (
        <div
          style={{
            color: "var(--pn-text-secondary)",
            fontSize: 11,
            marginTop: 2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {conv.last_message}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message }: { readonly message: Message }) {
  const isUser = message.role === "user";
  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        marginBottom: 8,
      }}
    >
      <div
        style={{
          ...card,
          marginBottom: 0,
          padding: "8px 14px",
          maxWidth: "70%",
          background: isUser
            ? "rgba(45,212,168,0.1)"
            : "rgba(14,16,23,0.55)",
          borderColor: isUser
            ? "rgba(45,212,168,0.15)"
            : "rgba(255,255,255,0.08)",
        }}
      >
        <div style={{ color: "var(--pn-text-primary)", fontSize: 13 }}>
          {message.content}
        </div>
        <div
          style={{
            color: "var(--pn-text-secondary)",
            fontSize: 10,
            marginTop: 4,
          }}
        >
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}

export function MessageHubApp() {
  const {
    conversations,
    messages,
    activeConversationId,
    loading,
    error,
    loadViaRest,
    selectConversation,
    sendMessage,
  } = useMessageHubStore();

  const [draft, setDraft] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadViaRest();
  }, [loadViaRest]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!draft.trim() || !activeConversationId) return;
    sendMessage(activeConversationId, draft.trim());
    setDraft("");
  };

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ padding: "14px 20px" }}>
        <h2
          style={{
            color: "var(--pn-text-primary)",
            fontSize: 16,
            fontWeight: 600,
            margin: 0,
          }}
        >
          Message Hub
        </h2>
      </div>

      {error && (
        <div
          style={{
            padding: "0 20px",
            marginBottom: 8,
          }}
        >
          <div
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              background: "rgba(239,68,68,0.1)",
              color: "#ef4444",
              fontSize: 12,
            }}
          >
            {error}
          </div>
        </div>
      )}

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left panel — conversation list (40%) */}
        <div
          style={{
            width: "40%",
            borderRight: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            padding: "8px 0",
          }}
        >
          {loading && conversations.length === 0 && (
            <div
              style={{
                color: "var(--pn-text-secondary)",
                fontSize: 12,
                textAlign: "center",
                marginTop: 24,
              }}
            >
              Loading...
            </div>
          )}

          {conversations.map((c) => (
            <ConversationItem
              key={c.id}
              conv={c}
              active={c.id === activeConversationId}
              onSelect={() => selectConversation(c.id)}
            />
          ))}

          {!loading && conversations.length === 0 && (
            <div
              style={{
                color: "var(--pn-text-secondary)",
                fontSize: 12,
                textAlign: "center",
                marginTop: 24,
              }}
            >
              No conversations
            </div>
          )}
        </div>

        {/* Right panel — messages (60%) */}
        <div
          style={{
            width: "60%",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {activeConversationId ? (
            <>
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "16px 20px",
                }}
              >
                {loading && messages.length === 0 && (
                  <div
                    style={{
                      color: "var(--pn-text-secondary)",
                      fontSize: 12,
                      textAlign: "center",
                    }}
                  >
                    Loading...
                  </div>
                )}
                {messages.map((m) => (
                  <MessageBubble key={m.id} message={m} />
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Compose bar */}
              <div
                style={{
                  padding: "12px 20px",
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                  display: "flex",
                  gap: 8,
                }}
              >
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Type a message..."
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button onClick={handleSend} style={btnPrimary}>
                  Send
                </button>
              </div>
            </>
          ) : (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  color: "var(--pn-text-secondary)",
                  fontSize: 13,
                }}
              >
                Select a conversation
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
