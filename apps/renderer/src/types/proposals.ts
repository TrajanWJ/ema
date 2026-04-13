export type ProposalStatus =
  | "queued"
  | "reviewing"
  | "approved"
  | "redirected"
  | "killed"
  | "generating"
  | "failed";

/**
 * Renderer proposal view-model.
 *
 * The backend now returns durable proposal records from `/api/proposals`.
 * This interface remains a UI-facing shape so existing proposal components can
 * render without a full rewrite. Fields not present in the backend contract are
 * derived placeholders, not storage truth.
 */
export interface Proposal {
  readonly id: string;
  readonly intent_id: string;
  readonly title: string;
  readonly summary: string;
  readonly body: string;
  readonly status: ProposalStatus;
  readonly source_status: DurableProposalStatus;
  readonly confidence: number;
  readonly risks: readonly string[];
  readonly benefits: readonly string[];
  readonly estimated_scope: string;
  readonly steelman: string | null;
  readonly red_team: string | null;
  readonly synthesis: string | null;
  readonly idea_score: number | null;
  readonly prompt_quality_score: number | null;
  readonly score_breakdown: ScoreBreakdown | null;
  readonly tags: readonly ProposalTag[];
  readonly project_id: string | null;
  readonly parent_proposal_id: string | null;
  readonly children_count: number;
  readonly created_at: string;
  readonly quality_score: number | null;
  readonly pipeline_stage: string | null;
  readonly pipeline_iteration: number | null;
  readonly cost_display: string | null;
  readonly generation_log: Record<string, unknown> | null;
  readonly revision: number;
  readonly plan_steps: readonly string[];
}

export interface ScoreBreakdown {
  readonly codebase_coverage: number;
  readonly architectural_coherence: number;
  readonly impact: number;
  readonly prompt_specificity: number;
  readonly [key: string]: unknown;
}

export type ProposalSortKey = "created_at" | "idea_score" | "prompt_quality_score" | "combined_rank" | "confidence";
export type ProposalSortDir = "asc" | "desc";

export interface ProposalTag {
  readonly id: string;
  readonly category: string;
  readonly label: string;
}

export interface Seed {
  readonly id: string;
  readonly name: string;
  readonly prompt_template: string;
  readonly seed_type: string;
  readonly schedule: string | null;
  readonly active: boolean;
  readonly last_run_at: string | null;
  readonly run_count: number;
  readonly project_id: string | null;
}

export type DurableProposalStatus =
  | "generated"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "revised"
  | "superseded";

export interface DurableProposalRecord {
  readonly id: string;
  readonly intent_id: string;
  readonly title: string;
  readonly summary: string;
  readonly rationale: string;
  readonly plan_steps: readonly string[];
  readonly status: DurableProposalStatus;
  readonly revision: number;
  readonly parent_proposal_id: string | null;
  readonly metadata: Record<string, unknown>;
  readonly inserted_at: string;
  readonly updated_at: string;
}

export function mapDurableProposalStatus(status: DurableProposalStatus): ProposalStatus {
  switch (status) {
    case "approved":
      return "approved";
    case "rejected":
      return "killed";
    case "revised":
    case "superseded":
      return "redirected";
    case "generated":
      return "generating";
    case "pending_approval":
    default:
      return "queued";
  }
}

export function mapDurableProposalRecord(record: DurableProposalRecord): Proposal {
  const estimatedScope = record.plan_steps.length > 0 ? `${record.plan_steps.length} steps` : "unspecified";
  const bodySections = [
    record.summary,
    record.rationale ? `Rationale:\n${record.rationale}` : null,
    record.plan_steps.length > 0
      ? `Plan:\n${record.plan_steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}`
      : null,
  ].filter((section): section is string => section !== null && section.length > 0);

  return {
    id: record.id,
    intent_id: record.intent_id,
    title: record.title,
    summary: record.summary,
    body: bodySections.join("\n\n"),
    status: mapDurableProposalStatus(record.status),
    source_status: record.status,
    confidence: 0.5,
    risks: [],
    benefits: [],
    estimated_scope: estimatedScope,
    steelman: null,
    red_team: null,
    synthesis: null,
    idea_score: null,
    prompt_quality_score: null,
    score_breakdown: null,
    tags: [],
    project_id: null,
    parent_proposal_id: record.parent_proposal_id,
    children_count: 0,
    created_at: record.inserted_at,
    quality_score: null,
    pipeline_stage: record.status,
    pipeline_iteration: record.revision,
    cost_display: null,
    generation_log: record.metadata,
    revision: record.revision,
    plan_steps: [...record.plan_steps],
  };
}
