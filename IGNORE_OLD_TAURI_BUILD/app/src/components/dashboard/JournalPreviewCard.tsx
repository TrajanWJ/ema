import { GlassCard } from "@/components/ui/GlassCard";
import { useDashboardStore } from "@/stores/dashboard-store";

interface JournalPreviewCardProps {
  readonly onNavigate?: () => void;
}

export function JournalPreviewCard({ onNavigate }: JournalPreviewCardProps) {
  const journal = useDashboardStore((s) => s.snapshot?.journal ?? null);

  const content = journal?.content ?? "";
  const oneThing = journal?.one_thing ?? null;
  const hasContent = content.trim().length > 0;

  return (
    <GlassCard title="Journal" onNavigate={onNavigate}>
      {oneThing && (
        <p
          className="text-[0.7rem] mb-2 font-medium"
          style={{ color: "var(--color-pn-tertiary-400)" }}
        >
          \u25C9 {oneThing}
        </p>
      )}

      <p
        className="text-[0.8rem] leading-relaxed"
        style={{
          color: hasContent
            ? "var(--pn-text-primary)"
            : "var(--pn-text-muted)",
        }}
      >
        {hasContent
          ? content.length > 150
            ? `${content.slice(0, 150)}...`
            : content
          : "Start writing..."}
      </p>
    </GlassCard>
  );
}
