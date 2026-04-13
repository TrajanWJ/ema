export interface BehaviorRule {
  readonly id: string;
  readonly source: string;
  readonly content: string;
  readonly status: "proposed" | "active" | "rolled_back";
  readonly version: number;
  readonly diff: string | null;
  readonly signal_metadata: Record<string, unknown>;
  readonly previous_rule_id: string | null;
  readonly proposal_id: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface EvolutionSignal {
  readonly id: string;
  readonly source: string;
  readonly content: string;
  readonly status: string;
  readonly signal_metadata: Record<string, unknown>;
  readonly created_at: string;
}

export interface EvolutionStats {
  readonly rules: {
    readonly total_rules: number;
    readonly active_rules: number;
    readonly proposed_rules: number;
    readonly rolled_back_rules: number;
    readonly sources: Record<string, number>;
  };
  readonly scanner: {
    readonly total_scans: number;
    readonly signals_detected: number;
    readonly last_scan_at: string | null;
  };
}
