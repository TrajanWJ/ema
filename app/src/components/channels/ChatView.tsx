import { useEffect, useRef, useState, useCallback } from "react";
import { useChannelsStore } from "@/stores/channels-store";
import { MessageBubble } from "./MessageBubble";
import { InputBar } from "./InputBar";
import { ChannelHeader } from "./ChannelHeader";

export function ChatView() {
  const messages = useChannelsStore((s) => s.messages);
  const activeChannelId = useChannelsStore((s) => s.activeChannelId);
  const sendMessage = useChannelsStore((s) => s.sendMessage);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, autoScroll]);

  // Detect manual scroll
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 100);
  }, []);

  if (!activeChannelId) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        style={{ color: "rgba(255,255,255,0.2)" }}
      >
        <div className="text-center">
          <div className="text-4xl mb-3 opacity-30">💬</div>
          <p className="text-[0.875rem]">No channel selected</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col flex-1 min-w-0 min-h-0"
      style={{ background: "rgba(14,16,23,0.35)" }}
    >
      <ChannelHeader />

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto py-2"
        style={{ minHeight: 0 }}
      >
        {messages.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center h-full gap-2"
            style={{ color: "rgba(255,255,255,0.2)" }}
          >
            <div className="text-3xl opacity-30">#</div>
            <p className="text-[0.8rem]">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <div className="space-y-0.5 pb-2">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
          </div>
        )}
      </div>

      {/* Scroll to bottom button */}
      {!autoScroll && (
        <button
          onClick={() => {
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
            setAutoScroll(true);
          }}
          className="absolute bottom-20 right-6 text-[0.7rem] px-3 py-1.5 rounded-full transition-all"
          style={{
            background: "#5865F2",
            color: "#fff",
            boxShadow: "0 4px 12px rgba(88,101,242,0.4)",
          }}
        >
          ↓ New messages
        </button>
      )}

      <InputBar onSend={sendMessage} placeholder={`Message #${activeChannelId}`} />
    </div>
  );
}
