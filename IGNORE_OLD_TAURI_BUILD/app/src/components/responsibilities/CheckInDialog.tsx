import { useState } from "react";
import { useResponsibilitiesStore } from "@/stores/responsibilities-store";
import type { CheckIn } from "@/types/responsibilities";

const STATUS_OPTIONS: readonly { value: CheckIn["status"]; label: string; color: string }[] = [
  { value: "healthy", label: "Healthy", color: "#22c55e" },
  { value: "at_risk", label: "At Risk", color: "#f59e0b" },
  { value: "failing", label: "Failing", color: "#ef4444" },
];

interface CheckInDialogProps {
  readonly responsibilityId: string;
  readonly onClose: () => void;
}

export function CheckInDialog({ responsibilityId, onClose }: CheckInDialogProps) {
  const [status, setStatus] = useState<CheckIn["status"]>("healthy");
  const [note, setNote] = useState("");
  const checkIn = useResponsibilitiesStore((s) => s.checkIn);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await checkIn(responsibilityId, status, note || undefined);
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 pt-3" style={{ borderTop: "1px solid var(--pn-border-subtle)" }}>
      <div className="flex gap-1 mb-2">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setStatus(opt.value)}
            className="text-[0.65rem] px-2 py-1 rounded-md transition-colors"
            style={{
              background: status === opt.value ? opt.color : "rgba(255, 255, 255, 0.03)",
              color: status === opt.value ? "#fff" : "var(--pn-text-tertiary)",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note..."
        rows={2}
        className="w-full text-[0.75rem] px-2 py-1.5 rounded-md outline-none resize-none mb-2"
        style={{
          background: "var(--pn-surface-3)",
          color: "var(--pn-text-primary)",
          border: "1px solid var(--pn-border-default)",
        }}
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="text-[0.65rem] px-2 py-1 rounded-md"
          style={{ color: "var(--pn-text-tertiary)" }}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="text-[0.65rem] px-3 py-1 rounded-md font-medium"
          style={{ background: "var(--color-pn-primary-400)", color: "#fff" }}
        >
          Save
        </button>
      </div>
    </form>
  );
}
