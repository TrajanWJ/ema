import { useState } from "react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { CaptureInput } from "./CaptureInput";
import { InboxQueue } from "./InboxQueue";
import { KanbanView } from "./KanbanView";

type View = "queue" | "board";

const VIEW_OPTIONS = [
  { value: "queue" as const, label: "Queue" },
  { value: "board" as const, label: "Board" },
];

export function BrainDumpPage() {
  const [view, setView] = useState<View>("queue");

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h2
          className="text-[0.9rem] font-semibold"
          style={{ color: "var(--pn-text-primary)" }}
        >
          Brain Dump
        </h2>
        <SegmentedControl options={VIEW_OPTIONS} value={view} onChange={setView} />
      </div>

      <CaptureInput />

      <div className="flex-1 min-h-0 overflow-auto">
        {view === "queue" ? <InboxQueue /> : <KanbanView />}
      </div>
    </div>
  );
}
