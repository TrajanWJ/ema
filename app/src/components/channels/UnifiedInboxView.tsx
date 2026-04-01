import { useEffect, useState, useRef, useCallback } from "react";
import { useChannelsStore } from "@/stores/channels-store";
import type { ChannelMessage } from "@/stores/channels-store";

function relativeTime(timestamp: number): string {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

function ChannelBadge({ channelId, serverId }: { channelId: string; serverId?: string }) {
  return (
    <span style={{
      fontSize: "0.6rem", padding: "1px 6px", borderRadius: "9999px",
      background: "rgba(88,101,242,0.12)", border: "1px solid rgba(88,101,242,0.2)",
      color: "rgba(88,101,242,0.8)", fontWeight: 600, whiteSpace: "nowrap",
    }}>
      {serverId ? `${serverId}/` : ""}#{channelId}
    </span>
  );
}

function InboxMessage({ message, onClick }: { message: ChannelMessage & { _channelId?: string; _serverId?: string }; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const accent = message.authorAccent ?? "#6b95f0";

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", gap: "12px", padding: "10px 16px", width: "100%",
        border: "none", borderBottom: "1px solid rgba(255,255,255,0.04)",
        background: hovered ? "rgba(255,255,255,0.03)" : "transparent",
        cursor: "pointer", textAlign: "left", transition: "background 0.1s",
      }}
    >
      {/* Avatar */}
      <div style={{
        width: "32px", height: "32px", borderRadius: "50%", flexShrink: 0,
        background: `${accent}22`, border: `1px solid ${accent}44`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "0.65rem", fontWeight: 700, color: accent,
      }}>
        {message.authorName.split(/[\s-_]/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("")}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
          <span style={{ fontSize: "0.8rem", fontWeight: 600, color: accent }}>{message.authorName}</span>
          <ChannelBadge channelId={message._channelId ?? "unknown"} serverId={message._serverId} />
          <span style={{ marginLeft: "auto", fontSize: "0.6rem", color: "rgba(255,255,255,0.25)", flexShrink: 0 }}>
            {relativeTime(message.timestamp)}
          </span>
        </div>
        <div style={{
          fontSize: "0.75rem", color: "rgba(255,255,255,0.6)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {message.content || "(tool call)"}
        </div>
      </div>
    </button>
  );
}

type TimeRange = "1h" | "24h" | "7d" | "all";

export function UnifiedInboxView() {
  const servers = useChannelsStore((s) => s.servers);
  const inboxMessages = useChannelsStore((s) => s.inboxMessages);
  const messages = useChannelsStore((s) => s.messages);
  const loadInbox = useChannelsStore((s) => s.loadInbox);
  const setActiveChannel = useChannelsStore((s) => s.setActiveChannel);
  const setActiveServer = useChannelsStore((s) => s.setActiveServer);
  const setViewMode = useChannelsStore((s) => s.setViewMode);
  const members = useChannelsStore((s) => s.members);

  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [displayCount, setDisplayCount] = useState(50);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadInbox(); }, [loadInbox]);

  // Use inboxMessages if available, otherwise fall back to all messages from all channels
  const allMessages: (ChannelMessage & { _channelId?: string; _serverId?: string })[] =
    inboxMessages.length > 0
      ? inboxMessages
      : messages.map((m) => ({ ...m, _channelId: useChannelsStore.getState().activeChannelId ?? undefined, _serverId: useChannelsStore.getState().activeServerId ?? undefined }));

  // Filter
  const filtered = allMessages.filter((m) => {
    if (search && !m.content.toLowerCase().includes(search.toLowerCase()) && !m.authorName.toLowerCase().includes(search.toLowerCase())) return false;
    if (channelFilter !== "all" && m._channelId !== channelFilter) return false;
    if (agentFilter !== "all" && m.authorId !== agentFilter) return false;
    if (timeRange !== "all") {
      const now = Date.now();
      const ranges: Record<TimeRange, number> = { "1h": 3600000, "24h": 86400000, "7d": 604800000, all: 0 };
      if (now - m.timestamp > ranges[timeRange]) return false;
    }
    return true;
  });

  const displayed = filtered.slice(0, displayCount);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 100) {
      setDisplayCount((prev) => Math.min(prev + 50, filtered.length));
    }
  }, [filtered.length]);

  const jumpToMessage = (msg: ChannelMessage & { _channelId?: string; _serverId?: string }) => {
    if (msg._serverId) setActiveServer(msg._serverId);
    if (msg._channelId) setActiveChannel(msg._channelId);
    setViewMode("channels");
  };

  // Collect all channel IDs for filter
  const allChannels = servers.flatMap((s) => s.channels.map((c) => ({ id: c.id, name: c.name, serverId: s.id })));
  const agents = members.filter((m) => m.role === "Agent");

  const selectStyle: React.CSSProperties = {
    fontSize: "0.7rem", padding: "4px 8px", borderRadius: "4px",
    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.7)", outline: "none",
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "rgba(14,16,23,0.35)" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: "12px", padding: "0 16px",
        height: "48px", flexShrink: 0,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(14,16,23,0.55)", backdropFilter: "blur(20px)",
      }}>
        <span style={{ fontSize: "1rem" }}>{"\u{1F4E5}"}</span>
        <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "rgba(255,255,255,0.9)" }}>Unified Inbox</span>
        <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.3)" }}>
          {filtered.length} message{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Filter bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", flexShrink: 0, flexWrap: "wrap",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        background: "rgba(14,16,23,0.25)",
      }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search inbox..."
          style={{
            flex: 1, minWidth: "160px", fontSize: "0.75rem", padding: "5px 10px",
            borderRadius: "6px", outline: "none",
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.85)",
          }}
        />

        <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)} style={selectStyle}>
          <option value="all">All Channels</option>
          {allChannels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
        </select>

        <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} style={selectStyle}>
          <option value="all">All Agents</option>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>

        <select value={timeRange} onChange={(e) => setTimeRange(e.target.value as TimeRange)} style={selectStyle}>
          <option value="all">All Time</option>
          <option value="1h">Last Hour</option>
          <option value="24h">Last 24h</option>
          <option value="7d">Last 7 Days</option>
        </select>
      </div>

      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {displayed.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "8px", color: "rgba(255,255,255,0.2)" }}>
            <div style={{ fontSize: "2rem", opacity: 0.3 }}>{"\u{1F4E5}"}</div>
            <p style={{ fontSize: "0.85rem" }}>No messages in inbox</p>
            <p style={{ fontSize: "0.7rem" }}>Messages from all channels will appear here</p>
          </div>
        ) : (
          displayed.map((msg) => (
            <InboxMessage key={msg.id} message={msg} onClick={() => jumpToMessage(msg)} />
          ))
        )}

        {displayCount < filtered.length && (
          <div style={{ padding: "12px", textAlign: "center", fontSize: "0.7rem", color: "rgba(255,255,255,0.3)" }}>
            Scroll for more ({filtered.length - displayCount} remaining)
          </div>
        )}
      </div>
    </div>
  );
}
