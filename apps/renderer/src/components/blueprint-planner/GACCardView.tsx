// Single GAC card renderer — grid of [A][B][C][D] option buttons + [1][2] defer/skip row.
// Matches the Blueprint canon spec mock exactly.

import { useState } from "react";
import type { GACCard, GACOption } from "./BlueprintPlannerApp";

interface Props {
  card: GACCard;
  index: number;
  total: number;
  accent: string;
  onAnswer: (id: string, option: string) => Promise<void>;
}

const PRIORITY_COLOR: Record<string, string> = {
  critical: "var(--color-pn-error, #E24B4A)",
  high: "var(--color-pn-warning, #EAB308)",
  medium: "var(--color-pn-info, #3B82F6)",
  low: "var(--pn-text-tertiary)",
};

export function GACCardView({ card, index, total, accent, onAnswer }: Props) {
  const [submitting, setSubmitting] = useState<string | null>(null);

  async function handleClick(option: string) {
    setSubmitting(option);
    try {
      await onAnswer(card.id, option);
    } finally {
      setSubmitting(null);
    }
  }

  const letterOpts = card.parsed.options.filter((o) => /^[A-Z]$/.test(o.label));
  const numericOpts = card.parsed.options.filter((o) => /^\d$/.test(o.label));

  return (
    <div
      className="rounded-xl p-6"
      style={{
        background: "rgba(20, 23, 33, 0.55)",
        border: "1px solid var(--pn-border-surface)",
        backdropFilter: "blur(20px) saturate(130%)",
        WebkitBackdropFilter: "blur(20px) saturate(130%)",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25)",
      }}
    >
      <div className="flex items-center gap-3 text-[0.55rem] font-mono uppercase tracking-wider mb-2">
        <span style={{ color: accent, fontWeight: 600 }}>{card.category}</span>
        <span
          style={{
            color: PRIORITY_COLOR[card.priority] || "var(--pn-text-tertiary)",
            fontWeight: 600,
          }}
        >
          ● {card.priority} priority
        </span>
        <span className="ml-auto" style={{ color: "var(--pn-text-muted)" }}>
          Card {index + 1} of {total}
        </span>
      </div>

      <div
        className="text-[0.6rem] font-mono mb-1"
        style={{ color: "var(--pn-text-muted)" }}
      >
        {card.id}
      </div>
      <h2
        className="text-[1.05rem] font-semibold mb-3 leading-tight"
        style={{ color: "var(--pn-text-primary)" }}
      >
        {card.title.replace(/^"|"$/g, "")}
      </h2>

      {card.parsed.context && (
        <div
          className="text-[0.7rem] mb-4 p-3 rounded"
          style={{
            background: "rgba(14, 16, 23, 0.55)",
            borderLeft: `2px solid ${accent}`,
            color: "var(--pn-text-secondary)",
          }}
        >
          {card.parsed.context.split("\n\n")[0]}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        {letterOpts.map((opt) => (
          <OptionButton
            key={opt.label}
            opt={opt}
            submitting={submitting === opt.label}
            disabled={submitting !== null}
            onClick={() => handleClick(opt.label)}
            variant="letter"
            accent={accent}
          />
        ))}
      </div>
      {numericOpts.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5 mt-2.5">
          {numericOpts.map((opt) => (
            <OptionButton
              key={opt.label}
              opt={opt}
              submitting={submitting === opt.label}
              disabled={submitting !== null}
              onClick={() => handleClick(opt.label)}
              variant={opt.label === "1" ? "defer" : "skip"}
              accent={accent}
            />
          ))}
        </div>
      )}

      {card.parsed.recommendation && (
        <div
          className="mt-4 p-3 rounded text-[0.7rem]"
          style={{
            background: "rgba(45, 212, 168, 0.06)",
            border: "1px solid rgba(45, 212, 168, 0.2)",
            color: "var(--pn-text-secondary)",
          }}
        >
          <strong style={{ color: accent }}>Recommendation:</strong>{" "}
          {card.parsed.recommendation.split("\n\n")[0]}
        </div>
      )}
    </div>
  );
}

function OptionButton({
  opt,
  submitting,
  disabled,
  onClick,
  variant,
  accent,
}: {
  opt: GACOption;
  submitting: boolean;
  disabled: boolean;
  onClick: () => void;
  variant: "letter" | "defer" | "skip";
  accent: string;
}) {
  const labelStyle =
    variant === "defer"
      ? {
          background: "rgba(234, 179, 8, 0.12)",
          borderColor: "rgba(234, 179, 8, 0.3)",
          color: "var(--color-pn-warning, #EAB308)",
        }
      : variant === "skip"
      ? {
          background: "rgba(255,255,255,0.04)",
          borderColor: "rgba(255,255,255,0.14)",
          color: "var(--pn-text-tertiary)",
        }
      : {
          background: "rgba(45, 212, 168, 0.15)",
          borderColor: "rgba(45, 212, 168, 0.35)",
          color: accent,
        };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-start gap-3 p-3.5 rounded-lg text-left transition-all"
      style={{
        background: "rgba(10, 12, 20, 0.5)",
        border: "1px solid var(--pn-border-surface)",
        color: "var(--pn-text-primary)",
        cursor: disabled ? "wait" : "pointer",
        minHeight: "62px",
        opacity: submitting ? 0.5 : disabled ? 0.7 : 1,
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.background = "rgba(20, 23, 33, 0.75)";
        e.currentTarget.style.borderColor = "rgba(45, 212, 168, 0.3)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(10, 12, 20, 0.5)";
        e.currentTarget.style.borderColor = "var(--pn-border-surface)";
      }}
    >
      <span
        className="inline-flex items-center justify-center w-6 h-6 rounded-md font-mono text-[0.65rem] font-bold border flex-shrink-0"
        style={labelStyle}
      >
        {submitting ? "…" : opt.label}
      </span>
      <div className="flex-1 min-w-0">
        <div
          className="text-[0.7rem] font-semibold mb-0.5 leading-snug"
          style={{ color: "var(--pn-text-primary)" }}
        >
          {opt.title}
        </div>
        <div
          className="text-[0.65rem] leading-relaxed"
          style={{ color: "var(--pn-text-secondary)" }}
        >
          {opt.description}
        </div>
      </div>
    </button>
  );
}
