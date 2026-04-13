import { useState } from "react";
import { useOrgStore } from "@/stores/org-store";

interface Props {
  onBack: () => void;
  onJoined: () => void;
}

export function JoinFlow({ onBack, onJoined }: Props) {
  const [token, setToken] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [preview, setPreview] = useState<{
    org_name: string;
    org_description: string | null;
    role: string;
    expires_at: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function extractToken(input: string): string {
    // Handle ema://join/TOKEN format
    const match = input.match(/ema:\/\/join\/([a-f0-9]+)/i);
    return match ? match[1] : input.trim();
  }

  async function handlePreview() {
    setError(null);
    setLoading(true);
    try {
      const cleanToken = extractToken(token);
      const data = await useOrgStore.getState().previewInvitation(cleanToken);
      setPreview(data);
    } catch {
      setError("Invalid or expired invitation");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    setError(null);
    setLoading(true);
    try {
      const cleanToken = extractToken(token);
      await useOrgStore.getState().joinViaToken(cleanToken, {
        display_name: displayName.trim() || "New Member",
      });
      onJoined();
    } catch {
      setError("Failed to join — token may be expired or used up");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          onClick={onBack}
          className="text-[0.7rem] px-2 py-0.5 rounded hover:bg-white/5"
          style={{ color: "var(--pn-text-tertiary)" }}
        >
          &larr; Back
        </button>
        <h2 className="text-[0.85rem] font-semibold" style={{ color: "var(--pn-text-primary)" }}>
          Join Organization
        </h2>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg text-[0.7rem]" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
          {error}
        </div>
      )}

      {!preview ? (
        <>
          <div>
            <label className="text-[0.6rem] block mb-1" style={{ color: "var(--pn-text-tertiary)" }}>
              Invitation link or token
            </label>
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full glass-ambient rounded px-2.5 py-1.5 text-[0.75rem] outline-none font-mono"
              style={{ color: "var(--pn-text-primary)" }}
              placeholder="ema://join/abc123... or paste token"
              autoFocus
            />
          </div>

          <button
            onClick={handlePreview}
            disabled={loading || !token.trim()}
            className="w-full text-[0.75rem] py-2 rounded font-medium transition-all disabled:opacity-40"
            style={{ background: "rgba(107, 149, 240, 0.15)", color: "#6b95f0" }}
          >
            {loading ? "Checking..." : "Preview Invitation"}
          </button>
        </>
      ) : (
        <>
          {/* Invitation preview */}
          <div className="glass-surface rounded-lg p-4 space-y-2">
            <div className="text-[0.85rem] font-semibold" style={{ color: "var(--pn-text-primary)" }}>
              {preview.org_name}
            </div>
            {preview.org_description && (
              <p className="text-[0.7rem]" style={{ color: "var(--pn-text-tertiary)" }}>
                {preview.org_description}
              </p>
            )}
            <div className="flex items-center gap-2 text-[0.65rem]" style={{ color: "var(--pn-text-secondary)" }}>
              <span>You&apos;ll join as <strong>{preview.role}</strong></span>
              {preview.expires_at && (
                <span>&middot; Expires {new Date(preview.expires_at).toLocaleDateString()}</span>
              )}
            </div>
          </div>

          <div>
            <label className="text-[0.6rem] block mb-1" style={{ color: "var(--pn-text-tertiary)" }}>
              Your display name
            </label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full glass-ambient rounded px-2.5 py-1.5 text-[0.75rem] outline-none"
              style={{ color: "var(--pn-text-primary)" }}
              placeholder="Your name"
              autoFocus
            />
          </div>

          <button
            onClick={handleJoin}
            disabled={loading}
            className="w-full text-[0.75rem] py-2 rounded font-medium transition-all disabled:opacity-40"
            style={{ background: "rgba(45, 212, 168, 0.15)", color: "#2dd4a8" }}
          >
            {loading ? "Joining..." : "Join Organization"}
          </button>
        </>
      )}
    </div>
  );
}
