import { useEffect, useState, useRef, memo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { api } from "@/lib/api";

interface PipeRun {
  readonly id: string;
  readonly pipe_id: string;
  readonly pipe_name: string;
  readonly trigger_pattern: string;
  readonly status: "success" | "error" | "skipped";
  readonly duration_ms: number | null;
  readonly error: string | null;
  readonly inserted_at: string;
}

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  success: { bg: "rgba(34,197,94,0.1)", color: "#22c55e" },
  error: { bg: "rgba(239,68,68,0.1)", color: "#ef4444" },
  skipped: { bg: "rgba(245,158,11,0.1)", color: "#f59e0b" },
};

export function HistoryTab() {
  const [runs, setRuns] = useState<readonly PipeRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await api.get<{ runs: PipeRun[] }>("/pipes/history");
        if (!cancelled) setRuns(data.runs);
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Failed to load history",
          );
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const virtualizer = useVirtualizer({
    count: runs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 8,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span
          className="text-[0.8rem]"
          style={{ color: "var(--pn-text-secondary)" }}
        >
          Loading history...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="mb-3 px-3 py-2 rounded-lg text-[0.7rem]"
        style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}
      >
        {error}
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <span
          className="text-[0.75rem]"
          style={{ color: "var(--pn-text-muted)" }}
        >
          No pipe executions yet
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
          const run = runs[virtualRow.index];
          return (
            <div
              key={run.id}
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
              <PipeRunRow run={run} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

const PipeRunRow = memo(function PipeRunRow({
  run,
}: {
  readonly run: PipeRun;
}) {
  const style = STATUS_STYLES[run.status] ?? STATUS_STYLES.skipped;
  return (
    <div className="glass-surface rounded-lg p-3 mb-2">
      <div className="flex items-center gap-2 mb-1">
        <span
          className="text-[0.75rem] font-medium flex-1 truncate"
          style={{ color: "var(--pn-text-primary)" }}
        >
          {run.pipe_name}
        </span>
        <span
          className="shrink-0 text-[0.55rem] px-1.5 py-0.5 rounded"
          style={{ background: style.bg, color: style.color }}
        >
          {run.status}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span
          className="text-[0.55rem] px-1.5 py-0.5 rounded-full"
          style={{
            background: "rgba(107,149,240,0.1)",
            color: "#6b95f0",
          }}
        >
          {run.trigger_pattern}
        </span>
        {run.duration_ms != null && (
          <span
            className="text-[0.55rem]"
            style={{ color: "var(--pn-text-tertiary)" }}
          >
            {run.duration_ms}ms
          </span>
        )}
        <span
          className="text-[0.55rem] ml-auto"
          style={{ color: "var(--pn-text-muted)" }}
        >
          {new Date(run.inserted_at).toLocaleString()}
        </span>
      </div>
      {run.error && (
        <p
          className="text-[0.6rem] mt-2 px-2 py-1.5 rounded"
          style={{
            background: "rgba(239,68,68,0.06)",
            color: "#ef4444",
          }}
        >
          {run.error}
        </p>
      )}
    </div>
  );
});
