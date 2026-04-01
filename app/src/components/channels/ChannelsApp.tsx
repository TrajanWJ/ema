import { useEffect, useState, useCallback } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { useChannelsStore } from "@/stores/channels-store";
import { APP_CONFIGS } from "@/types/workspace";
import { ServerList } from "./ServerList";
import { ChannelTree } from "./ChannelTree";
import { ChatView } from "./ChatView";
import { MemberList } from "./MemberList";
import { UnifiedInboxView } from "./UnifiedInboxView";

const config = APP_CONFIGS["channels"];

export function ChannelsApp() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const viewMode = useChannelsStore((s) => s.viewMode);
  const setViewMode = useChannelsStore((s) => s.setViewMode);
  const showMemberList = useChannelsStore((s) => s.showMemberList);
  const searchMessages = useChannelsStore((s) => s.searchMessages);
  const clearSearch = useChannelsStore((s) => s.clearSearch);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        await useChannelsStore.getState().loadViaRest().catch(() => {});
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load channels");
      }
      if (!cancelled) setReady(true);
      useChannelsStore.getState().connect().catch(() => {});
    }
    init();
    return () => { cancelled = true; };
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      setShowSearch((prev) => {
        if (prev) clearSearch();
        return !prev;
      });
    }
  }, [clearSearch]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!ready) {
    return (
      <AppWindowChrome appId="channels" title={config.title} icon={config.icon} accent={config.accent}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: "12px" }}>
          {error ? (
            <>
              <div style={{ fontSize: "2rem", opacity: 0.3 }}>!</div>
              <span style={{ color: "rgba(239,68,68,0.8)", fontSize: "0.8rem" }}>Error: {error}</span>
              <button
                onClick={() => { setError(null); useChannelsStore.getState().loadViaRest(); }}
                style={{ fontSize: "0.75rem", color: "#5865F2", background: "rgba(88,101,242,0.1)", border: "1px solid rgba(88,101,242,0.3)", borderRadius: "6px", padding: "4px 12px", cursor: "pointer" }}
              >
                Retry
              </button>
            </>
          ) : (
            <>
              <div style={{ width: "24px", height: "24px", border: "2px solid rgba(88,101,242,0.4)", borderTopColor: "#5865F2", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.8rem" }}>Connecting to channels...</span>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </>
          )}
        </div>
      </AppWindowChrome>
    );
  }

  return (
    <AppWindowChrome appId="channels" title={config.title} icon={config.icon} accent={config.accent}>
      {/* Global search overlay */}
      {showSearch && (
        <div style={{ position: "absolute", top: "48px", left: "50%", transform: "translateX(-50%)", zIndex: 50, width: "400px", background: "rgba(14,16,23,0.95)", backdropFilter: "blur(20px)", border: "1px solid rgba(88,101,242,0.3)", borderRadius: "8px", padding: "8px", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
          <input
            autoFocus
            placeholder="Search messages... (Esc to close)"
            onKeyDown={(e) => {
              if (e.key === "Escape") { setShowSearch(false); clearSearch(); }
              if (e.key === "Enter") searchMessages(e.currentTarget.value);
            }}
            style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", padding: "8px 12px", color: "rgba(255,255,255,0.9)", fontSize: "0.8rem", outline: "none" }}
          />
        </div>
      )}

      {/* View mode toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: "2px", position: "absolute", top: "10px", right: "60px", zIndex: 20, background: "rgba(14,16,23,0.55)", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.06)", padding: "2px" }}>
        {(["channels", "inbox"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            style={{
              fontSize: "0.65rem",
              padding: "3px 10px",
              borderRadius: "4px",
              border: "none",
              cursor: "pointer",
              background: viewMode === mode ? "rgba(88,101,242,0.3)" : "transparent",
              color: viewMode === mode ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)",
              fontWeight: viewMode === mode ? 600 : 400,
              transition: "all 0.15s",
            }}
          >
            {mode === "channels" ? "Channels" : "Inbox"}
          </button>
        ))}
      </div>

      {/* Layout */}
      <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
        {viewMode === "channels" ? (
          <>
            <ServerList />
            <ChannelTree />
            <div style={{ flex: 1, display: "flex", minWidth: 0, position: "relative" }}>
              <ChatView />
              {showMemberList && <MemberList />}
            </div>
          </>
        ) : (
          <>
            <ServerList />
            <UnifiedInboxView />
          </>
        )}
      </div>
    </AppWindowChrome>
  );
}
