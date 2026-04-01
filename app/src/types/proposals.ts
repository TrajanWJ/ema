export interface Proposal {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly body: string;
  readonly status: "queued" | "reviewing" | "approved" | "redirected" | "killed";
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
