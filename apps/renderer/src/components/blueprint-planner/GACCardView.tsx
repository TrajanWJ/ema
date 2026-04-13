import { useState } from "react";

import type { GACCard, GACOption } from "./BlueprintPlannerApp";

interface Props {
  readonly card: GACCard;
  readonly index: number;
  readonly total: number;
  readonly accent: string;
  readonly onAnswer: (id: string, option: string) => Promise<void>;
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

  const letterOpts = card.options.filter((option) => /^[A-Z]$/.test(option.label));
  const numericOpts = card.options.filter((option) => /^\d$/.test(option.label));

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
      <div className="mb-2 flex items-center gap-3 text-[0.55rem] font-mono uppercase tracking-wider">
        <span style={{ color: accent, fontWeight: 600 }}>{card.category}</span>
        <span style={{ color: PRIORITY_COLOR[card.priority] || "var(--pn-text-tertiary)", fontWeight: 600 }}>
          ● {card.priority} priority
        </span>
        <span className="ml-auto" style={{ color: "var(--pn-text-muted)" }}>
          Card {index + 1} of {total}
        </span>
      </div>

      <div className="mb-1 text-[0.6rem] font-mono" style={{ color: "var(--pn-text-muted)" }}>
        {card.id}
      </div>
      <h2 className="mb-3 text-[1.05rem] font-semibold leading-tight" style={{ color: "var(--pn-text-primary)" }}>
        {card.title.replace(/^"|"$/g, "")}
      </h2>

      {card.context?.section ? (
        <div
          className="mb-4 rounded p-3 text-[0.7rem]"
          style={{
            background: "rgba(14, 16, 23, 0.55)",
            borderLeft: `2px solid ${accent}`,
            color: "var(--pn-text-secondary)",
          }}
        >
          {card.context.section}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2.5">
        {letterOpts.map((option) => (
          <OptionButton
            key={option.label}
            opt={option}
            submitting={submitting === option.label}
            disabled={submitting !== null}
            onClick={() => handleClick(option.label)}
            variant="letter"
            accent={accent}
          />
        ))}
      </div>

      {numericOpts.length > 0 ? (
        <div className="mt-2.5 grid grid-cols-2 gap-2.5">
          {numericOpts.map((option) => (
            <OptionButton
              key={option.label}
              opt={option}
              submitting={submitting === option.label}
              disabled={submitting !== null}
              onClick={() => handleClick(option.label)}
              variant={option.label === "1" ? "defer" : "skip"}
              accent={accent}
            />
          ))}
        </div>
      ) : null}
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
  readonly opt: GACOption;
  readonly submitting: boolean;
  readonly disabled: boolean;
  readonly onClick: () => void;
  readonly variant: "letter" | "defer" | "skip";
  readonly accent: string;
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
      className="flex min-h-[62px] items-start gap-3 rounded-lg p-3.5 text-left transition-all"
      style={{
        background: "rgba(10, 12, 20, 0.5)",
        border: "1px solid var(--pn-border-surface)",
        color: "var(--pn-text-primary)",
        cursor: disabled ? "wait" : "pointer",
        opacity: submitting ? 0.5 : disabled ? 0.7 : 1,
      }}
    >
      <span
        className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border font-mono text-[0.65rem] font-bold"
        style={labelStyle}
      >
        {submitting ? "…" : opt.label}
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 text-[0.7rem] font-semibold leading-snug" style={{ color: "var(--pn-text-primary)" }}>
          {opt.text}
        </div>
        {opt.implications ? (
          <div className="text-[0.65rem] leading-relaxed" style={{ color: "var(--pn-text-secondary)" }}>
            {opt.implications}
          </div>
        ) : null}
      </div>
    </button>
  );
}
