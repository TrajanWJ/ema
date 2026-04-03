import { useEffect, useState } from "react";
import { ProposalStreamingView } from "./ProposalStreamingView";
import { useProposalsStore } from "@/stores/proposals-store";
import type { Proposal } from "@/types/proposals";

interface ProposalDetailProps {
  readonly proposalId: string;
  readonly onClose?: () => void;
}

/**
 * ProposalDetail
 *
 * Full proposal detail view with live streaming support.
 *
 * When a proposal is in "generating" status, it subscribes to the
 * PubSub topic "proposal:<id>" and renders the ProposalStreamingView
 * with live stage progress and streaming text.
 *
 * When the proposal is complete, it renders the full proposal content.
 */
export function ProposalDetail({ proposalId, onClose }: ProposalDetailProps) {
  const { proposals, approve, redirect, kill } = useProposalsStore();
  const [proposal, setProposal] = useState<Proposal | null>(
    proposals.find((p) => p.id === proposalId) ?? null
  );
  const [redirectNote, setRedirectNote] = useState("");
  const [showRedirect, setShowRedirect] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [costDisplay, setCostDisplay] = useState<string | null>(null);

  // Update proposal from store when it changes (e.g., after pipeline completes)
  useEffect(() => {
    const found = proposals.find((p) => p.id === proposalId);
    if (found) setProposal(found);
  }, [proposals, proposalId]);

  // Fetch cost info once proposal is complete
  useEffect(() => {
    if (proposal?.status !== "generating" && proposal?.status !== "queued") return;
    // Cost is stored in generation_log after pipeline completes
    const log = proposal.generation_log as Record<string, unknown> | null;
    if (log?.quality_score !== undefined) {
      const iters = (log?.iterations as number) ?? 1;
      const stages = 4;
      // We show a placeholder — real cost comes from CostAggregator via REST
      setCostDisplay(`${stages} stages, ${iters} iter`);
    }
  }, [proposal]);

  if (!proposal) {
    return (
      <div
        className="p-4 text-[0.7rem]"
        style={{ color: "var(--pn-text-secondary)" }}
      >
        Loading proposal...
      </div>
    );
  }

  const isGenerating = proposal.status === "generating";
  const isQueued = proposal.status === "queued";

  function handleComplete(_id: string) {
    // Reload proposals store to get updated proposal after pipeline finishes
    void useProposalsStore.getState().loadViaRest();
  }

  async function handleApprove() {
    try {
      setError(null);
      await approve(proposal!.id);
      onClose?.();
    } catch {
      setError("Failed to approve");
    }
  }

  async function handleRedirect() {
    if (!showRedirect) {
      setShowRedirect(true);
      return;
    }
    if (!redirectNote.trim()) return;
    try {
      setError(null);
      await redirect(proposal!.id, redirectNote.trim());
      onClose?.();
    } catch {
      setError("Failed to redirect");
    }
  }

  async function handleKill() {
    try {
      setError(null);
      await kill(proposal!.id);
      onClose?.();
    } catch {
      setError("Failed to kill");
    }
  }

  return (
    <div className="flex flex-col gap-3 p-4 h-full overflow-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h2
            className="text-[0.9rem] font-semibold leading-tight mb-1"
            style={{ color: "var(--pn-text-primary)" }}
          >
            {proposal.title}
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={proposal.status} />
            {costDisplay && (
              <span
                className="text-[0.55rem] px-1.5 py-0.5 rounded"
                style={{ background: "rgba(107,149,240,0.1)", color: "#6b95f0" }}
              >
                💰 {costDisplay}
              </span>
            )}
            {proposal.project_id && (
              <span
                className="text-[0.55rem] px-1.5 py-0.5 rounded-full"
                style={{ background: "rgba(45,212,168,0.1)", color: "#2dd4a8" }}
              >
                project
              </span>
            )}
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-[0.7rem] px-2 py-1 rounded opacity-50 hover:opacity-100"
            style={{ color: "var(--pn-text-muted)" }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Live streaming view (when generating) */}
      {isGenerating && (
        <ProposalStreamingView
          proposalId={proposalId}
          onComplete={handleComplete}
        />
      )}

      {/* Static content (when not generating) */}
      {!isGenerating && (
        <div className="flex flex-col gap-2.5">
          {proposal.summary && (
            <Section label="Summary" content={proposal.summary} />
          )}
          {proposal.body && (
            <MarkdownSection label="Proposal" content={proposal.body} />
          )}
          {proposal.steelman && (
            <Section label="Refined Draft" content={proposal.steelman} />
          )}
          {proposal.synthesis && (
            <MarkdownSection label="Final Format" content={proposal.synthesis} />
          )}
          {(proposal.risks ?? []).length > 0 && (
            <ListSection label="Risks" items={proposal.risks} color="#ef4444" />
          )}
          {(proposal.benefits ?? []).length > 0 && (
            <ListSection label="Benefits" items={proposal.benefits} color="#22c55e" />
          )}
        </div>
      )}

      {/* Action buttons (only when not generating and in actionable state) */}
      {(isQueued || proposal.status === "reviewing") && !isGenerating && (
        <div className="flex flex-col gap-2 pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          {showRedirect && (
            <input
              type="text"
              value={redirectNote}
              onChange={(e) => setRedirectNote(e.target.value)}
              placeholder="Redirect note..."
              className="w-full rounded px-2 py-1.5 text-[0.7rem]"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--pn-border-default)",
                color: "var(--pn-text-primary)",
                outline: "none",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleRedirect();
                if (e.key === "Escape") setShowRedirect(false);
              }}
              autoFocus
            />
          )}

          {error && (
            <div
              className="text-[0.65rem] px-2 py-1 rounded"
              style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}
            >
              {error}
            </div>
          )}

          <div className="flex items-center gap-2">
            <ActionButton label="Approve" color="#22c55e" onClick={handleApprove} />
            <ActionButton
              label={showRedirect ? "Send" : "Redirect"}
              color="#f59e0b"
              onClick={handleRedirect}
            />
            <ActionButton label="Kill" color="#ef4444" onClick={handleKill} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config = {
    generating: { label: "🔄 Generating", color: "#6b95f0" },
    queued: { label: "⏳ Queued", color: "#f59e0b" },
    reviewing: { label: "🔍 Reviewing", color: "#a78bfa" },
    approved: { label: "✅ Accepted", color: "#22c55e" },
    redirected: { label: "↩️ Redirected", color: "#f59e0b" },
    killed: { label: "❌ Killed", color: "#ef4444" },
    failed: { label: "⚠️ Failed", color: "#ef4444" },
  } as const;

  const { label, color } = config[status as keyof typeof config] ?? {
    label: status,
    color: "rgba(255,255,255,0.4)",
  };

  return (
    <span
      className="text-[0.6rem] px-1.5 py-0.5 rounded"
      style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}
    >
      {label}
    </span>
  );
}

function Section({ label, content }: { label: string; content: string }) {
  return (
    <div>
      <div
        className="text-[0.6rem] font-semibold uppercase tracking-wider mb-0.5"
        style={{ color: "var(--pn-text-muted)" }}
      >
        {label}
      </div>
      <p className="text-[0.7rem] leading-relaxed" style={{ color: "var(--pn-text-secondary)" }}>
        {content}
      </p>
    </div>
  );
}

function MarkdownSection({ label, content }: { label: string; content: string }) {
  return (
    <div>
      <div
        className="text-[0.6rem] font-semibold uppercase tracking-wider mb-1"
        style={{ color: "var(--pn-text-muted)" }}
      >
        {label}
      </div>
      <pre
        className="text-[0.65rem] leading-relaxed whitespace-pre-wrap"
        style={{ color: "var(--pn-text-secondary)", fontFamily: "inherit" }}
      >
        {content}
      </pre>
    </div>
  );
}

function ListSection({
  label,
  items,
  color,
}: {
  label: string;
  items: readonly string[];
  color: string;
}) {
  return (
    <div>
      <div
        className="text-[0.6rem] font-semibold uppercase tracking-wider mb-1"
        style={{ color }}
      >
        {label}
      </div>
      <ul className="space-y-0.5">
        {items.map((item, i) => (
          <li
            key={`${label}-${i}`}
            className="text-[0.65rem] leading-relaxed flex gap-1.5"
            style={{ color: "var(--pn-text-secondary)" }}
          >
            <span style={{ color }}>-</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
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
      onClick={onClick}
      className="text-[0.65rem] font-medium px-3 py-1.5 rounded transition-opacity hover:opacity-80"
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
