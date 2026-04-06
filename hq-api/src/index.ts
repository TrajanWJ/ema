import cors from "cors";
import express from "express";
import http from "node:http";
import { v4 as uuid } from "uuid";
import { WebSocketServer, WebSocket } from "ws";
import { db } from "./db.js";

type JsonRecord = Record<string, unknown>;

const AGENT_URL = process.env.AGENT_URL || "http://localhost:3001";
const AGENT_WS = process.env.AGENT_WS || "ws://localhost:3001";
const SUPERMAN_URL = process.env.SUPERMAN_URL || "http://localhost:3000";
const PORT = Number(process.env.PORT || 3002);

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const hqClients = new Set<WebSocket>();
const startedAt = Date.now();

interface NoteRow {
  id: string;
  title: string | null;
  content: string | null;
}

interface BrainDumpRow {
  id: string;
  project_id: string | null;
  status: string;
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function broadcastToHQ(payload: unknown) {
  const data = JSON.stringify(payload);
  for (const client of hqClients) {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  }
}

function getProjectById(id: string) {
  return db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as Record<string, unknown> | undefined;
}

async function syncExecutionFromAgent(taskId: string) {
  try {
    const [taskRes, eventsRes] = await Promise.all([
      fetch(`${AGENT_URL}/tasks/${taskId}`, { signal: AbortSignal.timeout(5_000) }),
      fetch(`${AGENT_URL}/tasks/${taskId}/events`, { signal: AbortSignal.timeout(5_000) })
    ]);

    if (!taskRes.ok || !eventsRes.ok) return;

    const taskData = (await taskRes.json()) as {
      status: string;
      result?: { summary?: string; ms?: number; endedAt?: number; toolCalls?: unknown[] };
      startedAt?: number;
    };
    const events = ((await eventsRes.json()) as unknown[]).slice(-50);

    db.prepare(`
      UPDATE executions
      SET status = ?,
          summary = ?,
          ended_at = ?,
          ms = ?,
          tool_calls = ?,
          events = ?
      WHERE id = ?
    `).run(
      taskData.status,
      taskData.result?.summary || null,
      taskData.result?.endedAt || null,
      taskData.result?.ms || null,
      JSON.stringify(taskData.result?.toolCalls || []),
      JSON.stringify(events),
      taskId
    );

    broadcastToHQ({ channel: "execution_updated", taskId, status: taskData.status });
  } catch {
    return;
  }
}

function connectToAgentRuntime() {
  try {
    const ws = new WebSocket(AGENT_WS);

    ws.on("open", () => {
      ws.send(JSON.stringify({ type: "subscribe", taskId: "*" }));
    });

    ws.on("message", (raw) => {
      try {
        const parsed = JSON.parse(raw.toString()) as JsonRecord;
        if (parsed.type === "subscribed") return;
        broadcastToHQ({ channel: "agent_event", ...parsed });
        if (parsed.type === "complete" || parsed.type === "error") {
          const taskId = typeof parsed.taskId === "string" ? parsed.taskId : "";
          if (taskId) void syncExecutionFromAgent(taskId);
        }
      } catch {
        return;
      }
    });

    ws.on("close", () => {
      console.log("agent-runtime disconnected, retrying");
      setTimeout(connectToAgentRuntime, 3_000);
    });

    ws.on("error", () => {
      return;
    });
  } catch {
    setTimeout(connectToAgentRuntime, 5_000);
  }
}

setTimeout(connectToAgentRuntime, 2_000);

wss.on("connection", (ws) => {
  hqClients.add(ws);
  ws.on("close", () => {
    hqClients.delete(ws);
  });
});

app.get("/api/projects", (_req, res) => {
  const rows = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM executions WHERE project_id = p.id AND status = 'running') AS running_count,
      (SELECT COUNT(*) FROM executions WHERE project_id = p.id) AS total_executions,
      (SELECT MAX(created_at) FROM executions WHERE project_id = p.id) AS last_execution
    FROM projects p
    ORDER BY updated_at DESC
  `).all();
  res.json(rows);
});

app.post("/api/projects", (req, res) => {
  const { name, description, status, color, path: projectPath, superman_url } = req.body as JsonRecord;
  if (typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const id = uuid();
  db.prepare(`
    INSERT INTO projects (id, name, description, status, color, path, superman_url)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    name.trim(),
    typeof description === "string" ? description : null,
    typeof status === "string" ? status : "active",
    typeof color === "string" ? color : "#38bdf8",
    typeof projectPath === "string" ? projectPath : null,
    typeof superman_url === "string" ? superman_url : null
  );

  res.status(201).json(getProjectById(id));
});

app.get("/api/projects/:id", (req, res) => {
  const row = getProjectById(req.params.id);
  if (!row) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(row);
});

app.patch("/api/projects/:id", (req, res) => {
  const project = getProjectById(req.params.id);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const allowed = ["name", "description", "status", "color", "path", "superman_url"] as const;
  const sets: string[] = [];
  const values: unknown[] = [];

  for (const field of allowed) {
    if (field in req.body) {
      sets.push(`${field} = ?`);
      values.push(req.body[field]);
    }
  }

  if (sets.length === 0) {
    res.status(400).json({ error: "No valid fields provided" });
    return;
  }

  sets.push("updated_at = unixepoch()");
  values.push(req.params.id);
  db.prepare(`UPDATE projects SET ${sets.join(", ")} WHERE id = ?`).run(...values);
  res.json(getProjectById(req.params.id));
});

app.get("/api/projects/:id/context", async (req, res) => {
  const project = getProjectById(req.params.id);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  let superman: unknown = null;
  const baseUrl = (project.superman_url as string | null) || SUPERMAN_URL;

  try {
    const response = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(3_000) });
    superman = response.ok ? await response.json() : null;
  } catch {
    superman = null;
  }

  const resources = db.prepare("SELECT * FROM project_resources WHERE project_id = ? ORDER BY created_at DESC").all(req.params.id);
  const executions = db.prepare(`
    SELECT id, title, status, summary, agent_model, started_at, ended_at, ms
    FROM executions
    WHERE project_id = ?
    ORDER BY created_at DESC
    LIMIT 10
  `).all(req.params.id);
  const notes = db.prepare(`
    SELECT id, title, content, updated_at
    FROM notes
    WHERE project_id = ?
    ORDER BY updated_at DESC
    LIMIT 5
  `).all(req.params.id);
  const brainDump = db.prepare(`
    SELECT *
    FROM brain_dump
    WHERE project_id = ? AND status = 'unprocessed'
    ORDER BY created_at DESC
    LIMIT 10
  `).all(req.params.id);
  const stats = db.prepare(`
    SELECT
      COUNT(*) AS total_executions,
      COALESCE(SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END), 0) AS running,
      COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) AS completed,
      COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) AS failed
    FROM executions
    WHERE project_id = ?
  `).get(req.params.id);

  res.json({ project, resources, executions, notes, brainDump, superman, stats });
});

app.post("/api/projects/:id/resources", (req, res) => {
  const project = getProjectById(req.params.id);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const { type, label, url, config } = req.body as JsonRecord;
  if (typeof type !== "string" || typeof label !== "string" || !type || !label) {
    res.status(400).json({ error: "type and label are required" });
    return;
  }

  const id = uuid();
  db.prepare(`
    INSERT INTO project_resources (id, project_id, type, label, url, config)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, req.params.id, type, label, typeof url === "string" ? url : null, config ? JSON.stringify(config) : null);

  res.status(201).json(db.prepare("SELECT * FROM project_resources WHERE id = ?").get(id));
});

app.delete("/api/projects/:projectId/resources/:id", (req, res) => {
  db.prepare("DELETE FROM project_resources WHERE id = ? AND project_id = ?").run(req.params.id, req.params.projectId);
  res.json({ deleted: true });
});

app.get("/api/executions", (_req, res) => {
  const rows = db.prepare(`
    SELECT e.*, p.name AS project_name, p.color AS project_color
    FROM executions e
    LEFT JOIN projects p ON p.id = e.project_id
    ORDER BY e.created_at DESC
    LIMIT 50
  `).all();
  res.json(rows);
});

app.post("/api/executions/dispatch", async (req, res) => {
  const { title, instruction, projectId, tools, model, maxTurns, context } = req.body as JsonRecord;
  if (typeof title !== "string" || typeof instruction !== "string" || !title.trim() || !instruction.trim()) {
    res.status(400).json({ error: "title and instruction are required" });
    return;
  }

  const project = typeof projectId === "string" ? getProjectById(projectId) : undefined;
  if (typeof projectId === "string" && !project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const executionId = uuid();
  db.prepare(`
    INSERT INTO executions (id, project_id, title, instruction, status, agent_model)
    VALUES (?, ?, ?, ?, 'pending', ?)
  `).run(executionId, projectId ?? null, title.trim(), instruction.trim(), typeof model === "string" ? model : null);

  try {
    const agentResponse = await fetch(`${AGENT_URL}/dispatch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: executionId,
        title,
        instruction,
        projectId,
        projectPath: (project?.path as string | undefined) || undefined,
        tools,
        model,
        maxTurns,
        context
      }),
      signal: AbortSignal.timeout(5_000)
    });

    if (!agentResponse.ok) {
      db.prepare("UPDATE executions SET status = 'failed', summary = ? WHERE id = ?").run("Agent dispatch failed", executionId);
      res.status(503).json({ error: "Agent unavailable" });
      return;
    }

    db.prepare("UPDATE executions SET status = 'running', started_at = unixepoch() WHERE id = ?").run(executionId);
    const execution = db.prepare("SELECT * FROM executions WHERE id = ?").get(executionId);
    broadcastToHQ({ channel: "execution_started", execution });
    res.status(201).json({ executionId, status: "dispatched" });
  } catch {
    db.prepare("UPDATE executions SET status = 'failed', summary = ? WHERE id = ?").run("Agent unavailable", executionId);
    res.status(503).json({ error: "Agent unavailable" });
  }
});

app.get("/api/executions/:id", (req, res) => {
  const row = db.prepare(`
    SELECT e.*, p.name AS project_name, p.color AS project_color
    FROM executions e
    LEFT JOIN projects p ON p.id = e.project_id
    WHERE e.id = ?
  `).get(req.params.id);
  if (!row) {
    res.status(404).json({ error: "Execution not found" });
    return;
  }
  res.json(row);
});

app.get("/api/projects/:id/notes", (req, res) => {
  res.json(
    db.prepare("SELECT * FROM notes WHERE project_id = ? ORDER BY updated_at DESC").all(req.params.id)
  );
});

app.post("/api/projects/:id/notes", (req, res) => {
  const project = getProjectById(req.params.id);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const { title, content } = req.body as JsonRecord;
  const id = uuid();
  db.prepare(`
    INSERT INTO notes (id, project_id, title, content)
    VALUES (?, ?, ?, ?)
  `).run(id, req.params.id, typeof title === "string" ? title : null, typeof content === "string" ? content : null);
  res.status(201).json(db.prepare("SELECT * FROM notes WHERE id = ?").get(id));
});

app.patch("/api/notes/:id", (req, res) => {
  const note = db.prepare("SELECT * FROM notes WHERE id = ?").get(req.params.id) as NoteRow | undefined;
  if (!note) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  db.prepare(`
    UPDATE notes
    SET title = ?, content = ?, updated_at = unixepoch()
    WHERE id = ?
  `).run(
    typeof req.body.title === "string" ? req.body.title : note.title,
    typeof req.body.content === "string" ? req.body.content : note.content,
    req.params.id
  );

  res.json(db.prepare("SELECT * FROM notes WHERE id = ?").get(req.params.id));
});

app.get("/api/brain-dump", (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : null;
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : null;

  const clauses: string[] = [];
  const values: unknown[] = [];
  if (status) {
    clauses.push("status = ?");
    values.push(status);
  }
  if (projectId) {
    clauses.push("project_id = ?");
    values.push(projectId);
  }

  const rows = db.prepare(`
    SELECT *
    FROM brain_dump
    ${clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : ""}
    ORDER BY created_at DESC
  `).all(...values);

  res.json(rows);
});

app.post("/api/brain-dump", (req, res) => {
  const { projectId, content, tags } = req.body as JsonRecord;
  if (typeof content !== "string" || !content.trim()) {
    res.status(400).json({ error: "content is required" });
    return;
  }

  const id = uuid();
  db.prepare(`
    INSERT INTO brain_dump (id, project_id, content, tags)
    VALUES (?, ?, ?, ?)
  `).run(id, typeof projectId === "string" ? projectId : null, content.trim(), JSON.stringify(Array.isArray(tags) ? tags : []));

  const row = db.prepare("SELECT * FROM brain_dump WHERE id = ?").get(id);
  broadcastToHQ({ channel: "brain_dump_added", item: row });
  res.status(201).json(row);
});

app.patch("/api/brain-dump/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM brain_dump WHERE id = ?").get(req.params.id) as BrainDumpRow | undefined;
  if (!row) {
    res.status(404).json({ error: "Brain dump item not found" });
    return;
  }

  db.prepare(`
    UPDATE brain_dump
    SET status = ?, project_id = ?
    WHERE id = ?
  `).run(
    typeof req.body.status === "string" ? req.body.status : row.status,
    typeof req.body.project_id === "string" ? req.body.project_id : row.project_id,
    req.params.id
  );

  res.json(db.prepare("SELECT * FROM brain_dump WHERE id = ?").get(req.params.id));
});

app.all(/^\/api\/superman(\/.*)?$/, async (req, res) => {
  const suffix = typeof req.params[0] === "string" ? req.params[0] : "";
  const target = `${SUPERMAN_URL}${suffix}${req.url.includes("?") ? `?${req.url.split("?")[1]}` : ""}`;

  try {
    const response = await fetch(target, {
      method: req.method,
      headers: {
        "Content-Type": req.header("Content-Type") || "application/json"
      },
      body: ["GET", "HEAD"].includes(req.method) ? undefined : JSON.stringify(req.body),
      signal: AbortSignal.timeout(30_000)
    });

    const text = await response.text();
    const contentType = response.headers.get("content-type") || "application/json";
    res.status(response.status);
    res.setHeader("Content-Type", contentType);
    res.send(text);
  } catch {
    res.status(503).json({ error: "Superman unavailable" });
  }
});

app.get("/api/health", async (_req, res) => {
  const checks = await Promise.all([
    fetch(`${AGENT_URL}/health`, { signal: AbortSignal.timeout(2_000) })
      .then(async (r) => (r.ok ? await r.json() : { status: "offline" }))
      .catch(() => ({ status: "offline" })),
    fetch(`${SUPERMAN_URL}/api/health`, { signal: AbortSignal.timeout(2_000) })
      .then(async (r) => (r.ok ? await r.json() : { status: "offline" }))
      .catch(() => ({ status: "offline" }))
  ]);

  res.json({
    status: "ok",
    checks: {
      api: "ok",
      database: "ok",
      agent: checks[0],
      superman: checks[1]
    },
    uptime: (Date.now() - startedAt) / 1000
  });
});

server.listen(PORT, () => {
  console.log(`hq-api listening on http://localhost:${PORT}`);
});
