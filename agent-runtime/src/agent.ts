import Anthropic from "@anthropic-ai/sdk";
import type { ContentBlock, MessageParam, ToolResultBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { v4 as uuid } from "uuid";
import { executeTool, filterTools } from "./tools.js";
import type { AgentEvent, AgentResult, AgentTask, ToolCall } from "./types.js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function emitFactory(taskId: string, onEvent: (event: AgentEvent) => void) {
  return (type: AgentEvent["type"], content: string, toolCall?: ToolCall) => {
    const event: AgentEvent = {
      taskId,
      type,
      content,
      toolCall,
      timestamp: Date.now()
    };
    onEvent(event);
    return event;
  };
}

export function buildSystemPrompt(task: AgentTask) {
  return [
    "You are an autonomous agent inside HQ, a personal workspace OS.",
    `Task title: ${task.title}`,
    `Project ID: ${task.projectId || "(none)"}`,
    `Project path: ${task.projectPath || "(none)"}`,
    `Context: ${task.context || "(none provided)"}`,
    `Maximum turns: ${task.maxTurns || 20}`,
    "Rules:",
    "1. Use the think tool first before any other action.",
    "2. Take real actions with tools instead of only describing intended work.",
    "3. Verify any claimed file, command, or service change.",
    "4. Keep progress concise and end with a clear final summary."
  ].join("\n");
}

export async function runAgent(
  task: AgentTask,
  onEvent: (event: AgentEvent) => void,
  shouldStop?: () => boolean
): Promise<AgentResult> {
  const startedAt = Date.now();
  const emit = emitFactory(task.id, onEvent);
  const events: AgentEvent[] = [];
  const toolCalls: ToolCall[] = [];
  const pushEvent = (event: AgentEvent) => {
    events.push(event);
    onEvent(event);
  };
  const push = (type: AgentEvent["type"], content: string, toolCall?: ToolCall) =>
    events.push(emit(type, content, toolCall));

  push("start", `Starting task: ${task.title}`);

  const messages: MessageParam[] = [{ role: "user", content: task.instruction }];
  const model = task.model || "claude-opus-4-6";
  const maxTurns = task.maxTurns || 20;
  let finalSummary = "";

  try {
    for (let turn = 0; turn < maxTurns; turn += 1) {
      if (shouldStop?.()) {
        push("error", "Task cancelled");
        return {
          taskId: task.id,
          status: "failed",
          summary: "Task cancelled",
          toolCalls,
          events,
          startedAt,
          endedAt: Date.now(),
          ms: Date.now() - startedAt
        };
      }

      push("progress", `Turn ${turn + 1} of ${maxTurns}`);

      const response = await client.messages.create({
        model,
        max_tokens: 4096,
        system: buildSystemPrompt(task),
        tools: filterTools(task.tools),
        messages
      });

      const assistantContent = response.content as ContentBlock[];
      messages.push({ role: "assistant", content: assistantContent });

      const toolResults: ToolResultBlockParam[] = [];

      for (const block of assistantContent) {
        if (block.type === "text") {
          finalSummary = block.text;
          push("thinking", block.text);
          continue;
        }

        if (block.type === "tool_use") {
          const toolName = block.name as AgentTask["tools"][number];
          const input = (block.input ?? {}) as Record<string, unknown>;
          const started = Date.now();
          const toolCall: ToolCall = {
            id: uuid(),
            tool: toolName,
            input,
            output: null,
            error: null,
            ms: 0
          };

          push("tool_call", `Calling ${toolName}`, toolCall);

          try {
            const output = await executeTool(toolName, input, task.projectPath);
            toolCall.output = output;
            toolCall.ms = Date.now() - started;
            toolCalls.push(toolCall);
            push("tool_result", `${toolName} completed`, toolCall);

            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: output,
              is_error: false
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            toolCall.error = message;
            toolCall.ms = Date.now() - started;
            toolCalls.push(toolCall);
            push("tool_result", `${toolName} failed: ${message}`, toolCall);

            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: message,
              is_error: true
            });
          }
        }
      }

      if (response.stop_reason === "end_turn") {
        push("complete", finalSummary || "Task completed");
        return {
          taskId: task.id,
          status: "completed",
          summary: finalSummary || "Task completed",
          toolCalls,
          events,
          startedAt,
          endedAt: Date.now(),
          ms: Date.now() - startedAt
        };
      }

      if (response.stop_reason === "tool_use") {
        messages.push({ role: "user", content: toolResults });
        continue;
      }

      push("error", `Unexpected stop reason: ${String(response.stop_reason)}`);
      break;
    }

    push("error", `Max turns reached (${maxTurns})`);
    return {
      taskId: task.id,
      status: "failed",
      summary: finalSummary || `Max turns reached (${maxTurns})`,
      toolCalls,
      events,
      startedAt,
      endedAt: Date.now(),
      ms: Date.now() - startedAt
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    push("error", message);
    return {
      taskId: task.id,
      status: "failed",
      summary: message,
      toolCalls,
      events,
      startedAt,
      endedAt: Date.now(),
      ms: Date.now() - startedAt
    };
  }
}
