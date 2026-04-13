import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { useChannelsStore } from "@/stores/channels-store";
import type { ChannelMessage } from "@/stores/channels-store";
import { MessageBubble } from "./MessageBubble";
import { InputBar } from "./InputBar";
import { ChannelHeader } from "./ChannelHeader";

// ---------------------------------------------------------------------------
// Message grouping
// ---------------------------------------------------------------------------

interface GroupedEntry {
  msg: ChannelMessage;
  grouped: boolean;
  showDate: boolean;
}

const FIVE_MINUTES_MS = 5 * 60 * 1000;

function dateDividerLabel(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round(
    (today.getTime() - msgDay.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) {
    return date.toLocaleDateString("en-US", { weekday: "long" });
  }
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function groupMessages(messages: ChannelMessage[]): GroupedEntry[] {
  const result: GroupedEntry[] = [];
  let lastDateKey = "";

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const prev = i > 0 ? messages[i - 1] : null;

    const msgDateKey = new Date(msg.timestamp).toDateString();
    const showDate = msgDateKey !== lastDateKey;
    lastDateKey = msgDateKey;

    const sameAuthor =
      prev !== null &&
      prev.authorId === msg.authorId &&
      prev.role === msg.role;
    const withinWindow =
      prev !== null && msg.timestamp - prev.timestamp < FIVE_MINUTES_MS;
    const grouped = sameAuthor && withinWindow && !showDate;

    result.push({ msg, grouped, showDate });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Search bar
// ---------------------------------------------------------------------------

function SearchBar({
  onClose,
  onFilter,
}: {
  onClose: () => void;
  onFilter: (query: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div
      className="flex items-center gap-2 px-4 py-2 shrink-0"
      style={{
        borderBottom: "1px solid var(--pn-border-default)",
        background: "rgba(14,16,23,0.6)",
      }}
    >
      <span className="text-[0.7rem] shrink-0" style={{ color: "var(--pn-text-muted)" }}>
        Search
      </span>
      <input
        ref={inputRef}
        type="text"
        placeholder="Filter messages in this channel..."
        onChange={(e) => onFilter(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
        className="flex-1 bg-transparent outline-none text-[0.8rem]"
        style={{ color: "var(--pn-text-primary)" }}
      />
      <button
        onClick={onClose}
        className="text-[0.65rem] px-2 py-0.5 rounded transition-colors cursor-pointer"
        style={{
          color: "var(--pn-text-tertiary)",
          background: "rgba(255,255,255,0.05)",
        }}
      >
        Esc
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reply preview bar (above input)
// ---------------------------------------------------------------------------

function ReplyPreview({
  replyTo,
  onCancel,
}: {
  replyTo: ChannelMessage;
  onCancel: () => void;
}) {
  const preview =
    replyTo.content.length > 100
      ? replyTo.content.slice(0, 100) + "\u2026"
      : replyTo.content;

  return (
    <div
      className="flex items-center gap-3 px-4 py-2 shrink-0"
      style={{
        borderTop: "1px solid var(--pn-border-default)",
        background: "rgba(14,16,23,0.5)",
      }}
    >
      <div
        className="flex-1 min-w-0 pl-3 text-[0.75rem] truncate"
        style={{
          borderLeft: `2px solid ${replyTo.authorAccent ?? "var(--pn-text-muted)"}`,
          color: "var(--pn-text-tertiary)",
        }}
      >
        <span
          className="font-semibold mr-2"
          style={{ color: replyTo.authorAccent ?? "var(--pn-text-secondary)" }}
        >
          {replyTo.authorName}
        </span>
        {preview}
      </div>
      <button
        onClick={onCancel}
        className="shrink-0 text-[0.7rem] px-1.5 rounded transition-colors cursor-pointer"
        style={{ color: "var(--pn-text-tertiary)" }}
      >
        x
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Date divider
// ---------------------------------------------------------------------------

function DateDivider({ timestamp }: { timestamp: number }) {
  return (
    <div className="flex items-center mx-4 my-3 gap-3 select-none">
      <div className="flex-1 h-px" style={{ background: "var(--pn-border-default)" }} />
      <span
        className="text-[0.65rem] font-semibold whitespace-nowrap"
        style={{ color: "var(--pn-text-tertiary)" }}
      >
        {dateDividerLabel(timestamp)}
      </span>
      <div className="flex-1 h-px" style={{ background: "var(--pn-border-default)" }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Typing indicator
// ---------------------------------------------------------------------------

function TypingIndicator() {
  const typingMembers = useChannelsStore((s) => s.typingMembers());

  if (typingMembers.length === 0) return null;

  const names = typingMembers.map((m) => m.name).join(", ");
  const verb = typingMembers.length === 1 ? "is typing" : "are typing";

  return (
    <div
      className="px-4 py-1 text-[0.7rem] flex items-center gap-1.5 shrink-0"
      style={{ color: "var(--pn-text-tertiary)" }}
    >
      <span className="inline-flex gap-0.5">
        <span className="animate-bounce" style={{ animationDelay: "0s" }}>&bull;</span>
        <span className="animate-bounce" style={{ animationDelay: "0.15s" }}>&bull;</span>
        <span className="animate-bounce" style={{ animationDelay: "0.3s" }}>&bull;</span>
      </span>
      <span>
        <strong style={{ color: "var(--pn-text-secondary)" }}>{names}</strong>{" "}
        {verb}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scroll-to-bottom FAB
// ---------------------------------------------------------------------------

function ScrollToBottomFab({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute bottom-20 right-6 text-[0.7rem] px-4 py-1.5 rounded-full cursor-pointer transition-all z-10"
      style={{
        background: "rgba(88,101,242,0.85)",
        color: "#fff",
        border: "1px solid rgba(88,101,242,0.5)",
        boxShadow: "0 4px 16px rgba(88,101,242,0.35)",
        backdropFilter: "blur(8px)",
      }}
    >
      New messages
    </button>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyChannel({ channelName, isAgent }: { channelName: string; isAgent?: boolean }) {
  return (
    <div
      className="flex flex-col items-center justify-center h-full gap-2"
      style={{ color: "var(--pn-text-muted)" }}
    >
      <div className="text-[2.5rem] opacity-30">{isAgent ? "🤖" : "#"}</div>
      <p
        className="text-[0.9rem] font-semibold"
        style={{ color: "var(--pn-text-secondary)" }}
      >
        {isAgent ? `Chat with ${channelName}` : `Welcome to #${channelName}`}
      </p>
      <p className="text-[0.75rem]">
        {isAgent
          ? "Send a message to start a conversation with this agent."
          : "This is the start of the channel. Send a message to begin."}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// No channel selected
// ---------------------------------------------------------------------------

function NoChannelSelected() {
  return (
    <div
      className="flex-1 flex items-center justify-center"
      style={{ color: "var(--pn-text-muted)" }}
    >
      <div className="text-center">
        <div className="text-[2.5rem] mb-3 opacity-30">#</div>
        <p className="text-[0.875rem]">Select a channel to start chatting</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChatView (exported)
// ---------------------------------------------------------------------------

export function ChatView() {
  const messages = useChannelsStore((s) => s.messages);
  const activeChannelId = useChannelsStore((s) => s.activeChannelId);
  const activeChannel = useChannelsStore((s) => s.activeChannel());
  const sendMessage = useChannelsStore((s) => s.sendMessage);
  const agentStreaming = useChannelsStore((s) => s.agentStreaming);
  const isAgent = useChannelsStore((s) => s.isAgentChannel());

  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [replyToId, setReplyToId] = useState<string | null>(null);

  // Keyboard shortcut: Ctrl/Cmd+F for in-channel search
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setShowSearch((prev) => {
          if (prev) setSearchFilter("");
          return !prev;
        });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Filter messages by search query (client-side)
  const filteredMessages = useMemo(() => {
    if (!searchFilter.trim()) return messages;
    const q = searchFilter.toLowerCase();
    return messages.filter(
      (m) =>
        m.content.toLowerCase().includes(q) ||
        m.authorName.toLowerCase().includes(q),
    );
  }, [messages, searchFilter]);

  const grouped = useMemo(() => groupMessages(filteredMessages), [filteredMessages]);

  // Get the last message content length to trigger scroll during streaming
  const lastMsgLen = messages.length > 0 ? messages[messages.length - 1].content.length : 0;

  // Auto-scroll on new messages and during streaming
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages.length, lastMsgLen, autoScroll]);

  // Detect user scroll position
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 80);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
    setAutoScroll(true);
  }, []);

  // Reply handling
  const replyToMessage = useMemo(
    () => (replyToId ? messages.find((m) => m.id === replyToId) ?? null : null),
    [messages, replyToId],
  );

  const handleReply = useCallback((messageId: string) => {
    setReplyToId(messageId);
  }, []);

  const handleSend = useCallback(
    (content: string) => {
      // TODO: pass replyToId to sendMessage when backend supports it
      sendMessage(content);
      setReplyToId(null);
    },
    [sendMessage],
  );

  // Reset state when channel changes
  useEffect(() => {
    setReplyToId(null);
    setShowSearch(false);
    setSearchFilter("");
    setAutoScroll(true);
  }, [activeChannelId]);

  // --- No channel selected ---
  if (!activeChannelId) {
    return <NoChannelSelected />;
  }

  const channelName = activeChannel?.name ?? activeChannelId;

  return (
    <div
      className="flex flex-col flex-1 min-w-0 min-h-0 relative"
      style={{ background: "rgba(14,16,23,0.35)" }}
    >
      <ChannelHeader />

      {/* In-channel search bar */}
      {showSearch && (
        <SearchBar
          onClose={() => {
            setShowSearch(false);
            setSearchFilter("");
          }}
          onFilter={setSearchFilter}
        />
      )}

      {/* Search result count */}
      {showSearch && searchFilter.trim() && (
        <div
          className="px-4 py-1 text-[0.65rem] shrink-0"
          style={{
            color: "var(--pn-text-tertiary)",
            borderBottom: "1px solid var(--pn-border-subtle)",
          }}
        >
          {filteredMessages.length} message{filteredMessages.length !== 1 ? "s" : ""} found
        </div>
      )}

      {/* Message list */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto min-h-0"
        style={{ scrollBehavior: "smooth", paddingTop: 8 }}
      >
        {grouped.length === 0 && !searchFilter.trim() ? (
          <EmptyChannel channelName={channelName} isAgent={isAgent} />
        ) : grouped.length === 0 && searchFilter.trim() ? (
          <div
            className="flex items-center justify-center h-full text-[0.8rem]"
            style={{ color: "var(--pn-text-muted)" }}
          >
            No messages match your search.
          </div>
        ) : (
          <div className="pb-2">
            {grouped.map(({ msg, grouped: isGrouped, showDate }) => (
              <div key={msg.id}>
                {showDate && <DateDivider timestamp={msg.timestamp} />}
                <MessageBubble
                  message={msg}
                  grouped={isGrouped}
                  onReply={handleReply}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Typing / streaming indicator */}
      {agentStreaming && (
        <div
          className="px-4 py-1 text-[0.7rem] flex items-center gap-1.5 shrink-0"
          style={{ color: "var(--pn-accent-teal, #2dd4a8)" }}
        >
          <span className="inline-flex gap-0.5">
            <span className="animate-bounce" style={{ animationDelay: "0s" }}>&bull;</span>
            <span className="animate-bounce" style={{ animationDelay: "0.15s" }}>&bull;</span>
            <span className="animate-bounce" style={{ animationDelay: "0.3s" }}>&bull;</span>
          </span>
          <span>Agent is responding...</span>
        </div>
      )}
      {!agentStreaming && <TypingIndicator />}

      {/* Scroll to bottom FAB */}
      {!autoScroll && <ScrollToBottomFab onClick={scrollToBottom} />}

      {/* Reply preview */}
      {replyToMessage && (
        <ReplyPreview
          replyTo={replyToMessage}
          onCancel={() => setReplyToId(null)}
        />
      )}

      <InputBar
        onSend={handleSend}
        placeholder={isAgent ? `Message ${channelName}...` : `Message #${channelName}`}
      />
    </div>
  );
}
