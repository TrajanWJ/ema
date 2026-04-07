export interface Actor {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly type: string; // 'human' | 'agent'
  readonly phase: string; // 'idle' | 'plan' | 'execute' | 'review' | 'retro'
  readonly status: string;
  readonly capabilities: string;
  readonly config: Record<string, unknown>;
  readonly space_id: string | null;
  readonly phase_started_at: string | null;
  readonly inserted_at: string;
  readonly updated_at: string;
}

export interface PhaseTransition {
  readonly id: string;
  readonly actor_id: string;
  readonly from_phase: string | null;
  readonly to_phase: string;
  readonly week_number: number | null;
  readonly reason: string | null;
  readonly summary: string | null;
  readonly transitioned_at: string;
}

export interface Tag {
  readonly id: string;
  readonly entity_type: string;
  readonly entity_id: string;
  readonly tag: string;
  readonly actor_id: string;
  readonly namespace: string;
}

export interface EntityData {
  readonly entity_type: string;
  readonly entity_id: string;
  readonly actor_id: string;
  readonly key: string;
  readonly value: string;
}
