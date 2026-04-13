import { execFile } from "node:child_process";
import type { Worker } from "../src/worker-manager.js";

interface AgentMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface ClaudeResponse {
  result: string;
  cost_usd?: number;
  duration_ms?: number;
}

/**
 * AgentWorker manages a single agent's lifecycle:
 * - Receives messages and maintains conversation history
 * - Calls Claude CLI for responses
 * - Compresses history when it grows too large
 */
class AgentWorker {
  readonly agentId: string;
  private history: AgentMessage[] = [];
  private active = false;

  constructor(agentId: string) {
    this.agentId = agentId;
  }

  async start(): Promise<void> {
    this.active = true;
    this.history = [];
  }

  async stop(): Promise<void> {
    this.active = false;
    this.history = [];
  }

  async sendMessage(content: string): Promise<string> {
    if (!this.active) {
      throw new Error(`Agent ${this.agentId} is not active`);
    }

    this.history.push({
      role: "user",
      content,
      timestamp: Date.now(),
    });

    const response = await this.callClaude(content);

    this.history.push({
      role: "assistant",
      content: response.result,
      timestamp: Date.now(),
    });

    // Compress if history is getting long
    if (this.history.length > 20) {
      await this.compressHistory();
    }

    return response.result;
  }

  private callClaude(prompt: string): Promise<ClaudeResponse> {
    return new Promise((resolve, reject) => {
      const start = Date.now();

      execFile(
        "claude",
        ["--print", "--output-format", "json", "-p", prompt],
        { timeout: 120_000, maxBuffer: 10 * 1024 * 1024 },
        (error, stdout) => {
          if (error) {
            reject(new Error(`Claude CLI error: ${error.message}`));
            return;
          }

          try {
            const parsed = JSON.parse(stdout) as { result?: string };
            resolve({
              result: parsed.result ?? stdout,
              duration_ms: Date.now() - start,
            });
          } catch {
            // If JSON parsing fails, treat stdout as plain text
            resolve({
              result: stdout.trim(),
              duration_ms: Date.now() - start,
            });
          }
        },
      );
    });
  }

  private async compressHistory(): Promise<void> {
    // Stub: summarize older messages and replace with summary
    const cutoff = Math.floor(this.history.length / 2);
    const oldMessages = this.history.slice(0, cutoff);
    const summary = oldMessages.map((m) => `[${m.role}] ${m.content.slice(0, 50)}`).join("; ");

    this.history = [
      { role: "assistant", content: `[Summary] ${summary}`, timestamp: Date.now() },
      ...this.history.slice(cutoff),
    ];
  }
}

export function createAgentWorker(agentId: string): Worker {
  const agent = new AgentWorker(agentId);

  return {
    name: `agent-${agentId}`,

    async start(): Promise<void> {
      await agent.start();
    },

    async stop(): Promise<void> {
      await agent.stop();
    },
  };
}
