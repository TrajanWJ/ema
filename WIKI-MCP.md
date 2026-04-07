# EMA Wiki MCP Server

MCP server exposing the EMA vault/wiki as tools for Claude Code and any MCP-compatible agent.

## Setup

### Prerequisites

```bash
cd daemon/priv/mcp
npm install
```

The EMA daemon must be running on `localhost:4488` (default).

### Add to Claude Code

Add to `~/.claude/settings.json` under `mcpServers`:

```json
{
  "mcpServers": {
    "ema-wiki": {
      "command": "node",
      "args": ["/home/trajan/Projects/ema/daemon/priv/mcp/wiki-mcp-server.js"],
      "env": {
        "EMA_BASE_URL": "http://localhost:4488"
      }
    }
  }
}

Recommended instead: use the launcher script so missing `node_modules` are installed automatically before the MCP server starts.

```json
{
  "mcpServers": {
    "ema-wiki": {
      "command": "/home/trajan/Projects/ema/daemon/bin/ema-wiki-mcp",
      "env": {
        "EMA_BASE_URL": "http://localhost:4488"
      }
    }
  }
}
```
```

### HTTP Mode (for agents)

```bash
node daemon/priv/mcp/wiki-mcp-server.js --http 4489
```

Health check: `GET http://localhost:4489/health`

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `EMA_BASE_URL` | `http://localhost:4488` | EMA daemon base URL |

## Tools

### wiki.search

Search the wiki by text query.

```
wiki.search({ query: "authentication", space: "projects", limit: 5 })
```

**Parameters:**
- `query` (string, required) — Search text
- `space` (string, optional) — Filter by space
- `limit` (number, optional) — Max results

**Returns:** `{ count, notes: [{ id, file_path, title, space, tags, ... }] }`

### wiki.get

Get a specific note by path, including full content.

```
wiki.get({ path: "projects/ema.md" })
```

**Parameters:**
- `path` (string, required) — Note file path

**Returns:** `{ note: { id, file_path, title, ... }, content: "..." }`

### wiki.create

Create a new note in the vault.

```
wiki.create({
  path: "projects/new-feature.md",
  title: "New Feature Design",
  content: "# New Feature\n\nDesign notes...",
  space: "projects",
  tags: ["design", "feature"]
})
```

**Parameters:**
- `path` (string, required) — File path for the note
- `title` (string, required) — Note title
- `content` (string, required) — Markdown content
- `space` (string, optional) — Space/category (auto-detected from path if omitted)
- `tags` (string[], optional) — Tags

**Returns:** `{ note: { id, file_path, title, ... } }`

### wiki.update

Update an existing note's content.

```
wiki.update({ path: "projects/ema.md", content: "# Updated content\n..." })
```

**Parameters:**
- `path` (string, required) — File path of the note
- `content` (string, required) — New markdown content

**Returns:** `{ note: { id, file_path, title, ... } }`

### wiki.gaps

Find knowledge gaps — orphan notes, low connectivity areas.

```
wiki.gaps()
```

**Parameters:** none

**Returns:** `{ orphan_count, orphans: [...], total_notes, total_links, connectivity }`

### wiki.related

Find notes linked to a given note via wikilinks.

```
wiki.related({ path: "projects/ema.md", limit: 10 })
```

**Parameters:**
- `path` (string, required) — File path of the source note
- `limit` (number, optional) — Max related notes

**Returns:** `{ count, related: [{ id, file_path, title, ... }] }`

### wiki.graph

Get the full knowledge graph (nodes + edges).

```
wiki.graph()
```

**Parameters:**
- `depth` (number, optional) — Not yet supported, returns full graph

**Returns:** `{ nodes, edges, graph: { nodes: [...], edges: [...] } }`

## Self-Test

```bash
node daemon/priv/mcp/wiki-mcp-server.js --test
```

Prints capabilities JSON and exits 0 if the server loads correctly.

## Architecture

```
Claude Code / Agent
  ↕ MCP (stdio or HTTP)
wiki-mcp-server.js
  ↕ HTTP REST
EMA Daemon (localhost:4488)
  ↕ Ecto
SQLite + Vault filesystem
```

The MCP server is a thin proxy — it translates MCP tool calls into REST API calls to the EMA daemon. The daemon owns all business logic, persistence, and the vault filesystem.
