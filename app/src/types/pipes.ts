export interface Pipe {
  readonly id: string;
  readonly name: string;
  readonly system: boolean;
  readonly active: boolean;
  readonly trigger_pattern: string;
  readonly description: string | null;
  readonly project_id: string | null;
  readonly actions: PipeAction[];
  readonly transforms: PipeTransform[];
}

export interface PipeAction {
  readonly id: string;
  readonly action_id: string;
  readonly config: Record<string, unknown>;
  readonly sort_order: number;
}

export interface PipeTransform {
  readonly id: string;
  readonly transform_type: string;
  readonly config: Record<string, unknown>;
  readonly sort_order: number;
}
