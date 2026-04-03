import { useEffect, useState, useRef } from "react";
import { useMessageHubStore } from "@/stores/message-hub-store";
import type { Conversation, Message } from "@/stores/message-hub-store";

const card = {
  background: "rgba(255, 255, 255, 0.04)",
  border: "1px solid rgba(255, 255, 255, 0.06)",
  borderRadius: "10px",
};
const inputStyle = {
  background: "rgba(255, 255, 255, 0.04)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "6px",
  color: "var(--pn-text-primary)",
  padding: "8px 12px",
  outline: "none",
  fontSize: 13,
};

function ConversationItem({ conv, active, onSelect }: {
  readonly conv: Conversation;
  readonly active: boolean;
  readonly onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      style={{
        padding: "10px 14px",
        cursor: "pointer",
        borderRadius: 8,
        background: active ? "rgba(56, 189, 248, 0.08)" : "transparent",
        borderLeft: active ? "2px solid rgba(56, 189, 248, 0.6)" : "2px solid transparent",
      }}
    >
      <div style={{ color: "var(--pn-text-primary)", fontSize: 13, fontWeight: 500 }}>{conv.title}</div>
      {conv.last_message && (
        <div style={{ color: "var(--pn-text-muted)", fontSize: 11, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {conv.last_message}
        </div>
      )}
      {conv.unread_count > 0 && (
        <span style={{ fontSize: 10, background: "rgba(56, 189, 248, 0.3)", color: "#38bdf8", borderRadius: 8, padding: "1px 6px", marginTop: 4, display: "inline-block" }}>
          {conv.unread_count}
        </span>
      )}
    </div>
  );
}

function MessageBubble({ message }: { readonly message: Message }) {
  const isUser = message.role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 8 }}>
      <div
        style={{
          ...card,
          padding: "8px 14px",
          maxWidth: "70%",
          background: isUser ? "rgba(56, 189, 248, 0.1)" : "rgba(255, 255, 255, 0.04)",
          borderColor: isUser ? "rgba(56, 189, 248, 0.15)" : "rgba(255, 255, 255, 0.06)",
        }}
      >
        <div style={{ color: "var(--pn-text-primary)", fontSize: 13 }}>{message.content}</div>
        <div style={{ color: "var(--pn-text-muted)", fontSize: 10, marginTop: 4 }}>
          {new Date(message.created_at).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}

export function MessageHubApp() {
  const { conversations, activeConversationId, messages, loading, error, loadConversations, selectConversation, sendMessage, createConversation } = useMessageHubStore();
  const [draft, setDraft] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadConversations(); }, [loadConversations]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = () => {
    if (!draft.trim() || !activeConversationId) return;
    sendMessage(activeConversationId, draft.trim());
    setDraft("");
  };

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    createConversation(newTitle.trim());
    setNewTitle("");
  };

  return (
    <div style={{ background: "rgba(8, 9, 14, 0.95)", height: "100%", display: "flex", flexDirection: "column" }}>
      <div data-tauri-drag-region style={{ padding: "14px 20px" }}>
        <h2 style={{ color: "var(--pn-text-primary)", fontSize: 16, fontWeight: 600, margin: 0 }}>Message Hub</h2>
      </div>

      {error && <div style={{ padding: "0 20px", color: "#f87171", fontSize: 12 }}>{error}</div>}

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Sidebar */}
        <div style={{ width: 240, borderRight: "1px solid rgba(255, 255, 255, 0.06)", display: "flex", flexDirection: "column", overflowY: "auto" }}>
          <div style={{ padding: "8px 12px", display: "flex", gap: 6 }}>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="New conversation..."
              style={{ ...inputStyle, flex: 1, width: "auto" }}
            />
            <button onClick={handleCreate} style={{ ...inputStyle, width: "auto", cursor: "pointer", color: "#38bdf8" }}>+</button>
          </div>
          {conversations.map((c) => (
            <ConversationItem key={c.id} conv={c} active={c.id === activeConversationId} onSelect={() => selectConversation(c.id)} />
          ))}
          {conversations.length === 0 && (
            <div style={{ color: "var(--pn-text-muted)", fontSize: 12, textAlign: "center", marginTop: 24 }}>No conversations</div>
          )}
        </div>

        {/* Chat area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {activeConversationId ? (
            <>
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
                {loading && messages.length === 0 && (
                  <div style={{ color: "var(--pn-text-muted)", fontSize: 12, textAlign: "center" }}>Loading...</div>
                )}
                {messages.map((m) => <MessageBubble key={m.id} message={m} />)}
                <div ref={messagesEndRef} />
              </div>
              <div style={{ padding: "12px 20px", borderTop: "1px solid rgba(255, 255, 255, 0.06)", display: "flex", gap: 8 }}>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Type a message..."
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button onClick={handleSend} style={{ ...inputStyle, width: "auto", cursor: "pointer", color: "#38bdf8", fontWeight: 500 }}>Send</button>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "var(--pn-text-muted)", fontSize: 13 }}>Select a conversation</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
