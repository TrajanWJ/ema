import { useState, useRef, useEffect, useCallback } from "react";
import { useJarvisStore } from "@/stores/jarvis-store";
import { useVoiceStore } from "@/stores/voice-store";
import { JarvisOrb } from "@/components/voice/JarvisOrb";
import type { ChatMessage, OrbState } from "@/stores/jarvis-store";
import type { VoiceState } from "@/stores/voice-store";

const ORB_TO_VOICE: Record<OrbState, VoiceState> = {
  idle: "idle",
  listening: "listening",
  thinking: "processing",
  speaking: "speaking",
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return "Burning the midnight oil?";
  if (hour < 12) return "Good morning, sir.";
  if (hour < 17) return "Good afternoon.";
  if (hour < 21) return "Good evening.";
  return "Working late, I see.";
}

function getContextHint(): string {
  const hour = new Date().getHours();
  if (hour < 10) return "Shall we review today's priorities?";
  if (hour < 14) return "Anything I can help with?";
  if (hour < 18) return "How's the afternoon going?";
  return "Ready when you are.";
}

export function JarvisApp() {
  const messages = useJarvisStore((s) => s.messages);
  const orbState = useJarvisStore((s) => s.orbState);
  const sendMessage = useJarvisStore((s) => s.sendMessage);
  const clearMessages = useJarvisStore((s) => s.clearMessages);
  const audioLevel = useVoiceStore((s) => s.audioLevel);

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    useJarvisStore.getState().connect();
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

  const mappedVoiceState = ORB_TO_VOICE[orbState];

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: "rgba(8, 9, 14, 0.95)" }}
    >
      {/* Title bar */}
      <div
        className="flex items-center justify-between px-4 py-2 shrink-0"
        data-tauri-drag-region
      >
        <span
          className="text-xs font-medium tracking-[0.15em] uppercase"
          style={{ color: "rgba(0, 210, 255, 0.5)" }}
        >
          Jarvis
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={clearMessages}
            className="text-[0.65rem] px-2 py-0.5 rounded hover:bg-white/5 transition-colors"
            style={{ color: "var(--pn-text-muted)" }}
          >
            Clear
          </button>
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{
                background: orbState === "thinking" ? "#FFBE3C" : "#22C55E",
                boxShadow: `0 0 6px ${orbState === "thinking" ? "#FFBE3C" : "#22C55E"}`,
              }}
            />
            <span
              className="text-[0.65rem]"
              style={{ color: "var(--pn-text-muted)" }}
            >
              {orbState === "thinking" ? "Thinking" : "Online"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Left: Orb + Greeting */}
        <div
          className="w-[280px] flex flex-col items-center justify-center px-4 shrink-0"
          style={{ borderRight: "1px solid var(--pn-border-subtle)" }}
        >
          <div className="w-full max-w-[220px]">
            <JarvisOrb
              state={mappedVoiceState}
              audioLevel={audioLevel}
            />
          </div>
          <div className="mt-4 text-center">
            <p
              className="text-sm"
              style={{ color: "var(--pn-text-secondary)" }}
            >
              {getGreeting()}
            </p>
            <p
              className="text-xs mt-1"
              style={{ color: "var(--pn-text-muted)" }}
            >
              {getContextHint()}
            </p>
          </div>
        </div>

        {/* Right: Chat */}
        <div className="flex-1 flex flex-col min-h-0">
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
          >
            {messages.length === 0 && <EmptyState />}
            {messages.map((msg) => (
              <ChatBubble key={msg.id} message={msg} />
            ))}
            {orbState === "thinking" && <ThinkingDots />}
          </div>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="shrink-0 px-4 py-3"
            style={{ borderTop: "1px solid var(--pn-border-subtle)" }}
          >
            <div
              className="flex items-center rounded-lg px-3 py-2.5"
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
                placeholder="Talk to Jarvis..."
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: "var(--pn-text-primary)" }}
                disabled={orbState === "thinking"}
              />
              <button
                type="submit"
                disabled={!input.trim() || orbState === "thinking"}
                className="ml-2 w-7 h-7 flex items-center justify-center rounded-md transition-all duration-200"
                style={{
                  color: input.trim() ? "#00D2FF" : "var(--pn-text-muted)",
                  background: input.trim() ? "rgba(0, 210, 255, 0.1)" : "transparent",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3">
      <p
        className="text-sm text-center max-w-[260px]"
        style={{ color: "var(--pn-text-muted)" }}
      >
        I can help with tasks, brain dumps, questions, or just chat.
        Try "What's on my plate today?" or "Create a task to review PRs".
      </p>
    </div>
  );
}

function ChatBubble({ message }: { readonly message: ChatMessage }) {
  const isUser = message.role === "user";
  const time = new Date(message.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
      <div
        className="max-w-[85%] px-3 py-2 rounded-lg text-sm leading-relaxed"
        style={{
          background: isUser
            ? "rgba(0, 210, 255, 0.1)"
            : "rgba(255, 255, 255, 0.04)",
          border: `1px solid ${isUser ? "rgba(0, 210, 255, 0.15)" : "rgba(255, 255, 255, 0.06)"}`,
          color: "var(--pn-text-primary)",
        }}
      >
        {message.text}
      </div>

      {/* Action card */}
      {message.actionCard && (
        <div
          className="mt-1 max-w-[85%] px-3 py-2 rounded-lg text-xs flex items-center gap-2"
          style={{
            background: "rgba(45, 212, 168, 0.08)",
            border: "1px solid rgba(45, 212, 168, 0.15)",
            color: "#2dd4a8",
          }}
        >
          <span>
            {message.actionCard.type === "task" && "\u2610"}
            {message.actionCard.type === "brain_dump" && "\u25CE"}
            {message.actionCard.type === "note" && "\u270E"}
            {message.actionCard.type === "proposal" && "\u25C6"}
          </span>
          <span>{message.actionCard.title}</span>
        </div>
      )}

      <span
        className="text-[0.6rem] mt-0.5 px-1"
        style={{ color: "var(--pn-text-muted)" }}
      >
        {time}
      </span>
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex items-start">
      <div
        className="px-3 py-2.5 rounded-lg flex items-center gap-1.5"
        style={{
          background: "rgba(255, 255, 255, 0.04)",
          border: "1px solid rgba(255, 255, 255, 0.06)",
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: "rgba(0, 210, 255, 0.6)",
              animation: `think-bounce 1.2s ease-in-out ${i * 0.15}s infinite`,
            }}
          />
        ))}
        <style>{`
          @keyframes think-bounce {
            0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
            30% { transform: translateY(-4px); opacity: 1; }
          }
        `}</style>
      </div>
    </div>
  );
}
