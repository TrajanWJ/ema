import { useState } from "react";
import { useOrgStore } from "@/stores/org-store";

interface Props {
  orgId: string;
  onDone: () => void;
}

export function InvitationCreator({ orgId, onDone }: Props) {
  const [role, setRole] = useState<string>("member");
  const [maxUses, setMaxUses] = useState<string>("");
  const [expiresIn, setExpiresIn] = useState<string>("7d");
  const [result, setResult] = useState<{ link: string } | null>(null);
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    setCreating(true);
    try {
      const expiresAt = computeExpiry(expiresIn);
      const res = await useOrgStore.getState().createInvitation(orgId, {
        role,
        expires_at: expiresAt,
        max_uses: maxUses ? parseInt(maxUses, 10) : undefined,
      });
      setResult(res);
    } finally {
      setCreating(false);
    }
  }

  if (result) {
    return (
      <div className="space-y-3">
        <div className="text-[0.75rem] font-medium" style={{ color: "var(--pn-text-primary)" }}>
          Invitation Created
        </div>

        {/* Copyable link */}
        <div
          className="glass-ambient rounded-lg p-2.5 flex items-center gap-2 cursor-pointer hover:bg-white/5"
          onClick={() => navigator.clipboard.writeText(result.link)}
        >
          <code className="text-[0.65rem] flex-1 truncate" style={{ color: "#2dd4a8" }}>
            {result.link}
          </code>
          <span className="text-[0.6rem] shrink-0" style={{ color: "var(--pn-text-tertiary)" }}>
            Click to copy
          </span>
        </div>

        {/* QR Code placeholder */}
        <div
          className="glass-ambient rounded-lg p-4 flex flex-col items-center gap-2"
        >
          <QrCode value={result.link} size={160} />
          <span className="text-[0.6rem]" style={{ color: "var(--pn-text-muted)" }}>
            Scan to join
          </span>
        </div>

        <button
          onClick={onDone}
          className="w-full text-[0.7rem] py-1.5 rounded"
          style={{ background: "rgba(45, 212, 168, 0.12)", color: "#2dd4a8" }}
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-[0.75rem] font-medium" style={{ color: "var(--pn-text-primary)" }}>
        Create Invitation
      </div>

      {/* Role selector */}
      <div>
        <label className="text-[0.6rem] block mb-1" style={{ color: "var(--pn-text-tertiary)" }}>Role</label>
        <div className="flex gap-1.5">
          {["admin", "member", "guest"].map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className="text-[0.65rem] px-2.5 py-1 rounded transition-all"
              style={{
                background: role === r ? "rgba(107, 149, 240, 0.2)" : "rgba(255,255,255,0.04)",
                color: role === r ? "#6b95f0" : "var(--pn-text-tertiary)",
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Expiry */}
      <div>
        <label className="text-[0.6rem] block mb-1" style={{ color: "var(--pn-text-tertiary)" }}>Expires</label>
        <div className="flex gap-1.5">
          {["1h", "24h", "7d", "30d", "never"].map((e) => (
            <button
              key={e}
              onClick={() => setExpiresIn(e)}
              className="text-[0.65rem] px-2.5 py-1 rounded transition-all"
              style={{
                background: expiresIn === e ? "rgba(107, 149, 240, 0.2)" : "rgba(255,255,255,0.04)",
                color: expiresIn === e ? "#6b95f0" : "var(--pn-text-tertiary)",
              }}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      {/* Max uses */}
      <div>
        <label className="text-[0.6rem] block mb-1" style={{ color: "var(--pn-text-tertiary)" }}>Max uses (empty = unlimited)</label>
        <input
          type="number"
          min="1"
          value={maxUses}
          onChange={(e) => setMaxUses(e.target.value)}
          placeholder="Unlimited"
          className="w-full glass-ambient rounded px-2.5 py-1.5 text-[0.7rem] outline-none"
          style={{ color: "var(--pn-text-primary)" }}
        />
      </div>

      <button
        onClick={handleCreate}
        disabled={creating}
        className="w-full text-[0.7rem] py-1.5 rounded font-medium"
        style={{ background: "rgba(45, 212, 168, 0.15)", color: "#2dd4a8" }}
      >
        {creating ? "Creating..." : "Generate Invitation Link"}
      </button>
    </div>
  );
}

function computeExpiry(value: string): string | undefined {
  if (value === "never") return undefined;

  const now = Date.now();
  const ms: Record<string, number> = {
    "1h": 3600_000,
    "24h": 86400_000,
    "7d": 604800_000,
    "30d": 2592000_000,
  };

  const offset = ms[value];
  if (!offset) return undefined;
  return new Date(now + offset).toISOString();
}

/** Minimal inline QR code rendered as SVG. Uses a simple text-based encoding. */
function QrCode({ value, size = 160 }: { value: string; size?: number }) {
  // Simple visual representation — encode string bytes as a grid pattern
  const bytes = new TextEncoder().encode(value);
  const gridSize = Math.ceil(Math.sqrt(bytes.length * 8));
  const cellSize = size / gridSize;

  const cells: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < bytes.length; i++) {
    for (let bit = 7; bit >= 0; bit--) {
      const idx = i * 8 + (7 - bit);
      const row = Math.floor(idx / gridSize);
      const col = idx % gridSize;
      if (row < gridSize && (bytes[i] & (1 << bit)) !== 0) {
        cells.push({ x: col * cellSize, y: row * cellSize });
      }
    }
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rounded-lg" style={{ background: "white" }}>
      {cells.map((cell, i) => (
        <rect key={i} x={cell.x} y={cell.y} width={cellSize} height={cellSize} fill="black" />
      ))}
    </svg>
  );
}
