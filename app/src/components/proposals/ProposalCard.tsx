import { useState } from "react";
import type { Proposal } from "@/types/proposals";
import { useProposalsStore } from "@/stores/proposals-store";

interface ProposalCardProps {
  readonly proposal: Proposal;
}

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "#22c55e",
  medium: "#f59e0b",
  low: "#ef4444",
};

function confidenceLevel(confidence: number): string {
  if (confidence >= 0.7) return "high";
  if (confidence >= 0.4) return "medium";
  return "low";
}

export function ProposalCard({ proposal }: ProposalCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [redirectNote, setRedirectNote] = useState("");
  const [showRedirectInput, setShowRedirectInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { approve, redirect, kill } = useProposalsStore();

  const level = confidenceLevel(proposal.confidence);
  const dotColor = CONFIDENCE_COLORS[level];

  async function handleApprove() {
    try {
      setError(null);
      await approve(proposal.id);
    } catch {
      setError("Failed to approve proposal");
    }
  }

  async function handleRedirect() {
    if (!showRedirectInput) {
      setShowRedirectInput(true);
      return;
    }
    if (redirectNote.trim()) {
      try {
        setError(null);
        await redirect(proposal.id, redirectNote.trim());
        setShowRedirectInput(false);
        setRedirectNote("");
      } catch {
        setError("Failed to redirect proposal");
      }
    }
  }

  async function handleKill() {
    try {
      setError(null);
      await kill(proposal.id);
    } catch {
      setError("Failed to kill proposal");
    }
  }

  return (
    <div
      className="glass-surface rounded-lg p-3 cursor-pointer transition-colors hover:bg-white/[0.02]"
    >
      {/* Collapsed header */}
      <div
        className="flex items-start gap-2.5"
        onClick={() => setExpanded(!expanded)}
      >
        <span
          className="shrink-0 rounded-full mt-1"
          style={{
            width: "8px",
            height: "8px",
            background: dotColor,
          }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-[0.75rem] font-medium truncate"
              style={{ color: "var(--pn-text-primary)" }}
            >
              {proposal.title}
            </span>
            {proposal.estimated_scope && (
              <span
                className="shrink-0 text-[0.6rem] px-1.5 py-0.5 rounded"
                style={{
                  background: "rgba(107, 149, 240, 0.12)",
                  color: "#6b95f0",
                }}
              >
                {proposal.estimated_scope}
              </span>
            )}
          </div>
          {!expanded && (
            <p
              className="text-[0.65rem] leading-relaxed"
              style={{
                color: "var(--pn-text-secondary)",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {proposal.summary}
            </p>
          )}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {(proposal.tags ?? []).map((tag) => (
              <span
                key={tag.id}
                className="text-[0.55rem] px-1.5 py-0.5 rounded-full"
                style={{
                  background: "rgba(167, 139, 250, 0.1)",
                  color: "#a78bfa",
                }}
              >
                {tag.label}
              </span>
            ))}
            {proposal.project_id && (
              <span
                className="text-[0.55rem] px-1.5 py-0.5 rounded-full"
                style={{
                  background: "rgba(45, 212, 168, 0.1)",
                  color: "#2dd4a8",
                }}
              >
                project
              </span>
            )}
            <span
              className="text-[0.55rem] ml-auto"
              style={{ color: "var(--pn-text-muted)" }}
            >
              {new Date(proposal.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="mt-3 pl-5">
          <p
            className="text-[0.7rem] leading-relaxed mb-3"
            style={{ color: "var(--pn-text-secondary)" }}
          >
            {proposal.body}
          </p>

          {proposal.steelman && (
            <Section label="Steelman" content={proposal.steelman} />
          )}
          {proposal.red_team && (
            <Section label="Red Team" content={proposal.red_team} />
          )}
          {proposal.synthesis && (
            <Section label="Synthesis" content={proposal.synthesis} />
          )}

          {(proposal.risks ?? []).length > 0 && (
            <div className="mb-2">
              <span
                className="text-[0.6rem] font-medium uppercase tracking-wider"
                style={{ color: "#ef4444" }}
              >
                Risks
              </span>
              <ul className="mt-1">
                {(proposal.risks ?? []).map((risk, i) => (
                  <li
                    key={`risk-${proposal.id}-${i}`}
                    className="text-[0.65rem] leading-relaxed"
                    style={{ color: "var(--pn-text-secondary)" }}
                  >
                    - {risk}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(proposal.benefits ?? []).length > 0 && (
            <div className="mb-3">
              <span
                className="text-[0.6rem] font-medium uppercase tracking-wider"
                style={{ color: "#22c55e" }}
              >
                Benefits
              </span>
              <ul className="mt-1">
                {(proposal.benefits ?? []).map((benefit, i) => (
                  <li
                    key={`benefit-${proposal.id}-${i}`}
                    className="text-[0.65rem] leading-relaxed"
                    style={{ color: "var(--pn-text-secondary)" }}
                  >
                    - {benefit}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Redirect note input */}
          {showRedirectInput && (
            <div className="mb-3">
              <input
                type="text"
                value={redirectNote}
                onChange={(e) => setRedirectNote(e.target.value)}
                placeholder="Redirect note..."
                className="w-full rounded px-2 py-1.5 text-[0.7rem]"
                style={{
                  background: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid var(--pn-border-default)",
                  color: "var(--pn-text-primary)",
                  outline: "none",
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRedirect();
                  if (e.key === "Escape") setShowRedirectInput(false);
                }}
                autoFocus
              />
            </div>
          )}

          {error && (
            <div
              className="mb-2 text-[0.65rem] px-2 py-1 rounded"
              style={{ background: "rgba(239, 68, 68, 0.1)", color: "#ef4444" }}
            >
              {error}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <ActionButton
              label="Approve"
              color="#22c55e"
              onClick={handleApprove}
            />
            <ActionButton
              label={showRedirectInput ? "Send" : "Redirect"}
              color="#f59e0b"
              onClick={handleRedirect}
            />
            <ActionButton
              label="Kill"
              color="#ef4444"
              onClick={handleKill}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ label, content }: { label: string; content: string }) {
  return (
    <div className="mb-2">
      <span
        className="text-[0.6rem] font-medium uppercase tracking-wider"
        style={{ color: "var(--pn-text-muted)" }}
      >
        {label}
      </span>
      <p
        className="text-[0.65rem] leading-relaxed mt-0.5"
        style={{ color: "var(--pn-text-secondary)" }}
      >
        {content}
      </p>
    </div>
  );
}

function ActionButton({
  label,
  color,
  onClick,
}: {
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="text-[0.65rem] font-medium px-3 py-1 rounded transition-opacity hover:opacity-80"
      style={{
        background: `${color}18`,
        color,
        border: `1px solid ${color}30`,
      }}
    >
      {label}
    </button>
  );
}
