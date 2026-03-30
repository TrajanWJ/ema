import { useState } from "react";
import { useChannelsStore } from "@/stores/channels-store";

export function ChannelHeader() {
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const activeChannel = useChannelsStore((s) => s.activeChannel());

  if (!activeChannel) {
    return (
      <div
        className="flex items-center px-4 shrink-0"
        style={{
          height: "48px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(14,16,23,0.55)",
          backdropFilter: "blur(20px)",
        }}
      />
    );
  }

  return (
    <div
      className="flex items-center gap-3 px-4 shrink-0"
      style={{
        height: "48px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(14,16,23,0.55)",
        backdropFilter: "blur(20px)",
      }}
    >
      <span className="text-[0.8rem]" style={{ color: "rgba(255,255,255,0.3)" }}>
        #
      </span>
      <span className="font-semibold text-[0.875rem]" style={{ color: "rgba(255,255,255,0.9)" }}>
        {activeChannel.name}
      </span>

      {activeChannel.topic && (
        <>
          <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.1)" }} />
          <span className="text-[0.75rem] truncate" style={{ color: "rgba(255,255,255,0.3)" }}>
            {activeChannel.topic}
          </span>
        </>
      )}

      <div className="ml-auto flex items-center gap-2">
        {showSearch ? (
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && (setShowSearch(false), setSearchQuery(""))}
            placeholder="Search messages..."
            className="text-[0.75rem] px-3 py-1 rounded-md outline-none"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.85)",
              width: "200px",
            }}
          />
        ) : null}
        <button
          onClick={() => { setShowSearch(!showSearch); if (showSearch) setSearchQuery(""); }}
          className="text-[0.75rem] px-2 py-1 rounded transition-colors"
          style={{ color: showSearch ? "#5865F2" : "rgba(255,255,255,0.3)" }}
          title="Search (Ctrl+F)"
        >
          🔍
        </button>
        <button
          className="text-[0.75rem] px-2 py-1 rounded transition-colors"
          style={{ color: "rgba(255,255,255,0.3)" }}
          title="Members"
        >
          👥
        </button>
      </div>
    </div>
  );
}
