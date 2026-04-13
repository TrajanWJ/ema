import { useEffect, useRef, useState, type ReactNode } from "react";

import { AgentChatSurface } from "@/components/agent-chat/AgentChatSurface";
import { WindowQuickActions, WindowRightControls } from "@/components/layout/WindowHeaderActions";
import { minimizeWindow, maximizeWindow, closeAppWindow, closeWindow } from "@/lib/electron-bridge";
import { isStandaloneWindow } from "@/lib/router";
import { useWorkspaceStore } from "@/stores/workspace-store";

function isInsideLaunchpad(): boolean {
  return typeof window === "undefined" || !isStandaloneWindow();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

interface AppWindowChromeProps {
  readonly appId: string;
  readonly title: string;
  readonly icon: string;
  readonly accent: string;
  readonly breadcrumb?: string;
  readonly children: ReactNode;
}

export function AppWindowChrome({
  appId,
  title,
  icon,
  accent,
  breadcrumb,
  children,
}: AppWindowChromeProps) {
  const embedded = isInsideLaunchpad();
  const canInlineAgentChat = appId !== "agent-chat";
  const [agentChatOpen, setAgentChatOpen] = useState(false);
  const [agentChatMounted, setAgentChatMounted] = useState(false);
  const [agentChatWidth, setAgentChatWidth] = useState(380);
  const [resizingChat, setResizingChat] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (agentChatOpen) {
      setAgentChatMounted(true);
    }
  }, [agentChatOpen]);

  useEffect(() => {
    if (!resizingChat) return;

    function updateWidth(event: PointerEvent) {
      const rect = contentRef.current?.getBoundingClientRect();
      if (!rect) return;

      const maxWidth = Math.max(360, rect.width - 260);
      const nextWidth = clamp(event.clientX - rect.left, 300, maxWidth);
      setAgentChatWidth(nextWidth);
    }

    function stopResize() {
      setResizingChat(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", updateWidth);
    window.addEventListener("pointerup", stopResize);

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", updateWidth);
      window.removeEventListener("pointerup", stopResize);
    };
  }, [resizingChat]);

  async function handleMinimize() {
    await minimizeWindow();
  }

  async function handleMaximize() {
    await maximizeWindow();
  }

  async function handleClose() {
    if (embedded) {
      await closeWindow();
      return;
    }

    void useWorkspaceStore.getState().updateWindow(appId, { is_open: false }).catch(() => {});
    await closeAppWindow(appId);
  }

  const leftHeader = (
    <div className="flex min-w-0 items-center gap-2">
      <span style={{ color: accent, fontSize: embedded ? "13px" : "14px", filter: "drop-shadow(0 0 12px rgba(255,255,255,0.08))" }}>
        {icon}
      </span>
      <span
        className={`truncate font-semibold tracking-wide ${embedded ? "text-[0.68rem]" : "text-[0.72rem]"}`}
        style={{ color: accent, letterSpacing: "0.08em" }}
      >
        {title}
      </span>
      {breadcrumb ? (
        <span
          className={`truncate rounded-full px-2 py-0.5 font-mono ${embedded ? "text-[0.55rem]" : "text-[0.58rem]"}`}
          style={{ color: "var(--pn-text-muted)", background: "rgba(255,255,255,0.03)" }}
        >
          · {breadcrumb}
        </span>
      ) : null}
      <div className="ml-2">
        <WindowQuickActions
          appId={appId}
          embedded={embedded}
          agentChatOpen={agentChatOpen}
          onToggleAgentChat={canInlineAgentChat ? () => setAgentChatOpen((current) => !current) : undefined}
        />
      </div>
    </div>
  );

  const rightHeader = (
    <WindowRightControls
      onMinimize={handleMinimize}
      onMaximize={handleMaximize}
      onClose={handleClose}
      showSelectors
      showTrafficLights
    />
  );

  const content = (
    <div ref={contentRef} className="flex flex-1 min-h-0">
      {canInlineAgentChat ? (
        <>
          <aside
            className="shrink-0 overflow-hidden"
            style={{
              width: agentChatOpen ? `${agentChatWidth}px` : "0px",
              borderRight: agentChatOpen ? "1px solid var(--pn-border-subtle)" : "1px solid transparent",
              transition: resizingChat ? "none" : "width 220ms ease, border-color 220ms ease",
            }}
          >
            <div
              className="h-full p-3"
              style={{
                opacity: agentChatOpen ? 1 : 0,
                transform: agentChatOpen ? "translateX(0)" : "translateX(-14px)",
                transition: resizingChat ? "none" : "opacity 180ms ease, transform 220ms ease",
                pointerEvents: agentChatOpen ? "auto" : "none",
              }}
            >
              {agentChatMounted ? <AgentChatSurface accent="#a78bfa" compact /> : null}
            </div>
          </aside>
          {agentChatOpen ? (
            <div
              role="separator"
              aria-label="Resize agent chat panel"
              aria-orientation="vertical"
              className="group relative shrink-0 cursor-col-resize"
              style={{ width: "10px" }}
              onPointerDown={(event) => {
                event.preventDefault();
                setResizingChat(true);
              }}
            >
              <div
                className="absolute inset-y-0 left-1/2 -translate-x-1/2 rounded-full transition-colors group-hover:bg-white/20"
                style={{ width: "2px", background: "rgba(255,255,255,0.08)" }}
              />
            </div>
          ) : null}
        </>
      ) : null}
      <main className="flex-1 overflow-auto p-3">{children}</main>
    </div>
  );

  if (embedded) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div
          className="flex items-center justify-between gap-3 px-3 shrink-0"
          style={{
            minHeight: "44px",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0)), var(--pn-window-header)",
            backdropFilter: "blur(14px) saturate(132%)",
            WebkitBackdropFilter: "blur(14px) saturate(132%)",
            borderBottom: "1px solid var(--pn-border-subtle)",
          }}
        >
          {leftHeader}
          {rightHeader}
        </div>
        {content}
      </div>
    );
  }

  return (
    <div className="app-window-chrome h-full flex flex-col overflow-hidden">
      <div
        className="app-window-chrome__header flex items-center justify-between px-4 shrink-0"
        data-tauri-drag-region=""
      >
        {leftHeader}
        {rightHeader}
      </div>

      {content}
    </div>
  );
}
