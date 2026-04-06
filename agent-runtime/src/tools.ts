import { exec as execCallback } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { ToolName } from "./types.js";

const execAsync = promisify(execCallback);
const SUPERMAN_URL = process.env.SUPERMAN_URL || "http://localhost:3000";

function truncate(value: string, limit: number, label = "[... truncated ...]") {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit)}\n${label}`;
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asHeadersInit(value: unknown): Record<string, string> {
  const input = asRecord(value);
  return Object.fromEntries(Object.entries(input).map(([key, entry]) => [key, String(entry)]));
}

export async function executeTool(
  tool: ToolName,
  input: Record<string, unknown>,
  projectPath?: string
): Promise<string> {
  switch (tool) {
    case "shell": {
      const command = asString(input.command);
      if (!command) throw new Error("shell tool requires input.command");

      const cwd = asString(input.cwd) || projectPath || process.cwd();
      const timeout = asNumber(input.timeout, 30_000);

      try {
        const { stdout, stderr } = await execAsync(command, { cwd, timeout, maxBuffer: 1024 * 1024 * 4 });
        return stdout || stderr || "(no output)";
      } catch (error) {
        const message =
          error instanceof Error && "stderr" in error
            ? String((error as Error & { stderr?: string }).stderr || error.message)
            : error instanceof Error
              ? error.message
              : String(error);
        throw new Error(message || "shell command failed");
      }
    }

    case "read_file": {
      const filePath = asString(input.path);
      if (!filePath) throw new Error("read_file requires input.path");
      const content = await readFile(filePath, "utf8");
      return truncate(content, 50_000);
    }

    case "write_file": {
      const filePath = asString(input.path);
      const content = asString(input.content);
      if (!filePath) throw new Error("write_file requires input.path");
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, content, "utf8");
      return `Written ${content.length} chars to ${filePath}`;
    }

    case "fetch_url": {
      const url = asString(input.url);
      if (!url) throw new Error("fetch_url requires input.url");

      const response = await fetch(url, {
        method: asString(input.method, "GET"),
        headers: asHeadersInit(input.headers),
        body:
          typeof input.body === "string"
            ? input.body
            : input.body == null
              ? undefined
              : JSON.stringify(input.body),
        signal: AbortSignal.timeout(15_000)
      });

      const text = await response.text();
      return truncate(text, 20_000);
    }

    case "superman": {
      const endpoint = asString(input.endpoint);
      if (!endpoint) throw new Error("superman requires input.endpoint");
      const normalized = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

      const response = await fetch(`${SUPERMAN_URL}${normalized}`, {
        method: asString(input.method, "GET"),
        headers: {
          "Content-Type": "application/json",
          ...asHeadersInit(input.headers)
        },
        body:
          input.body == null
            ? undefined
            : typeof input.body === "string"
              ? input.body
              : JSON.stringify(input.body),
        signal: AbortSignal.timeout(60_000)
      });

      const text = await response.text();
      const data = text ? JSON.parse(text) : null;
      return JSON.stringify(data, null, 2);
    }

    case "think": {
      return `Thinking recorded: ${asString(input.reasoning, "(none)")}`;
    }
  }
}

export const TOOL_DEFINITIONS = [
  {
    name: "think",
    description:
      "Use first on every task to record a concrete plan, assumptions, and next action. This tool has no side effects.",
    input_schema: {
      type: "object",
      properties: {
        reasoning: { type: "string", description: "Short internal reasoning note and plan." }
      },
      required: ["reasoning"]
    }
  },
  {
    name: "shell",
    description:
      "Run a real shell command in the target workspace. Use for builds, tests, grep, git inspection, and file-system operations that are easier as commands.",
    input_schema: {
      type: "object",
      properties: {
        command: { type: "string" },
        cwd: { type: "string" },
        timeout: { type: "number" }
      },
      required: ["command"]
    }
  },
  {
    name: "read_file",
    description: "Read a UTF-8 file from disk. Use when you need exact file contents before editing or summarizing.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string" }
      },
      required: ["path"]
    }
  },
  {
    name: "write_file",
    description: "Write a UTF-8 file to disk, creating parent directories as needed. Use for concrete file creation or replacement.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string" }
      },
      required: ["path", "content"]
    }
  },
  {
    name: "fetch_url",
    description:
      "Fetch an HTTP endpoint directly. Use for generic web or local-service requests that are not specific to Superman IDE.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string" },
        method: { type: "string" },
        headers: { type: "object" },
        body: {}
      },
      required: ["url"]
    }
  },
  {
    name: "superman",
    description:
      "Call the sibling Superman IDE service without modifying it. Available endpoints include POST /index-repo, GET /project/*, GET /gaps, POST /query, POST /apply-changes, POST /simulate, POST /test-gen, GET /api/health, GET /api/security/scan, POST /intelligence/*, GET /experience/history, POST /autonomous/*, POST /intent-graph/*, POST /specs/*, GET /git-insights, POST /plan, GET /progress, and POST /auth/*.",
    input_schema: {
      type: "object",
      properties: {
        endpoint: { type: "string" },
        method: { type: "string" },
        headers: { type: "object" },
        body: {}
      },
      required: ["endpoint"]
    }
  }
] as const;

export function filterTools(allowed: ToolName[]) {
  const allowedSet = new Set(allowed);
  return TOOL_DEFINITIONS.filter((tool) => allowedSet.has(tool.name as ToolName));
}
