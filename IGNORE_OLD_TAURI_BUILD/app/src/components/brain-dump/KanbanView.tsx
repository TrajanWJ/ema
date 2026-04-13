import { useState } from "react";
import { useBrainDumpStore } from "@/stores/brain-dump-store";
import type { InboxItem } from "@/types/brain-dump";

type Column = "inbox" | "processing" | "done";

const COLUMNS: readonly { id: Column; label: string }[] = [
  { id: "inbox", label: "INBOX" },
  { id: "processing", label: "PROCESSING" },
  { id: "done", label: "DONE" },
];

function classifyItem(item: InboxItem): Column {
  if (item.processed) return "done";
  if (item.action === "processing") return "processing";
  return "inbox";
}

function columnActionFor(col: Column): InboxItem["action"] {
  if (col === "processing") return "processing";
  if (col === "done") return "archive";
  return null;
}

export function KanbanView() {
  const items = useBrainDumpStore((s) => s.items);
  const { process } = useBrainDumpStore();
  const [dragId, setDragId] = useState<string | null>(null);

  const grouped: Record<Column, InboxItem[]> = {
    inbox: [],
    processing: [],
    done: [],
  };

  for (const item of items) {
    grouped[classifyItem(item)].push(item);
  }

  function handleDragStart(id: string) {
    setDragId(id);
  }

  function handleDrop(targetCol: Column) {
    if (!dragId) return;
    const action = columnActionFor(targetCol);
    if (action !== null) {
      process(dragId, action);
    }
    setDragId(null);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  return (
    <div className="grid grid-cols-3 gap-3 h-full">
      {COLUMNS.map((col) => (
        <div
          key={col.id}
          className="flex flex-col rounded-lg p-2"
          style={{ background: "rgba(255,255,255,0.02)" }}
          onDragOver={handleDragOver}
          onDrop={() => handleDrop(col.id)}
        >
          <div className="flex items-center gap-2 mb-2 px-1">
            <span
              className="text-[0.65rem] font-semibold uppercase tracking-wider"
              style={{ color: "var(--pn-text-tertiary)" }}
            >
              {col.label}
            </span>
            <span
              className="text-[0.6rem]"
              style={{ color: "var(--pn-text-muted)" }}
            >
              {grouped[col.id].length}
            </span>
          </div>

          <div className="flex-1 flex flex-col gap-1 overflow-auto">
            {grouped[col.id].map((item) => (
              <div
                key={item.id}
                draggable
                onDragStart={() => handleDragStart(item.id)}
                className="glass-surface rounded-lg p-2 cursor-grab active:cursor-grabbing transition-opacity"
                style={{
                  opacity: dragId === item.id ? 0.4 : 1,
                }}
              >
                <p
                  className="text-[0.75rem] leading-snug"
                  style={{ color: "var(--pn-text-primary)" }}
                >
                  {item.content.length > 80
                    ? `${item.content.slice(0, 80)}...`
                    : item.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
