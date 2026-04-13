import { AgentChatSurface } from "@/components/agent-chat/AgentChatSurface";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { APP_CONFIGS } from "@/types/workspace";

const config = APP_CONFIGS["agent-chat"];

export function AgentChatApp() {
  return (
    <AppWindowChrome appId="agent-chat" title={config.title} icon={config.icon} accent={config.accent}>
      <AgentChatSurface accent={config.accent} />
    </AppWindowChrome>
  );
}
