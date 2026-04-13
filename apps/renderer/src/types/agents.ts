export interface TrustScore {
  readonly score: number;
  readonly label: string;
  readonly color: string;
  readonly completion_rate: number;
  readonly avg_latency_ms: number;
  readonly error_count: number;
  readonly session_count: number;
  readonly days_active: number;
  readonly calculated_at: string;
}

export interface Agent {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string | null;
  readonly avatar: string | null;
  readonly status: "inactive" | "active" | "error";
  readonly model: string;
  readonly temperature: number;
  readonly max_tokens: number;
  readonly tools: string[];
  readonly project_id: string | null;
  readonly created_at: string;
  readonly trust_score?: TrustScore | null;
}

export interface AgentChannel {
  readonly id: string;
  readonly channel_type: "discord" | "telegram" | "webchat" | "api";
  readonly active: boolean;
  readonly status: string;
  readonly error_message: string | null;
}

export interface AgentMessage {
  readonly id: string;
  readonly role: "user" | "assistant" | "system" | "tool";
  readonly content: string;
  readonly tool_calls: unknown[];
  readonly created_at: string;
}
