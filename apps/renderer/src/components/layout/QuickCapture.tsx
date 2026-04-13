import { useEffect, useMemo, useRef, useState } from "react";

import { useBrainDumpStore } from "@/stores/brain-dump-store";
import { useHumanOpsStore } from "@/stores/human-ops-store";
import { useNotificationStore } from "@/stores/notification-store";
import { useTasksStore } from "@/stores/tasks-store";

type QuickCaptureTarget = "inbox" | "task" | "daily_note";

interface QuickCaptureProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

function todayKey(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function QuickCapture({ isOpen, onClose }: QuickCaptureProps) {
  const [content, setContent] = useState("");
  const [target, setTarget] = useState<QuickCaptureTarget>("inbox");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pushToast = useNotificationStore((state) => state.push);
  const humanOpsDays = useHumanOpsStore((state) => state.days);
  const loadBrief = useHumanOpsStore((state) => state.loadBrief);
  const loadDay = useHumanOpsStore((state) => state.loadDay);
  const setPlan = useHumanOpsStore((state) => state.setPlan);

  useEffect(() => {
    if (!isOpen) return;
    const id = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setContent("");
    setTarget("inbox");
  }, [isOpen]);

  const helperLabel = useMemo(() => {
    if (target === "task") return "Create a real task immediately.";
    if (target === "daily_note") return "Append to today’s Human Ops note.";
    return "Capture loose input into Brain Dump.";
  }, [target]);

  async function submit(): Promise<void> {
    const trimmed = content.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    const today = todayKey();

    try {
      if (target === "task") {
        await useTasksStore.getState().createTask({
          title: trimmed,
          status: "todo",
          priority: 2,
          source_type: "quick_capture",
        });
        await useTasksStore.getState().loadViaRest().catch(() => undefined);
        pushToast("Task captured", "success");
      } else if (target === "daily_note") {
        await loadDay(today).catch(() => undefined);
        const existingPlan = useHumanOpsStore.getState().days[today]?.plan ?? humanOpsDays[today]?.plan ?? "";
        const nextPlan = existingPlan.trim().length > 0 ? `${existingPlan.trimEnd()}\n\n- ${trimmed}` : `- ${trimmed}`;
        await setPlan(today, nextPlan);
        pushToast("Added to today’s note", "success");
      } else {
        await useBrainDumpStore.getState().add(trimmed, "text");
        await useBrainDumpStore.getState().loadViaRest().catch(() => undefined);
        pushToast("Captured to Brain Dump", "success");
      }

      await loadBrief(today).catch(() => undefined);
      setContent("");
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "capture_failed";
      pushToast(`Capture failed: ${message}`, "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center pt-[14vh]"
      style={{
        background: "rgba(6, 6, 16, 0.64)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="w-full max-w-2xl overflow-hidden rounded-2xl"
        style={{
          background: "rgba(14, 16, 23, 0.94)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.62)",
        }}
      >
        <div
          className="flex items-center justify-between gap-3 px-4 py-3"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div>
            <div className="text-[0.65rem] uppercase tracking-[0.18em]" style={{ color: "var(--pn-text-muted)" }}>
              Human Ops
            </div>
            <div className="text-[0.95rem] font-semibold" style={{ color: "var(--pn-text-primary)" }}>
              Quick Capture
            </div>
          </div>
          <div className="text-[0.65rem]" style={{ color: "var(--pn-text-muted)" }}>
            Ctrl+Shift+Space
          </div>
        </div>

        <div className="flex flex-wrap gap-2 px-4 pt-4">
          {([
            { id: "inbox", label: "Brain Dump" },
            { id: "task", label: "Task" },
            { id: "daily_note", label: "Today Note" },
          ] as const).map((option) => {
            const active = target === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setTarget(option.id)}
                className="rounded-full px-3 py-1.5 text-[0.7rem] font-medium transition-all"
                style={{
                  background: active ? "rgba(107,149,240,0.18)" : "rgba(255,255,255,0.04)",
                  color: active ? "#dbe7ff" : "var(--pn-text-secondary)",
                  border: active ? "1px solid rgba(107,149,240,0.34)" : "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="px-4 pb-4 pt-3">
          <div className="mb-2 text-[0.72rem]" style={{ color: "var(--pn-text-secondary)" }}>
            {helperLabel}
          </div>
          <textarea
            ref={inputRef}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                onClose();
              }
              if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                event.preventDefault();
                void submit();
              }
            }}
            placeholder="Capture the thought before it fragments."
            className="min-h-[180px] w-full rounded-xl px-4 py-3 text-[0.82rem] outline-none"
            style={{
              background: "var(--pn-surface-3)",
              color: "var(--pn-text-primary)",
              border: "1px solid var(--pn-border-default)",
            }}
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="text-[0.68rem]" style={{ color: "var(--pn-text-muted)" }}>
              Enter a real task only when the thought is already clarified. Otherwise, let Brain Dump hold the ambiguity.
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-3 py-1.5 text-[0.7rem] font-medium"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  color: "var(--pn-text-secondary)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                Close
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md px-3 py-1.5 text-[0.7rem] font-medium disabled:opacity-60"
                style={{
                  background: "rgba(107,149,240,0.18)",
                  color: "#dbe7ff",
                  border: "1px solid rgba(107,149,240,0.34)",
                }}
              >
                {submitting ? "Capturing…" : "Capture"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
