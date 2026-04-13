/**
 * Notification actions — contract stubs.
 * TODO(stream-4): wire `notify:desktop` to node-notifier or Electron,
 * and `notify:send` to the pubsub bridge / discord / telegram adapters.
 */

import { z } from "zod";
import type { ActionDef } from "../types.js";
import { emitPipeActionEvent, pipeLog } from "../voice.js";

const desktopInput = z.object({
  title: z.string().default("EMA"),
  body: z.string().default(""),
  urgency: z.enum(["low", "normal", "critical"]).default("normal"),
});

const desktopOutput = z.object({
  ok: z.literal(true),
  delivered: z.enum(["stub", "logged"]),
  stub: z.literal(true),
});

const logInput = z.object({
  message: z.string().default("pipe event"),
  level: z
    .enum([
      "emergency",
      "alert",
      "critical",
      "error",
      "warning",
      "notice",
      "info",
      "debug",
    ])
    .default("info"),
});

const logOutput = z.object({
  ok: z.literal(true),
  level: z.string(),
  stub: z.literal(true),
});

const sendInput = z.object({
  channel: z.enum(["pubsub", "discord", "telegram"]).default("pubsub"),
  target: z.string().optional(),
  message_template: z.string().default("{{content}}"),
});

const sendOutput = z.object({
  ok: z.literal(true),
  channel: z.string(),
  stub: z.literal(true),
});

export const notifyActions: readonly ActionDef[] = [
  {
    name: "notify:desktop",
    context: "notify",
    label: "Desktop Notification",
    description: "Send a desktop notification",
    inputSchema: desktopInput,
    outputSchema: desktopOutput,
    handler: async (raw, ctx) => {
      const input = desktopInput.parse(raw);
      emitPipeActionEvent(ctx, "notify:desktop", input);
      pipeLog(`notify:desktop ${input.title}: ${input.body}`);
      return {
        ok: true as const,
        delivered: "stub" as const,
        stub: true as const,
      };
    },
  },
  {
    name: "notify:log",
    context: "notify",
    label: "Log Message",
    description: "Write to system log",
    inputSchema: logInput,
    outputSchema: logOutput,
    handler: async (raw, ctx) => {
      const input = logInput.parse(raw);
      emitPipeActionEvent(ctx, "notify:log", input);
      pipeLog(`notify:log [${input.level}] ${input.message}`);
      return {
        ok: true as const,
        level: input.level,
        stub: true as const,
      };
    },
  },
  {
    name: "notify:send",
    context: "notify",
    label: "Send Notification",
    description: "Send a notification via discord, telegram, or pubsub",
    inputSchema: sendInput,
    outputSchema: sendOutput,
    handler: async (raw, ctx) => {
      const input = sendInput.parse(raw);
      emitPipeActionEvent(ctx, "notify:send", input);
      pipeLog(`notify:send channel=${input.channel}`);
      return {
        ok: true as const,
        channel: input.channel,
        stub: true as const,
      };
    },
  },
];
