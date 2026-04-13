export interface SavedPrompt {
  readonly id: string;
  readonly name: string;
  readonly body: string;
  readonly category: PromptCategory;
  readonly tags: readonly string[];
  readonly version: number;
  readonly effectiveness_score: number;
  readonly usage_count: number;
  readonly success_count: number;
  readonly metadata: Record<string, unknown>;
  readonly parent_id: string | null;
  readonly template_vars: readonly string[];
  readonly inserted_at: string;
  readonly updated_at: string;
}

export type PromptCategory =
  | "system"
  | "review"
  | "metaprompt"
  | "template"
  | "technique"
  | "research";

export type PipelineStage =
  | "intercepted"
  | "reviewing"
  | "merging"
  | "revised"
  | "dispatched";

export type ExpertDomain =
  | "technical"
  | "creative"
  | "business"
  | "security";

export interface ExpertReview {
  readonly expert: ExpertDomain;
  readonly name: string;
  readonly score: number;
  readonly suggestions: readonly string[];
  readonly revised_section: string | null;
}

export interface PipelineRun {
  readonly intercept_id: string;
  readonly stage: PipelineStage;
  readonly original_prompt: string;
  readonly revised_prompt: string | null;
  readonly reviews: Partial<Record<ExpertDomain, ExpertReview>>;
  readonly avg_score: number;
  readonly was_modified: boolean;
  readonly started_at: string;
  readonly completed_at: string | null;
}

export interface InterceptorStats {
  readonly total_intercepted: number;
  readonly total_approved: number;
  readonly total_modified: number;
  readonly total_bypassed: number;
}

export interface ReviewerStats {
  readonly total_reviews: number;
  readonly reviews_by_expert: Record<ExpertDomain, number>;
  readonly avg_scores: Record<ExpertDomain, number>;
}

export interface ResearcherStats {
  readonly paused: boolean;
  readonly last_run_at: string | null;
  readonly total_discoveries: number;
  readonly topics_researched: number;
}
