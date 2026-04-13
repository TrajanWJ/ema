import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { TranscriptEntry } from "@/stores/voice-store";

interface VoiceHistoryPanelProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly transcript: readonly TranscriptEntry[];
}

const PANEL_WIDTH = 380;

function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 10) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export function VoiceHistoryPanel({
  open,
  onClose,
  transcript,
}: VoiceHistoryPanelProps) {
  const [search, setSearch] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new entries
  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [transcript.length, open]);

  const filteredTranscript = useMemo(() => {
    if (!search.trim()) return transcript;
    const q = search.toLowerCase();
    return transcript.filter((e) => e.text.toLowerCase().includes(q));
  }, [transcript, search]);

  const handleSpeak = useCallback((text: string) => {
    window.dispatchEvent(
      new CustomEvent("ema:speak-text", { detail: { text } }),
    );
  }, []);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.3)",
            zIndex: 9998,
            transition: "opacity 300ms ease",
          }}
        />
      )}

      {/* Panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          height: "100vh",
          width: PANEL_WIDTH,
          background: "rgba(10, 12, 20, 0.95)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderLeft: "1px solid var(--pn-border-subtle)",
          transform: open ? "translateX(0)" : `translateX(${PANEL_WIDTH}px)`,
          transition: "transform 300ms ease",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid var(--pn-border-subtle)",
          }}
        >
          <h2
            style={{
              fontSize: "0.85rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "var(--pn-text-primary)",
              margin: 0,
            }}
          >
            Voice History
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--pn-text-tertiary)",
              fontSize: "1.1rem",
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: 4,
              transition: "color 200ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--pn-text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--pn-text-tertiary)";
            }}
          >
            &#x2715;
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: "12px 20px 8px" }}>
          <input
            type="text"
            placeholder="Search transcript..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid var(--pn-border-subtle)",
              borderRadius: 6,
              padding: "8px 12px",
              fontSize: "0.8rem",
              color: "var(--pn-text-primary)",
              outline: "none",
              transition: "border-color 200ms ease",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor =
                "var(--color-pn-primary-400)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--pn-border-subtle)";
            }}
          />
        </div>

        {/* Transcript list */}
        <div
          ref={listRef}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px 20px 20px",
          }}
        >
          {filteredTranscript.length === 0 ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                textAlign: "center",
              }}
            >
              <p
                style={{
                  color: "var(--pn-text-tertiary)",
                  fontSize: "0.8rem",
                  lineHeight: 1.6,
                }}
              >
                {search
                  ? "No matching entries."
                  : "No voice history yet. Click the orb to start."}
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredTranscript.map((entry) => (
                <HistoryEntry
                  key={entry.id}
                  entry={entry}
                  onSpeak={handleSpeak}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Entry row ──

function HistoryEntry({
  entry,
  onSpeak,
}: {
  readonly entry: TranscriptEntry;
  readonly onSpeak: (text: string) => void;
}) {
  const isUser = entry.role === "user";

  return (
    <button
      type="button"
      onClick={() => onSpeak(entry.text)}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 8,
        background: "rgba(255, 255, 255, 0.02)",
        border: "1px solid transparent",
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
        transition: "background 200ms ease, border-color 200ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
        e.currentTarget.style.borderColor = "var(--pn-border-subtle)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)";
        e.currentTarget.style.borderColor = "transparent";
      }}
    >
      {/* Role icon */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: isUser
            ? "rgba(30, 144, 255, 0.12)"
            : "rgba(0, 210, 255, 0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontSize: "0.75rem",
        }}
      >
        {isUser ? (
          // Mic icon
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(30, 144, 255, 0.8)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        ) : (
          // Orb icon (small circle)
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(0, 210, 255, 0.8)"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="4" />
          </svg>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 4,
          }}
        >
          <span
            style={{
              fontSize: "0.65rem",
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: isUser
                ? "rgba(30, 144, 255, 0.7)"
                : "rgba(0, 210, 255, 0.7)",
            }}
          >
            {isUser ? "You" : "Assistant"}
          </span>

          {entry.type === "command" && (
            <span
              style={{
                fontSize: "0.6rem",
                padding: "1px 6px",
                borderRadius: 4,
                background: "rgba(138, 43, 226, 0.15)",
                color: "rgba(138, 43, 226, 0.8)",
                fontWeight: 500,
              }}
            >
              command
            </span>
          )}

          <span
            style={{
              fontSize: "0.6rem",
              color: "var(--pn-text-muted)",
              marginLeft: "auto",
            }}
          >
            {formatRelativeTime(entry.timestamp)}
          </span>
        </div>

        <p
          style={{
            margin: 0,
            fontSize: "0.78rem",
            lineHeight: 1.5,
            color: "var(--pn-text-primary)",
            whiteSpace: "pre-wrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
          }}
        >
          {entry.text}
        </p>
      </div>
    </button>
  );
}
