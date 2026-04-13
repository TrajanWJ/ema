import { useEffect, useRef, useState } from "react";
import { joinChannel } from "@/lib/ws";
import type { Channel } from "phoenix";

interface StageInfo {
  name: string;
  label: string;
  num: number;
}

const STAGES: StageInfo[] = [
  { name: "generator", label: "Generating", num: 1 },
  { name: "refiner", label: "Refining", num: 2 },
  { name: "risk_analyzer", label: "Analyzing Risks", num: 3 },
  { name: "formatter", label: "Formatting", num: 4 },
];

interface PipelineState {
  currentStage: string | null;
  currentStageNum: number;
  streamedText: string;
  completedStages: string[];
  iteration: number;
  qualityFeedback: string | null;
  isComplete: boolean;
  hasWarning: boolean;
  warnings: string[];
  error: string | null;
}

interface ProposalStreamingViewProps {
  readonly proposalId: string;
  readonly onComplete?: (proposalId: string) => void;
  readonly compact?: boolean;
}

/**
 * ProposalStreamingView
 *
 * Subscribes to "proposal:<id>" PubSub (via Phoenix Channel) and renders
 * live streaming output from the Proposal Orchestrator pipeline.
 *
 * Features:
 * - 4-stage progress bar with visual indicators
 * - Live streaming text display
 * - Iteration counter when quality gate loops
 * - Quality gate feedback display on failure
 * - Warning badges for passes-with-warnings
 */
export function ProposalStreamingView({
  proposalId,
  onComplete,
  compact = false,
}: ProposalStreamingViewProps) {
  const [state, setState] = useState<PipelineState>({
    currentStage: null,
    currentStageNum: 0,
    streamedText: "",
    completedStages: [],
    iteration: 1,
    qualityFeedback: null,
    isComplete: false,
    hasWarning: false,
    warnings: [],
    error: null,
  });

  const channelRef = useRef<Channel | null>(null);
  const textEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function subscribe() {
      try {
        const { channel } = await joinChannel(`proposal:${proposalId}`);
        if (cancelled) {
          channel.leave();
          return;
        }
        channelRef.current = channel;

        // Stage started
        channel.on("stage_started", ({ stage, stage_num }: { stage: string; stage_num: number }) => {
          setState((prev) => ({
            ...prev,
            currentStage: stage,
            currentStageNum: stage_num,
            streamedText: "",
            qualityFeedback: null,
          }));
        });

        // Streaming text chunk
        channel.on("stage_update", ({ stage, text }: { stage: string; text: string }) => {
          setState((prev) => ({
            ...prev,
            currentStage: stage,
            streamedText: prev.streamedText + text,
          }));
        });

        // Stage finished
        channel.on("stage_complete", ({ stage }: { stage: string }) => {
          setState((prev) => ({
            ...prev,
            completedStages: [...prev.completedStages, stage],
          }));
        });

        // Quality gate failed — show feedback and increment iteration
        channel.on("quality_gate_failed", ({ feedback, iteration }: { feedback: string; iteration: number }) => {
          setState((prev) => ({
            ...prev,
            qualityFeedback: feedback,
            iteration: iteration + 1,
            // Reset completed stages back to generator (loop from refiner)
            completedStages: prev.completedStages.filter((s) => s === "generator"),
            currentStage: null,
            currentStageNum: 0,
            streamedText: "",
          }));
        });

        // Quality gate passed
        channel.on("quality_gate_passed", () => {
          setState((prev) => ({
            ...prev,
            qualityFeedback: null,
          }));
        });

        // Passed with warnings
        channel.on("quality_gate_warning", ({ failures }: { failures: string[] }) => {
          setState((prev) => ({
            ...prev,
            hasWarning: true,
            warnings: failures,
          }));
        });

        // Pipeline complete
        channel.on("complete", ({ id }: { id: string }) => {
          setState((prev) => ({
            ...prev,
            isComplete: true,
            currentStage: null,
          }));
          onComplete?.(id ?? proposalId);
        });

        // Pipeline error
        channel.on("pipeline_error", ({ reason }: { reason: string }) => {
          setState((prev) => ({
            ...prev,
            error: typeof reason === "string" ? reason : JSON.stringify(reason),
          }));
        });
      } catch (err) {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            error: err instanceof Error ? err.message : "Failed to connect to proposal stream",
          }));
        }
      }
    }

    subscribe();

    return () => {
      cancelled = true;
      channelRef.current?.leave();
      channelRef.current = null;
    };
  }, [proposalId, onComplete]);

  // Auto-scroll to bottom as text streams in
  useEffect(() => {
    textEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.streamedText]);

  if (state.error) {
    return (
      <div
        className="rounded-lg p-3 text-[0.7rem]"
        style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}
      >
        Pipeline error: {state.error}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Stage Progress Bar */}
      <StageProgressBar
        stages={STAGES}
        currentStage={state.currentStage}
        completedStages={state.completedStages}
        isComplete={state.isComplete}
      />

      {/* Iteration indicator */}
      {state.iteration > 1 && !state.isComplete && (
        <IterationBadge iteration={state.iteration} />
      )}

      {/* Quality gate feedback */}
      {state.qualityFeedback && !state.isComplete && (
        <QualityFeedbackPanel feedback={state.qualityFeedback} />
      )}

      {/* Warning badges */}
      {state.hasWarning && state.warnings.length > 0 && (
        <WarningPanel warnings={state.warnings} />
      )}

      {/* Streaming text */}
      {(state.streamedText || state.isComplete) && (
        <StreamingTextPanel
          text={state.streamedText}
          currentStage={state.currentStage}
          isComplete={state.isComplete}
          compact={compact}
        />
      )}

      {/* Complete indicator */}
      {state.isComplete && (
        <div
          className="text-[0.65rem] text-center py-1.5 rounded"
          style={{ color: "#22c55e", background: "rgba(34,197,94,0.06)" }}
        >
          ✅ Pipeline complete
        </div>
      )}

      <div ref={textEndRef} />
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StageProgressBar({
  stages,
  currentStage,
  completedStages,
  isComplete,
}: {
  stages: StageInfo[];
  currentStage: string | null;
  completedStages: string[];
  isComplete: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      {stages.map((stage, i) => {
        const isCompleted = completedStages.includes(stage.name) || isComplete;
        const isActive = currentStage === stage.name && !isComplete;

        return (
          <div key={stage.name} className="flex items-center gap-1 flex-1">
            <StageIndicator
              stage={stage}
              isCompleted={isCompleted}
              isActive={isActive}
            />
            {i < stages.length - 1 && (
              <div
                className="h-px flex-1"
                style={{
                  background: isCompleted
                    ? "rgba(34,197,94,0.5)"
                    : "rgba(255,255,255,0.08)",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StageIndicator({
  stage,
  isCompleted,
  isActive,
}: {
  stage: StageInfo;
  isCompleted: boolean;
  isActive: boolean;
}) {
  const color = isCompleted
    ? "#22c55e"
    : isActive
    ? "#6b95f0"
    : "rgba(255,255,255,0.2)";

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        className="rounded-full flex items-center justify-center text-[0.5rem] font-bold transition-all"
        style={{
          width: "18px",
          height: "18px",
          background: isCompleted
            ? "rgba(34,197,94,0.15)"
            : isActive
            ? "rgba(107,149,240,0.15)"
            : "rgba(255,255,255,0.04)",
          border: `1.5px solid ${color}`,
          color,
        }}
      >
        {isCompleted ? "✓" : isActive ? "●" : stage.num}
      </div>
      <span
        className="text-[0.5rem] whitespace-nowrap"
        style={{ color: isActive ? "#6b95f0" : isCompleted ? "#22c55e" : "rgba(255,255,255,0.3)" }}
      >
        {stage.label}
      </span>
    </div>
  );
}

function IterationBadge({ iteration }: { iteration: number }) {
  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded text-[0.65rem]"
      style={{ background: "rgba(245,158,11,0.08)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)" }}
    >
      <span>🔄</span>
      <span>Iteration {iteration} of 3 — refining based on quality feedback...</span>
    </div>
  );
}

function QualityFeedbackPanel({ feedback }: { feedback: string }) {
  const lines = feedback
    .split("\n")
    .filter((l) => l.trim().startsWith("•") || l.trim().startsWith("-"))
    .map((l) => l.replace(/^[•\-]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 5);

  return (
    <div
      className="rounded-lg p-2.5"
      style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}
    >
      <div
        className="text-[0.6rem] font-semibold uppercase tracking-wider mb-1.5"
        style={{ color: "#ef4444" }}
      >
        ⚠️ Quality Gate Failed — Revising
      </div>
      {lines.length > 0 ? (
        <ul className="space-y-0.5">
          {lines.map((line, i) => (
            <li
              key={`fb-${i}`}
              className="text-[0.65rem] flex gap-1.5"
              style={{ color: "rgba(239,68,68,0.85)" }}
            >
              <span>›</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[0.65rem]" style={{ color: "rgba(239,68,68,0.85)" }}>
          {feedback.slice(0, 200)}
        </p>
      )}
    </div>
  );
}

function WarningPanel({ warnings }: { warnings: string[] }) {
  return (
    <div
      className="rounded-lg p-2.5"
      style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}
    >
      <div
        className="text-[0.6rem] font-semibold uppercase tracking-wider mb-1"
        style={{ color: "#f59e0b" }}
      >
        ⚠️ Passed with Warnings
      </div>
      <ul className="space-y-0.5">
        {warnings.map((w, i) => (
          <li key={`warn-${i}`} className="text-[0.65rem]" style={{ color: "rgba(245,158,11,0.85)" }}>
            › {w}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StreamingTextPanel({
  text,
  currentStage,
  isComplete,
  compact,
}: {
  text: string;
  currentStage: string | null;
  isComplete: boolean;
  compact: boolean;
}) {
  const maxHeight = compact ? "120px" : "300px";

  return (
    <div
      className="rounded-lg p-3 overflow-y-auto"
      style={{
        maxHeight,
        background: "rgba(0,0,0,0.2)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {currentStage && !isComplete && (
        <div className="flex items-center gap-1.5 mb-2">
          <Spinner />
          <span className="text-[0.6rem]" style={{ color: "#6b95f0" }}>
            {STAGES.find((s) => s.name === currentStage)?.label ?? currentStage}...
          </span>
        </div>
      )}
      <pre
        className="text-[0.65rem] leading-relaxed whitespace-pre-wrap font-mono"
        style={{ color: "var(--pn-text-secondary)" }}
      >
        {text}
        {!isComplete && currentStage && <BlinkingCursor />}
      </pre>
    </div>
  );
}

function Spinner() {
  return (
    <div
      className="rounded-full animate-spin"
      style={{
        width: "10px",
        height: "10px",
        border: "1.5px solid rgba(107,149,240,0.3)",
        borderTopColor: "#6b95f0",
      }}
    />
  );
}

function BlinkingCursor() {
  return (
    <span
      className="inline-block ml-0.5"
      style={{
        width: "2px",
        height: "12px",
        background: "#6b95f0",
        animation: "blink 1s step-end infinite",
        verticalAlign: "text-bottom",
      }}
    />
  );
}
