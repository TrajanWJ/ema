#!/usr/bin/env node

/**
 * EMA Wiki MCP Server
 *
 * Exposes EMA's vault/wiki as MCP tools for Claude Code and any agent.
 * Supports dual transport: stdio (default) and HTTP (--http [port]).
 * Self-test: --test exits 0 and prints capabilities.
 */

import { createServer } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const EMA_BASE = process.env.EMA_BASE_URL || "http://localhost:4488";
const API = `${EMA_BASE}/api`;

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function apiGet(path, params = {}) {
  const url = new URL(path, API.endsWith("/") ? API : API + "/");
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GET ${url.pathname}${url.search} -> ${res.status}: ${body}`);
  }
  return res.json();
}

async function apiPost(path, body = {}) {
  const url = new URL(path, API.endsWith("/") ? API : API + "/");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`POST ${url.pathname} -> ${res.status}: ${text}`);
  }
  return res.json();
}

async function apiPut(path, body = {}) {
  const url = new URL(path, API.endsWith("/") ? API : API + "/");
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PUT ${url.pathname} -> ${res.status}: ${text}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

function ok(data) {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

function err(message) {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

// ---------------------------------------------------------------------------
// Server + Tools
// ---------------------------------------------------------------------------

function createWikiServer() {
  const server = new McpServer({
    name: "ema-wiki",
    version: "1.0.0",
  });

  // -- wiki.search ----------------------------------------------------------
  server.tool(
    "wiki.search",
    "Search the EMA wiki/vault by text query. Returns matching notes with metadata.",
    {
      query: z.string().describe("Search query text"),
      space: z.string().optional().describe("Filter by space (e.g. 'projects', 'personal')"),
      limit: z.number().optional().describe("Max results to return"),
    },
    async ({ query, space, limit }) => {
      try {
        const params = { q: query };
        if (space) params.space = space;
        const data = await apiGet("vault/search", params);
        const notes = data.notes || [];
        const limited = limit ? notes.slice(0, limit) : notes;
        return ok({ count: limited.length, notes: limited });
      } catch (e) {
        return err(e.message);
      }
    }
  );

  // -- wiki.get -------------------------------------------------------------
  server.tool(
    "wiki.get",
    "Get a specific wiki note by file path. Returns note metadata and full content.",
    {
      path: z.string().describe("Note file path (e.g. 'projects/ema.md')"),
    },
    async ({ path }) => {
      try {
        const data = await apiGet("vault/note", { path });
        return ok(data);
      } catch (e) {
        return err(e.message);
      }
    }
  );

  // -- wiki.create ----------------------------------------------------------
  server.tool(
    "wiki.create",
    "Create a new wiki note in the vault.",
    {
      path: z.string().describe("File path for the new note (e.g. 'projects/new-idea.md')"),
      title: z.string().describe("Note title"),
      content: z.string().describe("Note content (markdown)"),
      space: z.string().optional().describe("Space/category (auto-detected from path if omitted)"),
      tags: z.array(z.string()).optional().describe("Tags for the note"),
    },
    async ({ path, title, content, space, tags }) => {
      try {
        const data = await apiPut("vault/note", { path, title, content, space, tags });
        return ok(data);
      } catch (e) {
        return err(e.message);
      }
    }
  );

  // -- wiki.update ----------------------------------------------------------
  server.tool(
    "wiki.update",
    "Update an existing wiki note's content.",
    {
      path: z.string().describe("File path of the note to update"),
      content: z.string().describe("New content (markdown)"),
    },
    async ({ path, content }) => {
      try {
        const data = await apiPut("vault/note", { path, content });
        return ok(data);
      } catch (e) {
        return err(e.message);
      }
    }
  );

  // -- wiki.gaps ------------------------------------------------------------
  server.tool(
    "wiki.gaps",
    "Find knowledge gaps in the wiki — orphan notes, broken links, sparse areas.",
    {},
    async () => {
      try {
        const orphans = await apiGet("vault/graph/orphans");
        const graph = await apiGet("vault/graph");
        const nodes = graph.nodes || [];
        const edges = graph.edges || [];
        return ok({
          orphan_count: (orphans.notes || []).length,
          orphans: (orphans.notes || []).slice(0, 20),
          total_notes: nodes.length,
          total_links: edges.length,
          connectivity: nodes.length > 0
            ? (edges.length / nodes.length).toFixed(2)
            : "0",
        });
      } catch (e) {
        return err(e.message);
      }
    }
  );

  // -- wiki.related ---------------------------------------------------------
  server.tool(
    "wiki.related",
    "Find notes related to a given note by graph neighbors (linked via wikilinks).",
    {
      path: z.string().describe("File path of the note to find relations for"),
      limit: z.number().optional().describe("Max related notes to return"),
    },
    async ({ path, limit }) => {
      try {
        // First resolve path to note ID
        const noteData = await apiGet("vault/note", { path });
        const noteId = noteData.note?.id;
        if (!noteId) return err(`Note not found: ${path}`);
        const data = await apiGet(`vault/graph/neighbors/${noteId}`);
        const notes = data.notes || [];
        const limited = limit ? notes.slice(0, limit) : notes;
        return ok({ count: limited.length, related: limited });
      } catch (e) {
        return err(e.message);
      }
    }
  );

  // -- wiki.graph -----------------------------------------------------------
  server.tool(
    "wiki.graph",
    "Get the full wiki knowledge graph — all notes and their link relationships.",
    {
      depth: z.number().optional().describe("Not yet supported, returns full graph"),
    },
    async () => {
      try {
        const data = await apiGet("vault/graph");
        const nodes = data.nodes || [];
        const edges = data.edges || [];
        return ok({
          nodes: nodes.length,
          edges: edges.length,
          graph: { nodes: nodes.slice(0, 200), edges: edges.slice(0, 500) },
        });
      } catch (e) {
        return err(e.message);
      }
    }
  );

  return server;
}

// ---------------------------------------------------------------------------
// Transport modes
// ---------------------------------------------------------------------------

async function runStdio(server) {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

async function runHttp(server, port) {
  const httpServer = createServer(async (req, res) => {
    // CORS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Accept",
      });
      res.end();
      return;
    }

    // Health check
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", server: "ema-wiki-mcp" }));
      return;
    }

    // MCP over StreamableHTTP
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.setHeader("Access-Control-Allow-Origin", "*");
    await server.connect(transport);
    await transport.handleRequest(req, res);
  });

  httpServer.listen(port, () => {
    console.error(`[ema-wiki-mcp] HTTP transport listening on http://localhost:${port}`);
    console.error(`[ema-wiki-mcp] Health check: http://localhost:${port}/health`);
  });
}

// ---------------------------------------------------------------------------
// Self-test
// ---------------------------------------------------------------------------

async function selfTest() {
  const server = createWikiServer();
  const capabilities = {
    name: "ema-wiki",
    version: "1.0.0",
    transport: ["stdio", "http"],
    tools: [
      "wiki.search",
      "wiki.get",
      "wiki.create",
      "wiki.update",
      "wiki.gaps",
      "wiki.related",
      "wiki.graph",
    ],
    daemon: EMA_BASE,
  };

  console.log(JSON.stringify(capabilities, null, 2));
  process.exit(0);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

if (args.includes("--test")) {
  await selfTest();
} else if (args.includes("--http")) {
  const portIdx = args.indexOf("--http") + 1;
  const port = (portIdx < args.length && !args[portIdx].startsWith("-"))
    ? parseInt(args[portIdx], 10)
    : 4489;
  const server = createWikiServer();
  await runHttp(server, port);
} else {
  const server = createWikiServer();
  await runStdio(server);
}
