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
  readonly inserted_at: string;
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
  readonly inserted_at: string;
}
