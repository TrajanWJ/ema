import { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { useDashboardStore } from "@/stores/dashboard-store";
import { useBrainDumpStore } from "@/stores/brain-dump-store";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

interface BrainDumpCardProps {
  readonly onNavigate?: () => void;
}

export function BrainDumpCard({ onNavigate }: BrainDumpCardProps) {
  const snapshot = useDashboardStore((s) => s.snapshot);
  const { add, process, remove } = useBrainDumpStore();
  const [input, setInput] = useState("");
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const inboxCount = snapshot?.inbox_count ?? 0;
  const items = snapshot?.recent_inbox ?? [];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    add(trimmed);
    setInput("");
  }

  return (
    <GlassCard onNavigate={onNavigate}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3
            className="text-[0.75rem] font-medium uppercase tracking-wider"
            style={{ color: "var(--pn-text-secondary)" }}
          >
            Brain Dump
          </h3>
          <Badge count={inboxCount} />
        </div>
        {onNavigate && (
          <button
            onClick={onNavigate}
            className="text-[0.75rem] opacity-40 hover:opacity-70 transition-opacity"
            style={{ color: "var(--pn-text-secondary)" }}
          >
            &rarr;
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1">
        {items.slice(0, 5).map((item) => (
          <div
            key={item.id}
            className="flex items-start justify-between gap-2 py-1 group"
            onMouseEnter={() => setHoveredId(item.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <div className="flex-1 min-w-0">
              <p
                className="text-[0.8rem] truncate"
                style={{ color: "var(--pn-text-primary)" }}
              >
                {item.content.length > 60
                  ? `${item.content.slice(0, 60)}...`
                  : item.content}
              </p>
              <span
                className="text-[0.6rem]"
                style={{ color: "var(--pn-text-muted)" }}
              >
                {relativeTime(item.created_at)}
              </span>
            </div>

            {hoveredId === item.id && (
              <div className="flex gap-1 shrink-0">
                <ActionBtn
                  label="Task"
                  color="var(--color-pn-primary-400)"
                  onClick={() => process(item.id, "task")}
                />
                <ActionBtn
                  label="Archive"
                  color="var(--pn-text-tertiary)"
                  onClick={() => process(item.id, "archive")}
                />
                <ActionBtn
                  label="\u2715"
                  color="var(--color-pn-error)"
                  onClick={() => remove(item.id)}
                />
              </div>
            )}
          </div>
        ))}

        {items.length === 0 && (
          <span
            className="text-[0.75rem] py-2"
            style={{ color: "var(--pn-text-muted)" }}
          >
            Inbox is clear
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-2 flex gap-1.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Quick capture..."
          className="flex-1 text-[0.75rem] px-2 py-1 rounded-lg outline-none"
          style={{
            background: "var(--pn-surface-3)",
            color: "var(--pn-text-primary)",
            border: "1px solid var(--pn-border-default)",
          }}
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="text-[0.7rem] px-2 py-1 rounded-lg transition-opacity disabled:opacity-30"
          style={{
            background: "var(--color-pn-primary-400)",
            color: "#fff",
          }}
        >
          +
        </button>
      </form>
    </GlassCard>
  );
}

function ActionBtn({
  label,
  color,
  onClick,
}: {
  readonly label: string;
  readonly color: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-[0.6rem] px-1.5 py-0.5 rounded transition-opacity hover:opacity-80"
      style={{ color, border: `1px solid ${color}` }}
    >
      {label}
    </button>
  );
}
