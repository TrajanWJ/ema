import http from "node:http";
import express from "express";
import { v4 as uuid } from "uuid";
import { WebSocketServer, WebSocket } from "ws";
import { runAgent } from "./agent.js";
import type { AgentEvent, AgentResult, AgentStatus, AgentTask, ToolName } from "./types.js";

interface StoredTask {
  task: AgentTask;
  status: AgentStatus;
  events: AgentEvent[];
  result: AgentResult | null;
  startedAt: number;
  cancelled: boolean;
}

const app = express();
app.use(express.json({ limit: "2mb" }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const port = Number(process.env.PORT || 3001);

const taskStore = new Map<string, StoredTask>();
const subscribers = new Map<string, Set<WebSocket>>();

function getSubscriberKeys(taskId: string) {
  return [taskId, "*"];
}

function safeSend(ws: WebSocket, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastEvent(event: AgentEvent) {
  for (const key of getSubscriberKeys(event.taskId)) {
    const set = subscribers.get(key);
    if (!set) continue;
    for (const ws of set) safeSend(ws, event);
  }
}

function addEvent(taskId: string, event: AgentEvent) {
  const entry = taskStore.get(taskId);
  if (!entry) return;
  entry.events.push(event);
  broadcastEvent(event);
}

function taskListEntry(entry: StoredTask) {
  return {
    taskId: entry.task.id,
    title: entry.task.title,
    status: entry.status,
    projectId: entry.task.projectId || null,
    startedAt: entry.startedAt,
    ms: entry.result?.ms ?? Date.now() - entry.startedAt
  };
}

wss.on("connection", (ws) => {
  const subscribed = new Set<string>();

  ws.on("message", (raw) => {
    try {
      const message = JSON.parse(raw.toString()) as { type?: string; taskId?: string };
      if (message.type !== "subscribe" || !message.taskId) return;

      const taskId = message.taskId;
      if (!subscribers.has(taskId)) subscribers.set(taskId, new Set());
      subscribers.get(taskId)?.add(ws);
      subscribed.add(taskId);

      if (taskId === "*") {
        for (const entry of [...taskStore.values()].sort((a, b) => a.startedAt - b.startedAt)) {
          for (const event of entry.events) safeSend(ws, event);
        }
      } else {
        const entry = taskStore.get(taskId);
        if (entry) {
          for (const event of entry.events) safeSend(ws, event);
        }
      }

      safeSend(ws, { type: "subscribed", taskId });
    } catch {
      safeSend(ws, { type: "error", message: "Invalid subscription payload" });
    }
  });

  ws.on("close", () => {
    for (const taskId of subscribed) {
      subscribers.get(taskId)?.delete(ws);
      if (subscribers.get(taskId)?.size === 0) subscribers.delete(taskId);
    }
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", tasks: taskStore.size, uptime: process.uptime() });
});

app.post("/dispatch", (req, res) => {
  const { title, instruction } = req.body as Partial<AgentTask>;
  if (!title || !instruction) {
    res.status(400).json({ error: "title and instruction are required" });
    return;
  }

  const task: AgentTask = {
    id: typeof req.body.id === "string" && req.body.id ? req.body.id : uuid(),
    title,
    instruction,
    projectId: req.body.projectId,
    projectPath: req.body.projectPath,
    tools: Array.isArray(req.body.tools) && req.body.tools.length > 0 ? (req.body.tools as ToolName[]) : ["think", "shell", "read_file", "write_file", "fetch_url", "superman"],
    model: req.body.model,
    maxTurns: typeof req.body.maxTurns === "number" ? req.body.maxTurns : 20,
    context: req.body.context
  };

  const stored: StoredTask = {
    task,
    status: "running",
    events: [],
    result: null,
    startedAt: Date.now(),
    cancelled: false
  };

  taskStore.set(task.id, stored);
  res.json({ taskId: task.id, status: "dispatched" });

  void runAgent(
    task,
    (event) => addEvent(task.id, event),
    () => Boolean(taskStore.get(task.id)?.cancelled)
  ).then((result) => {
    const entry = taskStore.get(task.id);
    if (!entry) return;
    if (entry.cancelled && result.status === "completed") {
      entry.status = "failed";
      entry.result = { ...result, status: "failed", summary: "Task cancelled" };
      return;
    }
    entry.status = result.status;
    entry.result = result;
  });
});

app.get("/tasks", (_req, res) => {
  const tasks = [...taskStore.values()]
    .sort((a, b) => b.startedAt - a.startedAt)
    .map(taskListEntry);
  res.json(tasks);
});

app.get("/tasks/:id", (req, res) => {
  const entry = taskStore.get(req.params.id);
  if (!entry) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.json({
    taskId: entry.task.id,
    task: entry.task,
    status: entry.status,
    events: entry.events,
    result: entry.result,
    startedAt: entry.startedAt
  });
});

app.get("/tasks/:id/events", (req, res) => {
  const entry = taskStore.get(req.params.id);
  if (!entry) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.json(entry.events);
});

app.post("/tasks/:id/cancel", (req, res) => {
  const entry = taskStore.get(req.params.id);
  if (!entry) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  entry.cancelled = true;
  entry.status = "failed";
  addEvent(req.params.id, {
    taskId: req.params.id,
    type: "error",
    content: "Task cancelled by user",
    timestamp: Date.now()
  });

  res.json({ cancelled: true });
});

server.listen(port, () => {
  console.log(`agent-runtime listening on http://localhost:${port}`);
});
