import { useChannelsStore } from "@/stores/channels-store";

const CHANNEL_TYPE_ICONS: Record<string, string> = {
  text: "#",
  voice: "🔊",
  announcement: "📢",
};

export function ChannelTree() {
  const activeServer = useChannelsStore((s) => s.activeServer());
  const activeChannelId = useChannelsStore((s) => s.activeChannelId);
  const setActiveChannel = useChannelsStore((s) => s.setActiveChannel);

  if (!activeServer) {
    return (
      <div
        className="flex flex-col shrink-0"
        style={{
          width: "220px",
          background: "rgba(14,16,23,0.45)",
          backdropFilter: "blur(20px)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
        }}
      />
    );
  }

  return (
    <div
      className="flex flex-col shrink-0"
      style={{
        width: "220px",
        background: "rgba(14,16,23,0.45)",
        backdropFilter: "blur(20px)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Server header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          minHeight: "48px",
        }}
      >
        <span
          className="font-semibold truncate text-[0.875rem]"
          style={{ color: "rgba(255,255,255,0.9)" }}
        >
          {activeServer.name}
        </span>
        <button
          style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.75rem" }}
          className="hover:text-white/70 transition-colors"
        >
          ⌄
        </button>
      </div>

      {/* Channels */}
      <div className="flex-1 overflow-y-auto py-2 px-2">
        <div
          className="text-[0.65rem] font-semibold uppercase tracking-wider px-2 py-1 mb-1"
          style={{ color: "rgba(255,255,255,0.3)" }}
        >
          Channels
        </div>
        {activeServer.channels.map((channel) => {
          const active = channel.id === activeChannelId;
          return (
            <button
              key={channel.id}
              onClick={() => setActiveChannel(channel.id)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-all duration-100 group"
              style={{
                background: active ? "rgba(88,101,242,0.15)" : "transparent",
                color: active ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
                  (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.7)";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.4)";
                }
              }}
            >
              <span
                className="shrink-0 text-[0.8rem]"
                style={{ color: active ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.25)" }}
              >
                {CHANNEL_TYPE_ICONS[channel.type] ?? "#"}
              </span>
              <span className="text-[0.8rem] truncate">{channel.name}</span>
              {channel.unread != null && channel.unread > 0 && (
                <span
                  className="ml-auto text-[0.65rem] font-bold rounded-full px-1.5 py-0.5 shrink-0"
                  style={{ background: "#5865F2", color: "#fff" }}
                >
                  {channel.unread}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
