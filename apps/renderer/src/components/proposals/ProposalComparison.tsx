import { useState } from 'react';
import type { Proposal } from '@/types/proposals';
import { useProposalsStore } from '@/stores/proposals-store';

interface ProposalComparisonProps {
  proposals: Proposal[];
  onBack: () => void;
}

function scoreColor(score: number | null): string {
  if (score === null) return 'var(--pn-text-muted)';
  if (score >= 7) return '#22c55e';
  if (score >= 4) return '#f59e0b';
  return '#ef4444';
}

function wordDiff(text: string, otherText: string): React.ReactNode[] {
  const words = text.split(/(\s+)/);
  const otherWords = new Set(otherText.toLowerCase().split(/\s+/));
  return words.map((word, i) => {
    const isWhitespace = /^\s+$/.test(word);
    if (isWhitespace) return word;
    const clean = word.toLowerCase().replace(/[^a-z0-9]/g, '');
    const isUnique = clean.length > 2 && !otherWords.has(clean);
    return isUnique ? (
      <mark key={i} style={{ background: 'rgba(251,191,36,0.2)', color: 'inherit', borderRadius: '2px' }}>
        {word}
      </mark>
    ) : (
      <span key={i}>{word}</span>
    );
  });
}

export function ProposalComparison({ proposals, onBack }: ProposalComparisonProps) {
  const approve = useProposalsStore((s) => s.approve);
  const [dispatching, setDispatching] = useState<string | null>(null);

  async function handleDispatch(id: string) {
    setDispatching(id);
    try {
      await approve(id);
      onBack();
    } finally {
      setDispatching(null);
    }
  }

  const colWidth = proposals.length === 2 ? '50%' : '33.333%';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className="text-[0.7rem] px-2 py-1 rounded transition-opacity hover:opacity-80"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid var(--pn-border-default)',
            color: 'var(--pn-text-secondary)',
          }}
        >
          ← Back
        </button>
        <h2
          className="text-[0.9rem] font-semibold"
          style={{ color: 'var(--pn-text-primary)' }}
        >
          Compare Proposals
        </h2>
        <span className="text-[0.65rem]" style={{ color: 'var(--pn-text-muted)' }}>
          {proposals.length} proposals
        </span>
      </div>

      {/* Columns */}
      <div className="flex flex-1 min-h-0 gap-3 overflow-hidden">
        {proposals.map((proposal, idx) => {
          const otherProposals = proposals.filter((_, i) => i !== idx);
          const otherText = otherProposals.map((p) => `${p.title} ${p.summary} ${p.body}`).join(' ');
          const combinedScore =
            proposal.idea_score !== null && proposal.prompt_quality_score !== null
              ? ((proposal.idea_score ?? 0) + (proposal.prompt_quality_score ?? 0)) / 2
              : (proposal.idea_score ?? proposal.quality_score ?? null);

          return (
            <div
              key={proposal.id}
              className="glass-surface flex flex-col rounded-xl overflow-hidden"
              style={{ width: colWidth, flexShrink: 0, flexGrow: 1 }}
            >
              {/* Column header */}
              <div
                className="px-4 py-3"
                style={{ borderBottom: '1px solid var(--pn-border-subtle)' }}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3
                    className="text-[0.8rem] font-semibold leading-snug"
                    style={{ color: 'var(--pn-text-primary)' }}
                  >
                    {proposal.title}
                  </h3>
                  {combinedScore !== null && (
                    <span
                      className="text-[0.65rem] font-bold px-1.5 py-0.5 rounded shrink-0"
                      style={{
                        color: scoreColor(combinedScore),
                        background: `${scoreColor(combinedScore)}22`,
                      }}
                    >
                      {combinedScore.toFixed(1)}
                    </span>
                  )}
                </div>
                <span className="text-[0.6rem]" style={{ color: 'var(--pn-text-muted)' }}>
                  {new Date(proposal.created_at).toLocaleDateString()}
                </span>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
                {/* Summary */}
                {proposal.summary && (
                  <div>
                    <div
                      className="text-[0.6rem] uppercase tracking-wider mb-1"
                      style={{ color: 'var(--pn-text-muted)' }}
                    >
                      Summary
                    </div>
                    <p
                      className="text-[0.72rem] leading-relaxed"
                      style={{ color: 'var(--pn-text-secondary)' }}
                    >
                      {proposals.length > 1
                        ? wordDiff(proposal.summary, otherText)
                        : proposal.summary}
                    </p>
                  </div>
                )}

                {/* Body */}
                {proposal.body && (
                  <div>
                    <div
                      className="text-[0.6rem] uppercase tracking-wider mb-1"
                      style={{ color: 'var(--pn-text-muted)' }}
                    >
                      Full Proposal
                    </div>
                    <div
                      className="text-[0.7rem] leading-relaxed whitespace-pre-wrap"
                      style={{ color: 'var(--pn-text-secondary)' }}
                    >
                      {proposals.length > 1 ? wordDiff(proposal.body, otherText) : proposal.body}
                    </div>
                  </div>
                )}

                {/* Score breakdown */}
                {proposal.score_breakdown &&
                  Object.keys(proposal.score_breakdown).length > 0 && (
                    <div>
                      <div
                        className="text-[0.6rem] uppercase tracking-wider mb-1"
                        style={{ color: 'var(--pn-text-muted)' }}
                      >
                        Scores
                      </div>
                      <div className="flex flex-col gap-1">
                        {Object.entries(proposal.score_breakdown).map(([key, val]) => (
                          <div key={key} className="flex justify-between items-center">
                            <span
                              className="text-[0.62rem]"
                              style={{ color: 'var(--pn-text-muted)' }}
                            >
                              {key.replace(/_/g, ' ')}
                            </span>
                            <span
                              className="text-[0.65rem] font-medium"
                              style={{
                                color: scoreColor(typeof val === 'number' ? val : null),
                              }}
                            >
                              {typeof val === 'number' ? val.toFixed(1) : String(val)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>

              {/* Dispatch button */}
              <div
                className="px-4 py-3"
                style={{ borderTop: '1px solid var(--pn-border-subtle)' }}
              >
                <button
                  onClick={() => handleDispatch(proposal.id)}
                  disabled={dispatching === proposal.id}
                  className="w-full text-[0.7rem] font-medium py-2 rounded-lg transition-opacity hover:opacity-80 disabled:opacity-40"
                  style={{
                    background: 'rgba(34,197,94,0.14)',
                    border: '1px solid rgba(34,197,94,0.3)',
                    color: '#22c55e',
                  }}
                >
                  {dispatching === proposal.id ? 'Dispatching...' : 'Dispatch This One'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
