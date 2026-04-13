import { useState, useRef, useCallback, useEffect } from "react";
import { JarvisOrb } from "./JarvisOrb";
import type { VoiceState } from "@/stores/voice-store";

interface FloatingJarvisOrbProps {
  readonly voiceState: VoiceState;
  readonly audioLevel: number;
  readonly onToggleListening: () => void;
  readonly onPushToTalkStart: () => void;
  readonly onPushToTalkEnd: () => void;
  readonly onDoubleClick: () => void;
}

const ORB_SIZE = 80;
const DRAG_THRESHOLD = 5;
const HOLD_DELAY = 500;

const STATE_BORDER_COLORS: Record<VoiceState, string> = {
  idle: "rgba(30, 144, 255, 0.3)",
  listening: "rgba(0, 210, 255, 0.8)",
  processing: "rgba(255, 190, 60, 0.7)",
  speaking: "rgba(40, 200, 100, 0.7)",
  error: "rgba(255, 60, 60, 0.8)",
};

const STATE_SHADOW_COLORS: Record<VoiceState, string> = {
  idle: "rgba(30, 144, 255, 0.15)",
  listening: "rgba(0, 210, 255, 0.4)",
  processing: "rgba(255, 190, 60, 0.35)",
  speaking: "rgba(40, 200, 100, 0.35)",
  error: "rgba(255, 60, 60, 0.4)",
};

const STATUS_DOT_COLORS: Record<VoiceState, string> = {
  idle: "rgba(30, 144, 255, 0.5)",
  listening: "rgba(0, 210, 255, 1)",
  processing: "rgba(255, 190, 60, 1)",
  speaking: "rgba(40, 200, 100, 1)",
  error: "var(--color-pn-error)",
};

export function FloatingJarvisOrb({
  voiceState,
  audioLevel,
  onToggleListening,
  onPushToTalkStart,
  onPushToTalkEnd,
  onDoubleClick,
}: FloatingJarvisOrbProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isPushToTalk, setIsPushToTalk] = useState(false);

  const draggingRef = useRef(false);
  const didDragRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const startMouseRef = useRef({ x: 0, y: 0 });
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdFiredRef = useRef(false);

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      draggingRef.current = true;
      didDragRef.current = false;
      holdFiredRef.current = false;
      startPosRef.current = { x: position.x, y: position.y };
      startMouseRef.current = { x: e.clientX, y: e.clientY };

      // Start hold timer for push-to-talk
      holdTimerRef.current = setTimeout(() => {
        if (!didDragRef.current) {
          holdFiredRef.current = true;
          setIsPushToTalk(true);
          onPushToTalkStart();
        }
      }, HOLD_DELAY);
    },
    [position, onPushToTalkStart],
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;

      const dx = e.clientX - startMouseRef.current.x;
      const dy = e.clientY - startMouseRef.current.y;

      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        didDragRef.current = true;
        clearHoldTimer();
      }

      if (didDragRef.current) {
        setPosition({
          x: startPosRef.current.x + dx,
          y: startPosRef.current.y + dy,
        });
      }
    };

    const handleMouseUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      clearHoldTimer();

      if (holdFiredRef.current) {
        // End push-to-talk
        setIsPushToTalk(false);
        onPushToTalkEnd();
        return;
      }

      if (!didDragRef.current) {
        // Short click -- toggle listening
        onToggleListening();
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [onToggleListening, onPushToTalkEnd, clearHoldTimer]);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onDoubleClick();
      window.dispatchEvent(new CustomEvent("ema:toggle-voice-history"));
    },
    [onDoubleClick],
  );

  const pulseClass =
    voiceState === "listening" || voiceState === "speaking"
      ? "animate-pulse-border"
      : "";

  const isProcessing = voiceState === "processing";

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        transform: `translate(${position.x}px, ${position.y}px)`,
        zIndex: 9999,
        transition: draggingRef.current ? "none" : "transform 200ms ease",
      }}
    >
      {/* Main orb container */}
      <div
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        style={{
          width: ORB_SIZE,
          height: ORB_SIZE,
          borderRadius: "50%",
          background: "rgba(10, 12, 20, 0.6)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          border: `1.5px solid ${STATE_BORDER_COLORS[voiceState]}`,
          boxShadow: `0 0 ${isPushToTalk ? 20 : 12}px ${STATE_SHADOW_COLORS[voiceState]}, inset 0 0 8px rgba(0, 0, 0, 0.3)`,
          cursor: draggingRef.current ? "grabbing" : "pointer",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "border-color 200ms ease, box-shadow 200ms ease",
          userSelect: "none",
        }}
        className={pulseClass}
      >
        {/* Processing rotating gradient overlay */}
        {isProcessing && (
          <div
            style={{
              position: "absolute",
              inset: -2,
              borderRadius: "50%",
              background:
                "conic-gradient(from 0deg, transparent, rgba(255, 190, 60, 0.4), transparent, rgba(255, 190, 60, 0.2), transparent)",
              animation: "spin-border 2s linear infinite",
              pointerEvents: "none",
            }}
          />
        )}

        {/* JarvisOrb canvas */}
        <div
          style={{
            width: ORB_SIZE - 8,
            height: ORB_SIZE - 8,
            borderRadius: "50%",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <JarvisOrb state={voiceState} audioLevel={audioLevel} />
        </div>
      </div>

      {/* Status indicator dot */}
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: STATUS_DOT_COLORS[voiceState],
          margin: "6px auto 0",
          boxShadow: `0 0 6px ${STATUS_DOT_COLORS[voiceState]}`,
          transition: "background 200ms ease, box-shadow 200ms ease",
        }}
      />

      {/* Keyframe styles injected once */}
      <style>{`
        @keyframes spin-border {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-pulse-border {
          animation: orb-pulse 1.5s ease-in-out infinite;
        }
        @keyframes orb-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.04); }
        }
      `}</style>
    </div>
  );
}
