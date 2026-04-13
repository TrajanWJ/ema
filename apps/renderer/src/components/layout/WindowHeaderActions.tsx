import { useEffect, useRef, useState, type CSSProperties } from "react";

import { OrgSwitcher } from "@/components/org/OrgSwitcher";
import { isDesktopEnvironment } from "@/lib/electron-bridge";
import { navigateToRoute } from "@/lib/router";
import { openApp } from "@/lib/window-manager";
import { SpaceSwitcher } from "@/vapps/spaces/SpaceSwitcher";

interface WindowActionSurfaceProps {
  readonly appId: string;
  readonly embedded: boolean;
  readonly agentChatOpen?: boolean;
  readonly onToggleAgentChat?: () => void;
}

interface WindowRightControlsProps {
  readonly onMinimize: () => void | Promise<void>;
  readonly onMaximize: () => void | Promise<void>;
  readonly onClose: () => void | Promise<void>;
  readonly showSelectors?: boolean;
  readonly showTrafficLights?: boolean;
}

interface MenuAction {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly onSelect: () => void;
}

const shellStyle: CSSProperties = {
  background: "rgba(255,255,255,0.025)",
  border: "1px solid rgba(255,255,255,0.06)",
};

const iconButtonStyle: CSSProperties = {
  width: "30px",
  height: "30px",
  borderRadius: "999px",
  border: "1px solid rgba(255,255,255,0.07)",
  background: "rgba(255,255,255,0.03)",
  color: "var(--pn-text-secondary)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "background 140ms ease, border-color 140ms ease, color 140ms ease",
};

function MenuIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2 3.25H12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M2 7H12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M2 10.75H12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M7 1.75L8.04 2.19L9.19 1.83L10.1 2.74L9.75 3.9L10.19 4.94L11.36 5.28V6.72L10.19 7.06L9.75 8.1L10.1 9.26L9.19 10.17L8.04 9.81L7 10.25L6 9.81L4.85 10.17L3.94 9.26L4.29 8.1L3.85 7.06L2.68 6.72V5.28L3.85 4.94L4.29 3.9L3.94 2.74L4.85 1.83L6 2.19L7 1.75Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <circle cx="7.02" cy="6.99" r="1.82" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M3.42 10.92L1.75 12.25V3.75C1.75 2.92 2.42 2.25 3.25 2.25H10.75C11.58 2.25 12.25 2.92 12.25 3.75V8.25C12.25 9.08 11.58 9.75 10.75 9.75H4.36L3.42 10.92Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path d="M4.25 5H9.75" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M4.25 7.25H8.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

function openSurface(appId: string, embedded: boolean) {
  if (isDesktopEnvironment()) {
    void openApp(appId);
    return;
  }

  if (embedded) {
    navigateToRoute(appId);
    return;
  }

  void openApp(appId);
}

export function WindowQuickActions({
  appId,
  embedded,
  agentChatOpen = false,
  onToggleAgentChat,
}: WindowActionSurfaceProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const menuActions: readonly MenuAction[] = [
    {
      id: "settings",
      label: "Settings",
      description: embedded ? "Open settings in this shell" : "Open the Settings window",
      onSelect: () => openSurface("settings", embedded),
    },
    {
      id: "operator-chat",
      label: "Operator Chat",
      description: embedded ? "Switch this shell to operator chat" : "Open the Operator Chat window",
      onSelect: () => openSurface("operator-chat", embedded),
    },
    {
      id: "agent-chat",
      label: "Agent Chat",
      description: onToggleAgentChat ? "Toggle the left-side agent panel" : "Open the Agent Chat app",
      onSelect: () => {
        if (onToggleAgentChat && appId !== "agent-chat") {
          onToggleAgentChat();
          return;
        }
        openSurface("agent-chat", embedded);
      },
    },
  ];

  return (
    <div className="relative flex shrink-0 items-center gap-1.5" data-tauri-no-drag="">
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((current) => !current)}
          aria-label="Open window menu"
          aria-expanded={menuOpen}
          style={iconButtonStyle}
        >
          <MenuIcon />
        </button>
        {menuOpen ? (
          <div
            className="absolute left-0 top-full z-50 mt-2 min-w-[15rem] overflow-hidden rounded-2xl p-1.5"
            style={{
              background: "rgba(10, 12, 20, 0.96)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 18px 48px rgba(0,0,0,0.42), 0 8px 18px rgba(0,0,0,0.28)",
              backdropFilter: "blur(26px) saturate(180%)",
            }}
          >
            {menuActions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  action.onSelect();
                }}
                className="flex w-full flex-col rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/5"
              >
                <span className="text-[0.72rem] font-semibold" style={{ color: "var(--pn-text-primary)" }}>
                  {action.label}
                </span>
                <span className="mt-0.5 text-[0.62rem]" style={{ color: "var(--pn-text-muted)" }}>
                  {action.description}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => openSurface("settings", embedded)}
        aria-label="Open Settings"
        style={iconButtonStyle}
      >
        <SettingsIcon />
      </button>

      <button
        type="button"
        onClick={() => {
          if (onToggleAgentChat && appId !== "agent-chat") {
            onToggleAgentChat();
            return;
          }
          openSurface("agent-chat", embedded);
        }}
        aria-label={agentChatOpen ? "Hide agent chat panel" : "Show agent chat panel"}
        style={{
          ...iconButtonStyle,
          background: agentChatOpen ? "rgba(167,139,250,0.16)" : iconButtonStyle.background,
          borderColor: agentChatOpen ? "rgba(167,139,250,0.30)" : "rgba(255,255,255,0.07)",
          color: agentChatOpen ? "#d8c1ff" : "var(--pn-text-secondary)",
        }}
      >
        <ChatIcon />
      </button>
    </div>
  );
}

export function WindowRightControls({
  onMinimize,
  onMaximize,
  onClose,
  showSelectors = true,
  showTrafficLights = true,
}: WindowRightControlsProps) {
  return (
    <div
      className="relative flex shrink-0 items-center gap-2 rounded-full px-2 py-1"
      data-tauri-no-drag=""
      style={shellStyle}
    >
      {showSelectors ? (
        <div className="flex items-center gap-2">
          <SpaceSwitcher />
          <OrgSwitcher />
        </div>
      ) : null}

      {showSelectors && showTrafficLights ? (
        <div className="h-5 w-px" style={{ background: "rgba(255,255,255,0.10)" }} />
      ) : null}

      {showTrafficLights ? (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onClose}
            className="app-window-chrome__control h-3.5 w-3.5 rounded-full opacity-85 transition-opacity hover:opacity-100"
            style={{ background: "var(--color-pn-error, #E24B4A)" }}
            aria-label="Close window"
          />
          <button
            type="button"
            onClick={onMinimize}
            className="app-window-chrome__control h-3.5 w-3.5 rounded-full opacity-85 transition-opacity hover:opacity-100"
            style={{ background: "var(--color-pn-warning, #EAB308)" }}
            aria-label="Minimize window"
          />
          <button
            type="button"
            onClick={onMaximize}
            className="app-window-chrome__control h-3.5 w-3.5 rounded-full opacity-85 transition-opacity hover:opacity-100"
            style={{ background: "var(--color-pn-success, #22C55E)" }}
            aria-label="Maximize window"
          />
        </div>
      ) : null}
    </div>
  );
}
