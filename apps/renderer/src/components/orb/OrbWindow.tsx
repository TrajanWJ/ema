import { useState, useCallback, useEffect, useRef } from "react";
import { JarvisOrb } from "@/components/voice/JarvisOrb";
import { OrbExpanded } from "./OrbExpanded";
import { useJarvisStore } from "@/stores/jarvis-store";
import type { OrbState } from "@/stores/jarvis-store";
import type { VoiceState } from "@/stores/voice-store";

const ORB_TO_VOICE: Record<OrbState, VoiceState> = {
  idle: "idle",
  listening: "listening",
  thinking: "processing",
  speaking: "speaking",
};

export function OrbWindow() {
  const [expanded, setExpanded] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const contextRef = useRef<HTMLDivElement>(null);
  const orbState = useJarvisStore((s) => s.orbState);

  useEffect(() => {
    useJarvisStore.getState().connect();
  }, []);

  const handleOrbClick = useCallback(() => {
    if (showContext) {
      setShowContext(false);
      return;
    }
    setExpanded(true);
  }, [showContext]);

  const handleCollapse = useCallback(() => {
    setExpanded(false);
  }, []);

  // Resize window when expanding/collapsing — handled by Electron main process via IPC
  useEffect(() => {
    // Window resizing for orb expand/collapse is managed at the shell level
  }, [expanded]);

  // Close context menu on outside click
  useEffect(() => {
    if (!showContext) return;
    const handler = (e: MouseEvent) => {
      if (contextRef.current && !contextRef.current.contains(e.target as Node)) {
        setShowContext(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [showContext]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setShowContext((prev) => !prev);
  }, []);

  const handleContextAction = useCallback(async (action: string) => {
    setShowContext(false);
    const { openAppWindow } = await import("@/lib/electron-bridge");
    await openAppWindow(action);
  }, []);

  if (expanded) {
    return <OrbExpanded onCollapse={handleCollapse} />;
  }

  return (
    <div
      className="w-[80px] h-[80px] flex items-center justify-center"
      style={{ background: "transparent", position: "relative" }}
      onContextMenu={handleContextMenu}
    >
      <div
        onClick={handleOrbClick}
        className="w-[72px] h-[72px] rounded-full overflow-hidden cursor-pointer"
        style={{
          background: "rgba(6, 6, 16, 0.7)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(0, 210, 255, 0.2)",
          boxShadow: "0 0 20px rgba(0, 210, 255, 0.15), inset 0 0 12px rgba(0, 0, 0, 0.4)",
        }}
      >
        <JarvisOrb
          state={ORB_TO_VOICE[orbState]}
          audioLevel={0}
          onClick={handleOrbClick}
        />
      </div>

      {/* Context menu */}
      {showContext && (
        <div
          ref={contextRef}
          className="absolute"
          style={{
            bottom: 84,
            right: 0,
            minWidth: 170,
            borderRadius: 10,
            background: "rgba(14, 16, 23, 0.95)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            padding: "6px 0",
            zIndex: 100,
          }}
        >
          <ContextItem label="Quick Note" icon="N" onClick={() => handleContextAction("brain-dump")} />
          <ContextItem label="Focus Timer" icon="F" onClick={() => handleContextAction("focus")} />
          <ContextItem label="Tasks" icon="T" onClick={() => handleContextAction("tasks")} />
          <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "4px 0" }} />
          <ContextItem label="Open Jarvis" onClick={() => handleContextAction("jarvis")} />
          <ContextItem label="Settings" onClick={() => handleContextAction("settings")} />
        </div>
      )}
    </div>
  );
}

function ContextItem({
  label,
  icon,
  onClick,
}: {
  readonly label: string;
  readonly icon?: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="w-full flex items-center justify-between px-3 py-1.5 text-xs hover:bg-white/5 transition-colors"
      style={{ color: "var(--pn-text-secondary)" }}
    >
      <span>{label}</span>
      {icon && (
        <span className="text-[0.6rem] font-mono ml-4" style={{ color: "var(--pn-text-muted)" }}>
          {icon}
        </span>
      )}
    </button>
  );
}
