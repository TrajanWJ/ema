import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { useChannelsStore } from "@/stores/channels-store";
import { APP_CONFIGS } from "@/types/workspace";
import { ServerList } from "./ServerList";
import { ChannelTree } from "./ChannelTree";
import { ChatView } from "./ChatView";
import { MemberList } from "./MemberList";

const config = APP_CONFIGS["channels"];

export function ChannelsApp() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        // Try REST load but fall back to demo data gracefully
        await useChannelsStore.getState().loadViaRest().catch(() => {});
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load channels");
      }
      if (!cancelled) setReady(true);

      // Try WebSocket connect (optional)
      useChannelsStore.getState().connect().catch(() => {
        console.warn("Channels WebSocket not available, using demo data");
      });
    }
    init();
    return () => { cancelled = true; };
  }, []);

  if (!ready) {
    return (
      <AppWindowChrome appId="channels" title={config.title} icon={config.icon} accent={config.accent}>
        <div className="flex items-center justify-center h-full">
          <span className="text-[0.8rem]" style={{ color: "var(--pn-text-secondary)" }}>
            {error ? `Error: ${error}` : "Loading..."}
          </span>
        </div>
      </AppWindowChrome>
    );
  }

  return (
    <AppWindowChrome
      appId="channels"
      title={config.title}
      icon={config.icon}
      accent={config.accent}
    >
      {/* Discord-like layout: server rail | channel tree | chat | member list */}
      <div className="flex h-full overflow-hidden">
        <ServerList />
        <ChannelTree />
        <div className="flex-1 flex min-w-0 relative">
          <ChatView />
          <MemberList />
        </div>
      </div>
    </AppWindowChrome>
  );
}
