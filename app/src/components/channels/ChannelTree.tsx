import { useState, useMemo } from "react";
import { useChannelsStore } from "@/stores/channels-store";
import type { ChannelDef } from "@/stores/channels-store";

const CHANNEL_TYPE_ICONS: Record<string, string> = {
  text: "#",
  voice: "\u{1F50A}",
  announcement: "\u{1F4E2}",
};

export function ChannelTree() {
  const activeServer = useChannelsStore((s) => s.activeServer());
  const activeChannelId = useChannelsStore((s) => s.activeChannelId);
  const setActiveChannel = useChannelsStore((s) => s.setActiveChannel);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [hoveredChannel, setHoveredChannel] = useState<string | null>(null);

  const categorized = useMemo(() => {
    if (!activeServer) return new Map<string, ChannelDef[]>();
    const map = new Map<string, typeof activeServer.channels>();
    for (const ch of activeServer.channels) {
      const cat = ch.category ?? "General";
      const list = map.get(cat) ?? [];
      list.push(ch);
      map.set(cat, list);
    }
    return map;
  }, [activeServer]);

  const panelStyle: React.CSSProperties = {
    display: "flex", flexDirection: "column", flexShrink: 0,
    width: "220px",
    background: "rgba(14,16,23,0.45)",
    backdropFilter: "blur(20px)",
    borderRight: "1px solid rgba(255,255,255,0.06)",
  };

  if (!activeServer) {
    return <div style={panelStyle} />;
  }

  function toggleCategory(cat: string) {
    setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  }

  return (
    <div style={panelStyle}>
      {/* Server header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", minHeight: "48px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <span style={{ color: "rgba(255,255,255,0.9)", fontWeight: 600, fontSize: "0.875rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {activeServer.name}
        </span>
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.75rem" }}>\u2304</span>
      </div>

      {/* Channel list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
        {Array.from(categorized.entries()).map(([category, channels]) => {
          const collapsed = collapsedCategories[category] ?? false;
          return (
            <div key={category} style={{ marginBottom: "8px" }}>
              {/* Category header */}
              <button
                onClick={() => toggleCategory(category)}
                style={{
                  display: "flex", alignItems: "center", gap: "4px", width: "100%",
                  padding: "2px 8px", border: "none", background: "transparent", cursor: "pointer",
                  color: "rgba(255,255,255,0.3)", fontSize: "0.65rem", fontWeight: 600,
                  textTransform: "uppercase", letterSpacing: "0.05em",
                }}
              >
                <span style={{ fontSize: "0.55rem", transition: "transform 0.15s", transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)" }}>
                  \u25BC
                </span>
                {category}
              </button>

              {/* Channels */}
              {!collapsed && channels.map((channel: (typeof activeServer)["channels"][number]) => {
                const active = channel.id === activeChannelId;
                const isHovered = hoveredChannel === channel.id;
                return (
                  <button
                    key={channel.id}
                    onClick={() => setActiveChannel(channel.id)}
                    onMouseEnter={() => setHoveredChannel(channel.id)}
                    onMouseLeave={() => setHoveredChannel(null)}
                    title={channel.description ?? channel.topic ?? ""}
                    style={{
                      display: "flex", alignItems: "center", gap: "6px",
                      width: "100%", padding: "5px 8px", border: "none", borderRadius: "6px",
                      textAlign: "left", cursor: "pointer",
                      background: active ? "rgba(88,101,242,0.15)" : isHovered ? "rgba(255,255,255,0.05)" : "transparent",
                      color: active ? "rgba(255,255,255,0.9)" : isHovered ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.4)",
                      transition: "all 0.1s",
                    }}
                  >
                    <span style={{ flexShrink: 0, fontSize: "0.8rem", color: active ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.25)" }}>
                      {CHANNEL_TYPE_ICONS[channel.type] ?? "#"}
                    </span>
                    <span style={{ fontSize: "0.8rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                      {channel.name}
                    </span>
                    {channel.unread != null && channel.unread > 0 && (
                      <span style={{ marginLeft: "auto", fontSize: "0.6rem", fontWeight: 700, borderRadius: "9999px", padding: "1px 6px", background: "#5865F2", color: "#fff", flexShrink: 0 }}>
                        {channel.unread}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Create channel button */}
      <button
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
          margin: "8px", padding: "6px", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: "6px",
          background: "transparent", color: "rgba(255,255,255,0.3)", fontSize: "0.75rem",
          cursor: "pointer", transition: "all 0.15s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.6)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.3)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
      >
        + Create Channel
      </button>
    </div>
  );
}
