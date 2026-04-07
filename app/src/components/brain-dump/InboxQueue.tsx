import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useBrainDumpStore } from "@/stores/brain-dump-store";
import { InboxItem } from "./InboxItem";

export function InboxQueue() {
  const items = useBrainDumpStore((s) => s.items);
  const parentRef = useRef<HTMLDivElement>(null);

  const unprocessed = items
    .filter((item) => !item.processed)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

  const virtualizer = useVirtualizer({
    count: unprocessed.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 8,
  });

  if (unprocessed.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <span className="text-[2rem] opacity-30">~</span>
        <span
          className="text-[0.8rem]"
          style={{ color: "var(--pn-text-muted)" }}
        >
          Your mind is clear
        </span>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="flex-1 overflow-auto"
      style={{ minHeight: 0 }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = unprocessed[virtualRow.index];
          return (
            <div
              key={item.id}
              ref={virtualizer.measureElement}
              data-index={virtualRow.index}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <InboxItem item={item} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
