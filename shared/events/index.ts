export interface EmaEvent<T> {
  topic: string;
  event: string;
  payload: T;
  timestamp: string;
}

// --- Task Events ---

export type TaskEventName =
  | "task:created"
  | "task:updated"
  | "task:transitioned";

export interface TaskEventPayload {
  id: string;
  title: string;
  status: string;
  previous_status?: string;
}

export type TaskEvent = EmaEvent<TaskEventPayload> & {
  event: TaskEventName;
};

// --- Project Events ---

export type ProjectEventName = "project:created" | "project:updated";

export interface ProjectEventPayload {
  id: string;
  name: string;
  slug: string;
  status: string;
}

export type ProjectEvent = EmaEvent<ProjectEventPayload> & {
  event: ProjectEventName;
};

// --- Proposal Events ---

export type ProposalEventName =
  | "proposal:generated"
  | "proposal:refined"
  | "proposal:debated"
  | "proposal:tagged"
  | "proposal:approved"
  | "proposal:killed";

export interface ProposalEventPayload {
  id: string;
  title: string;
  status: string;
  confidence?: number | null;
}

export type ProposalEvent = EmaEvent<ProposalEventPayload> & {
  event: ProposalEventName;
};

// --- Intent Events ---

export type IntentEventName =
  | "intent:created"
  | "intent:updated"
  | "intent:linked";

export interface IntentEventPayload {
  id: string;
  title: string;
  level: string;
  status: string;
  parent_id?: string | null;
}

export type IntentEvent = EmaEvent<IntentEventPayload> & {
  event: IntentEventName;
};

// --- Agent Events ---

export type AgentEventName =
  | "agent:started"
  | "agent:stopped"
  | "agent:message";

export interface AgentEventPayload {
  id: string;
  slug: string;
  status: string;
  message?: string;
}

export type AgentEvent = EmaEvent<AgentEventPayload> & {
  event: AgentEventName;
};

// --- Union ---

export type DomainEvent =
  | TaskEvent
  | ProjectEvent
  | ProposalEvent
  | IntentEvent
  | AgentEvent;
