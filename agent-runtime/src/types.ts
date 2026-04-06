export type AgentStatus = "idle" | "running" | "completed" | "failed";

export type ToolName =
  | "shell"
  | "read_file"
  | "write_file"
  | "fetch_url"
  | "superman"
  | "think";

export interface ToolCall {
  id: string;
  tool: ToolName;
  input: Record<string, unknown>;
  output: string | null;
  error: string | null;
  ms: number;
}

export interface AgentTask {
  id: string;
  title: string;
  instruction: string;
  projectId?: string;
  projectPath?: string;
  tools: ToolName[];
  model?: string;
  maxTurns?: number;
  context?: string;
}

export interface AgentEvent {
  taskId: string;
  type:
    | "start"
    | "thinking"
    | "tool_call"
    | "tool_result"
    | "complete"
    | "error"
    | "progress";
  content: string;
  toolCall?: ToolCall;
  timestamp: number;
}

export interface AgentResult {
  taskId: string;
  status: "completed" | "failed";
  summary: string;
  toolCalls: ToolCall[];
  events: AgentEvent[];
  startedAt: number;
  endedAt: number;
  ms: number;
}
