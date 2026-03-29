import { useBrainDumpStore } from "@/stores/brain-dump-store";
import { InboxItem } from "./InboxItem";

export function InboxQueue() {
  const items = useBrainDumpStore((s) => s.items);

  const unprocessed = items
    .filter((item) => !item.processed)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

  if (unprocessed.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <span className="text-[2rem] opacity-30">\u2728</span>
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
    <div className="flex flex-col gap-0.5">
      {unprocessed.map((item, i) => (
        <div
          key={item.id}
          style={{
            animation: `fadeSlideIn 200ms ${i * 30}ms both`,
          }}
        >
          <InboxItem item={item} />
        </div>
      ))}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
