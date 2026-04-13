import { useState, useRef, useEffect, useCallback } from "react";
import { useJarvisStore } from "@/stores/jarvis-store";
import type { ChatMessage } from "@/stores/jarvis-store";

interface OrbExpandedProps {
  readonly onCollapse: () => void;
}

const QUICK_ACTIONS = [
  { label: "Brain Dump", icon: "\u25CE", action: "brain-dump" },
  { label: "Focus", icon: "\u23F1", action: "focus" },
  { label: "Tasks", icon: "\u2610", action: "tasks" },
  { label: "Command", icon: "\u2318", action: "command" },
] as const;

export function OrbExpanded({ onCollapse }: OrbExpandedProps) {
  const messages = useJarvisStore((s) => s.messages);
  const orbState = useJarvisStore((s) => s.orbState);
  const sendMessage = useJarvisStore((s) => s.sendMessage);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed || orbState === "thinking") return;
      setInput("");
      sendMessage(trimmed);
    },
    [input, orbState, sendMessage],
  );

  const handleQuickAction = useCallback(async (action: string) => {
    if (action === "command") {
      // Emit event to open command bar in main window
      try {
        const { emit } = await import("@tauri-apps/api/event");
        await emit("orb:action", { type: "command-bar" });
      } catch {
        // Not in Tauri
      }
      return;
    }

    // Open the target app in the main window
    try {
      const { emit } = await import("@tauri-apps/api/event");
      await emit("orb:action", { type: "open-app", appId: action });
    } catch {
      // Not in Tauri
    }
  }, []);

  return (
    <div
      className="h-screen flex flex-col overflow-hidden rounded-xl"
      style={{
        background: "rgba(8, 9, 14, 0.92)",
        backdropFilter: "blur(24px)",
        border: "1px solid rgba(0, 210, 255, 0.12)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 shrink-0"
        data-tauri-drag-region
        style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: orbState === "thinking" ? "#FFBE3C" : "#00D2FF",
              boxShadow: `0 0 6px ${orbState === "thinking" ? "#FFBE3C" : "#00D2FF"}`,
            }}
          />
          <span
            className="text-xs font-medium tracking-[0.12em] uppercase"
            style={{ color: "rgba(0, 210, 255, 0.6)" }}
          >
            Jarvis
          </span>
        </div>
        <button
          onClick={onCollapse}
          className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-white/5 transition-colors"
          style={{ color: "var(--pn-text-tertiary)", fontSize: "0.75rem" }}
          title="Collapse"
        >
          \u2715
        </button>
      </div>

      {/* Quick Actions */}
      <div
        className="grid grid-cols-4 gap-1.5 px-3 py-2 shrink-0"
        style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}
      >
        {QUICK_ACTIONS.map(({ label, icon, action }) => (
          <button
            key={action}
            onClick={() => handleQuickAction(action)}
            className="flex flex-col items-center gap-1 py-1.5 rounded-md hover:bg-white/5 transition-colors"
          >
            <span style={{ fontSize: "1rem", color: "var(--pn-text-secondary)" }}>
              {icon}
            </span>
            <span
              className="text-[0.6rem] tracking-wider"
              style={{ color: "var(--pn-text-muted)" }}
            >
              {label}
            </span>
          </button>
        ))}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p
              className="text-xs text-center"
              style={{ color: "var(--pn-text-muted)" }}
            >
              Ask me anything or use a quick action above.
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {orbState === "thinking" && <ThinkingIndicator />}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="shrink-0 px-3 py-2"
        style={{ borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}
      >
        <div
          className="flex items-center rounded-lg px-3 py-2"
          style={{
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Jarvis..."
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: "var(--pn-text-primary)" }}
            disabled={orbState === "thinking"}
          />
          <button
            type="submit"
            disabled={!input.trim() || orbState === "thinking"}
            className="ml-2 w-6 h-6 flex items-center justify-center rounded-md transition-colors"
            style={{
              color: input.trim() ? "#00D2FF" : "var(--pn-text-muted)",
              background: input.trim() ? "rgba(0, 210, 255, 0.1)" : "transparent",
            }}
          >
            \u2191
          </button>
        </div>
      </form>
    </div>
  );
}

function MessageBubble({ message }: { readonly message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className="max-w-[85%] px-3 py-1.5 rounded-lg text-sm"
        style={{
          background: isUser
            ? "rgba(0, 210, 255, 0.12)"
            : "rgba(255, 255, 255, 0.04)",
          border: `1px solid ${isUser ? "rgba(0, 210, 255, 0.15)" : "rgba(255, 255, 255, 0.06)"}`,
          color: "var(--pn-text-primary)",
        }}
      >
        {message.text}
      </div>
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex justify-start">
      <div
        className="px-3 py-2 rounded-lg flex items-center gap-1"
        style={{
          background: "rgba(255, 255, 255, 0.04)",
          border: "1px solid rgba(255, 255, 255, 0.06)",
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{
              background: "rgba(0, 210, 255, 0.5)",
              animationDelay: `${i * 200}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
