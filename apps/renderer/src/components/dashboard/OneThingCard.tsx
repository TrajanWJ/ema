import { useState, useRef } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { useDashboardStore } from "@/stores/dashboard-store";
import { useJournalStore } from "@/stores/journal-store";

export function OneThingCard() {
  const snapshot = useDashboardStore((s) => s.snapshot);
  const updateField = useJournalStore((s) => s.updateField);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const oneThing = snapshot?.journal?.one_thing ?? null;

  function startEditing() {
    setDraft(oneThing ?? "");
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    updateField("one_thing", trimmed || null);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") setEditing(false);
  }

  return (
    <GlassCard className="relative overflow-hidden">
      <div
        className="absolute left-0 top-0 bottom-0"
        style={{
          width: "2px",
          background: "var(--color-pn-tertiary-400)",
        }}
      />
      <div className="pl-3">
        <span
          className="text-[0.65rem] font-semibold uppercase tracking-wider"
          style={{ color: "var(--pn-text-tertiary)" }}
        >
          One Thing
        </span>

        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            className="block w-full mt-1 bg-transparent outline-none font-medium"
            style={{
              fontSize: "1.1rem",
              color: "var(--pn-text-primary)",
            }}
            placeholder="What's the #1 priority today?"
          />
        ) : (
          <p
            onClick={startEditing}
            className="mt-1 cursor-pointer font-medium"
            style={{
              fontSize: "1.1rem",
              color: oneThing
                ? "var(--pn-text-primary)"
                : "var(--pn-text-muted)",
            }}
          >
            {oneThing ?? "What's the #1 priority today?"}
          </p>
        )}
      </div>
    </GlassCard>
  );
}
