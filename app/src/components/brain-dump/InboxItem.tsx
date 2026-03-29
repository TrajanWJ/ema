import { useState } from "react";
import { useBrainDumpStore } from "@/stores/brain-dump-store";
import type { InboxItem as InboxItemType } from "@/types/brain-dump";

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

interface InboxItemProps {
  readonly item: InboxItemType;
}

export function InboxItem({ item }: InboxItemProps) {
  const { process, remove } = useBrainDumpStore();
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="flex items-start justify-between gap-3 py-2 px-3 rounded-lg transition-colors"
      style={{
        background: hovered ? "rgba(255,255,255,0.03)" : "transparent",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex-1 min-w-0">
        <p
          className="text-[0.8rem] leading-relaxed break-words"
          style={{ color: "var(--pn-text-primary)" }}
        >
          {item.content}
        </p>
        <span
          className="text-[0.6rem] mt-0.5 block"
          style={{ color: "var(--pn-text-muted)" }}
        >
          {relativeTime(item.created_at)}
        </span>
      </div>

      {hovered && (
        <div className="flex gap-1 shrink-0 pt-0.5">
          <ActionBtn
            label="\u2192 Task"
            color="var(--color-pn-primary-400)"
            onClick={() => process(item.id, "task")}
          />
          <ActionBtn
            label="\u2192 Journal"
            color="var(--color-pn-tertiary-400)"
            onClick={() => process(item.id, "journal")}
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
