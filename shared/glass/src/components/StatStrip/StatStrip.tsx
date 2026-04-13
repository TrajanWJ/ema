import { MetricCard } from "../MetricCard/MetricCard.tsx";

export interface StatStripItem {
  readonly label: string;
  readonly value: string;
  readonly detail?: string;
  readonly tone?: string;
}

interface StatStripProps {
  readonly items: readonly StatStripItem[];
}

export function StatStrip({ items }: StatStripProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "var(--pn-space-3)",
      }}
    >
      {items.map((item) => (
        <MetricCard
          key={`${item.label}-${item.value}`}
          label={item.label}
          value={item.value}
          detail={item.detail}
          tone={item.tone}
        />
      ))}
    </div>
  );
}
