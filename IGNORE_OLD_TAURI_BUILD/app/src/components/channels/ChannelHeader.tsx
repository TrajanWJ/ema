import { useState } from "react";
import { useChannelsStore } from "@/stores/channels-store";

export function ChannelHeader() {
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const activeChannel = useChannelsStore((s) => s.activeChannel());
  const members = useChannelsStore((s) => s.members);
  const showMemberList = useChannelsStore((s) => s.showMemberList);
  const toggleMemberList = useChannelsStore((s) => s.toggleMemberList);
  const searchMessages = useChannelsStore((s) => s.searchMessages);
  const clearSearch = useChannelsStore((s) => s.clearSearch);

  const headerStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: "12px", padding: "0 16px",
    flexShrink: 0, height: "48px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(14,16,23,0.55)", backdropFilter: "blur(20px)",
  };

  if (!activeChannel) {
    return <div style={headerStyle} />;
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      searchMessages(query);
    } else {
      clearSearch();
    }
  };

  const handleCloseSearch = () => {
    setShowSearch(false);
    setSearchQuery("");
    clearSearch();
  };

  const btnStyle: React.CSSProperties = {
    padding: "4px 8px", borderRadius: "4px", border: "none",
    background: "transparent", cursor: "pointer", fontSize: "0.75rem",
    transition: "all 0.15s",
  };

  return (
    <div style={headerStyle}>
      <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.9rem" }}>#</span>

      <div style={{ display: "flex", flexDirection: "column", gap: "0px" }}>
        <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "rgba(255,255,255,0.9)" }}>
          {activeChannel.name}
        </span>
        {activeChannel.description && (
          <span style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.25)", lineHeight: 1.2 }}>
            {activeChannel.description}
          </span>
        )}
      </div>

      {activeChannel.topic && (
        <>
          <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.1)" }} />
          <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {activeChannel.topic}
          </span>
        </>
      )}

      {/* Right actions */}
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "4px" }}>
        {showSearch && (
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") handleCloseSearch(); }}
            placeholder="Search messages..."
            style={{
              fontSize: "0.75rem", padding: "4px 12px", borderRadius: "6px", outline: "none",
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.85)", width: "200px",
            }}
          />
        )}

        {/* Pin placeholder */}
        <button
          style={{ ...btnStyle, color: "rgba(255,255,255,0.25)" }}
          title="Pinned Messages"
          onMouseEnter={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.25)"; }}
        >
          {"\u{1F4CC}"}
        </button>

        {/* Search toggle */}
        <button
          onClick={() => { if (showSearch) handleCloseSearch(); else setShowSearch(true); }}
          style={{ ...btnStyle, color: showSearch ? "#5865F2" : "rgba(255,255,255,0.3)" }}
          title="Search (Ctrl+K)"
          onMouseEnter={(e) => { if (!showSearch) e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
          onMouseLeave={(e) => { if (!showSearch) e.currentTarget.style.color = "rgba(255,255,255,0.3)"; }}
        >
          {"\u{1F50D}"}
        </button>

        {/* Members toggle */}
        <button
          onClick={toggleMemberList}
          style={{
            ...btnStyle,
            color: showMemberList ? "#5865F2" : "rgba(255,255,255,0.3)",
            display: "flex", alignItems: "center", gap: "4px",
          }}
          title="Toggle Members"
          onMouseEnter={(e) => { if (!showMemberList) e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
          onMouseLeave={(e) => { if (!showMemberList) e.currentTarget.style.color = showMemberList ? "#5865F2" : "rgba(255,255,255,0.3)"; }}
        >
          {"\u{1F465}"}
          <span style={{ fontSize: "0.6rem", background: "rgba(255,255,255,0.08)", borderRadius: "9999px", padding: "1px 5px", fontWeight: 600 }}>
            {members.length}
          </span>
        </button>
      </div>
    </div>
  );
}
