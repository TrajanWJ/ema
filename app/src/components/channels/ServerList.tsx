import { useChannelsStore } from "@/stores/channels-store";

export function ServerList() {
  const servers = useChannelsStore((s) => s.servers);
  const activeServerId = useChannelsStore((s) => s.activeServerId);
  const setActiveServer = useChannelsStore((s) => s.setActiveServer);

  return (
    <div
      className="flex flex-col items-center py-3 gap-2 shrink-0"
      style={{
        width: "68px",
        background: "rgba(14,16,23,0.55)",
        backdropFilter: "blur(20px)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {servers.map((server) => {
        const active = server.id === activeServerId;
        return (
          <div key={server.id} className="relative group">
            {/* Active indicator */}
            {active && (
              <span
                className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r"
                style={{ width: "4px", height: "36px", background: "rgba(255,255,255,0.9)" }}
              />
            )}
            <button
              onClick={() => setActiveServer(server.id)}
              title={server.name}
              className="transition-all duration-150"
              style={{
                width: "44px",
                height: "44px",
                borderRadius: active ? "12px" : "22px",
                background: active
                  ? "rgba(88,101,242,0.8)"
                  : "rgba(255,255,255,0.06)",
                backdropFilter: "blur(8px)",
                border: `1px solid ${active ? "rgba(88,101,242,0.4)" : "rgba(255,255,255,0.08)"}`,
                color: active ? "#fff" : "rgba(255,255,255,0.5)",
                fontSize: "1.2rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLButtonElement).style.borderRadius = "12px";
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(88,101,242,0.5)";
                  (e.currentTarget as HTMLButtonElement).style.color = "#fff";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLButtonElement).style.borderRadius = "22px";
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)";
                  (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.5)";
                }
              }}
            >
              {server.icon}
            </button>
          </div>
        );
      })}

      {/* Divider */}
      <div style={{ width: "32px", height: "1px", background: "rgba(255,255,255,0.08)" }} />

      {/* Add server placeholder */}
      <button
        title="Add Server"
        className="flex items-center justify-center transition-all duration-150"
        style={{
          width: "44px",
          height: "44px",
          borderRadius: "22px",
          background: "rgba(255,255,255,0.04)",
          border: "1px dashed rgba(255,255,255,0.12)",
          color: "rgba(255,255,255,0.3)",
          fontSize: "1.2rem",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderRadius = "12px";
          (e.currentTarget as HTMLButtonElement).style.color = "#57f287";
          (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(87,242,135,0.3)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderRadius = "22px";
          (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.3)";
          (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.12)";
        }}
      >
        +
      </button>
    </div>
  );
}
