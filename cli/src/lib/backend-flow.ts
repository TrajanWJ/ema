import { ServiceConnection } from './service-connection.js';

export interface RuntimeIntent {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly level: string;
  readonly kind?: string;
  readonly description: string | null;
  readonly space_id?: string | null;
}

export interface CreateRuntimeIntentInput {
  readonly slug?: string;
  readonly title: string;
  readonly description?: string | null;
  readonly level: string;
  readonly status?: string;
  readonly kind?: string;
  readonly phase?: string;
  readonly parent_id?: string | null;
  readonly project_id?: string | null;
  readonly actor_id?: string | null;
  readonly exit_condition?: string;
  readonly scope?: readonly string[];
  readonly space_id?: string;
  readonly metadata?: Record<string, unknown>;
  readonly tags?: readonly string[];
}

export interface IntentRuntimeBundle {
  readonly intent: RuntimeIntent;
  readonly phase: string | null;
  readonly links: {
    executions: Array<{
      readonly target_id: string;
      readonly relation: string;
      readonly provenance: string;
    }>;
    readonly proposals: readonly unknown[];
    readonly actors: readonly unknown[];
    readonly sessions: readonly unknown[];
    readonly tasks: readonly unknown[];
    readonly canon: readonly unknown[];
  };
  readonly phase_transitions: readonly unknown[];
  readonly recent_events: Array<{
    readonly event_type: string;
    readonly happened_at: string;
    readonly payload: Record<string, unknown>;
  }>;
}

export interface RuntimeExecution {
  readonly id: string;
  readonly title: string;
  readonly objective: string | null;
  readonly mode: string;
  readonly status: string;
  readonly intent_slug: string | null;
  readonly result_summary: string | null;
  readonly result_path: string | null;
  readonly completed_at: string | null;
  readonly current_phase: string | null;
  readonly updated_at: string;
}

export interface RuntimeExecutionDetail {
  readonly execution: RuntimeExecution;
  readonly transitions: Array<{
    readonly from_phase: string | null;
    readonly to_phase: string;
    readonly reason: string;
    readonly transitioned_at: string;
  }>;
}

export interface RuntimeProposal {
  readonly id: string;
  readonly intent_id: string;
  readonly title: string;
  readonly summary: string;
  readonly rationale: string;
  readonly plan_steps: readonly string[];
  readonly status: string;
  readonly revision: number;
  readonly parent_proposal_id: string | null;
  readonly generated_by_actor_id: string;
  readonly approved_by_actor_id: string | null;
  readonly metadata: Record<string, unknown>;
  readonly inserted_at: string;
  readonly updated_at: string;
}

export interface RuntimeTask {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly priority: string | number | null;
  readonly project_id: string | null;
  readonly agent: string | null;
  readonly intent: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export class BackendFlowClient {
  constructor(private readonly services: ServiceConnection) {}

  async listIntents(filter: {
    status?: string;
    level?: string;
    kind?: string;
    phase?: string;
  } = {}): Promise<readonly RuntimeIntent[]> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filter)) {
      if (typeof value === 'string' && value.length > 0) query.set(key, value);
    }
    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    const response = await this.services.request<{ intents: RuntimeIntent[] }>(
      'GET',
      `/api/intents${suffix}`,
    );
    return response.intents;
  }

  async createIntent(input: CreateRuntimeIntentInput): Promise<RuntimeIntent> {
    const response = await this.services.request<{ intent: RuntimeIntent }>(
      'POST',
      '/api/intents',
      input,
    );
    return response.intent;
  }

  async getIntentRuntime(slug: string): Promise<IntentRuntimeBundle> {
    const response = await this.services.request<{ bundle: IntentRuntimeBundle }>(
      'GET',
      `/api/intents/${encodeURIComponent(slug)}/runtime`,
    );
    return response.bundle;
  }

  async startExecutionFromIntent(
    slug: string,
    input: {
      title?: string;
      objective?: string | null;
      mode?: string;
      requires_approval?: boolean;
      project_slug?: string | null;
      space_id?: string | null;
    } = {},
  ): Promise<{ execution: RuntimeExecution; bundle: IntentRuntimeBundle | null }> {
    return this.services.request('POST', `/api/intents/${encodeURIComponent(slug)}/executions`, input);
  }

  async listExecutions(filter: {
    status?: string;
    mode?: string;
    intent_slug?: string;
    project_slug?: string;
    include_archived?: boolean;
  } = {}): Promise<readonly RuntimeExecution[]> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filter)) {
      if (typeof value === 'string' && value.length > 0) query.set(key, value);
      if (typeof value === 'boolean') query.set(key, String(value));
    }
    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    const response = await this.services.request<{ executions: RuntimeExecution[] }>(
      'GET',
      `/api/executions${suffix}`,
    );
    return response.executions;
  }

  async getExecution(id: string): Promise<RuntimeExecutionDetail> {
    return this.services.request('GET', `/api/executions/${encodeURIComponent(id)}`);
  }

  async approveExecution(id: string): Promise<{ execution: RuntimeExecution }> {
    return this.services.request('POST', `/api/executions/${encodeURIComponent(id)}/approve`, {});
  }

  async cancelExecution(id: string): Promise<{ execution: RuntimeExecution }> {
    return this.services.request('POST', `/api/executions/${encodeURIComponent(id)}/cancel`, {});
  }

  async listProposals(filter: {
    status?: string;
    intent_id?: string;
  } = {}): Promise<readonly RuntimeProposal[]> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filter)) {
      if (typeof value === 'string' && value.length > 0) query.set(key, value);
    }
    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    const response = await this.services.request<{ proposals: RuntimeProposal[] }>(
      'GET',
      `/api/proposals${suffix}`,
    );
    return response.proposals;
  }

  async getProposal(id: string): Promise<RuntimeProposal> {
    const response = await this.services.request<{ proposal: RuntimeProposal }>(
      'GET',
      `/api/proposals/${encodeURIComponent(id)}`,
    );
    return response.proposal;
  }

  async approveProposal(
    id: string,
    input: { actor_id?: string } = {},
  ): Promise<{ proposal: RuntimeProposal }> {
    return this.services.request(
      'POST',
      `/api/proposals/${encodeURIComponent(id)}/approve`,
      input,
    );
  }

  async rejectProposal(
    id: string,
    input: { actor_id: string; reason: string },
  ): Promise<{ proposal: RuntimeProposal }> {
    return this.services.request(
      'POST',
      `/api/proposals/${encodeURIComponent(id)}/reject`,
      input,
    );
  }

  async startExecutionFromProposal(
    id: string,
    input: {
      title?: string;
      objective?: string | null;
      mode?: string;
      requires_approval?: boolean;
      project_slug?: string | null;
      space_id?: string | null;
    } = {},
  ): Promise<{ execution: RuntimeExecution }> {
    return this.services.request(
      'POST',
      `/api/proposals/${encodeURIComponent(id)}/executions`,
      input,
    );
  }

  async transitionExecutionPhase(
    id: string,
    input: {
      to: string;
      reason: string;
      summary?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<{
    execution: RuntimeExecution;
    transition: {
      from_phase: string | null;
      to_phase: string;
      reason: string;
      transitioned_at: string;
    };
  }> {
    return this.services.request('POST', `/api/executions/${encodeURIComponent(id)}/phase`, input);
  }

  async appendExecutionStep(
    id: string,
    input: { label: string; note?: string },
  ): Promise<{ execution: RuntimeExecution }> {
    return this.services.request('POST', `/api/executions/${encodeURIComponent(id)}/steps`, input);
  }

  async recordExecutionResult(
    id: string,
    input: {
      result_path: string;
      result_summary?: string | null;
      intent_status?: string;
      intent_phase?: string;
      intent_event?: string;
    },
  ): Promise<{ execution: RuntimeExecution }> {
    return this.services.request('POST', `/api/executions/${encodeURIComponent(id)}/result`, input);
  }

  async completeExecution(
    id: string,
    input: {
      result_summary?: string | null;
      result_path?: string;
      intent_status?: string;
      intent_phase?: string;
      intent_event?: string;
    } = {},
  ): Promise<{ execution: RuntimeExecution }> {
    return this.services.request('POST', `/api/executions/${encodeURIComponent(id)}/complete`, input);
  }

  async listTasks(filter: {
    project_id?: string;
    status?: string;
    priority?: string;
  } = {}): Promise<readonly RuntimeTask[]> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filter)) {
      if (typeof value === 'string' && value.length > 0) query.set(key, value);
    }
    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    const response = await this.services.request<{ tasks: RuntimeTask[] }>(
      'GET',
      `/api/tasks${suffix}`,
    );
    return response.tasks;
  }

  async getTask(id: string): Promise<RuntimeTask> {
    return this.services.request('GET', `/api/tasks/${encodeURIComponent(id)}`);
  }

  async transitionTask(id: string, input: { status: string }): Promise<RuntimeTask> {
    return this.services.request('POST', `/api/tasks/${encodeURIComponent(id)}/transition`, input);
  }
}
