#!/usr/bin/env node
// EMA Blueprint Planner — Bootstrap v0.2-preview
// Live read-only dashboard for the ema-genesis/ graph.
// Zero dependencies — plain Node.js stdlib only.
//
// Run:  node /home/trajan/Projects/ema/blueprint/server.js
// Open: http://localhost:7777
//
// Reads ema-genesis/ live on every request. Edit a file, refresh, see it.

const http = require("http");
const fs = require("fs/promises");
const fsSync = require("fs");
const path = require("path");
const url = require("url");
const vapp = require("./vapp.js");

const GENESIS_ROOT = "/home/trajan/Projects/ema/ema-genesis";
const PORT = parseInt(process.env.EMA_BLUEPRINT_PORT || "7777", 10);
const HOST = "127.0.0.1";

// ──────────────────────────────────────────────────────────────────────
// YAML frontmatter parser (naive — handles flat key:value + simple lists)
// ──────────────────────────────────────────────────────────────────────

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, content };
  const yaml = match[1];
  const body = match[2];
  const data = {};
  let currentKey = null;
  let currentList = null;

  const lines = yaml.split(/\r?\n/);
  for (const raw of lines) {
    if (!raw.trim()) {
      currentList = null;
      continue;
    }
    // list item under a key
    if (raw.match(/^\s+-\s/) && currentKey) {
      if (!currentList) {
        currentList = [];
        data[currentKey] = currentList;
      }
      currentList.push(raw.replace(/^\s+-\s/, "").trim());
      continue;
    }
    // key: value
    const kv = raw.match(/^([a-zA-Z_][a-zA-Z0-9_-]*):\s*(.*)$/);
    if (kv) {
      const key = kv[1];
      let value = kv[2].trim();
      if (value === "") {
        currentKey = key;
        currentList = null;
        continue;
      }
      // strip quotes
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      data[key] = value;
      currentKey = key;
      currentList = null;
    }
  }
  return { data, content: body };
}

// ──────────────────────────────────────────────────────────────────────
// Loaders — read from ema-genesis/ on every request (no cache)
// ──────────────────────────────────────────────────────────────────────

async function safeReaddir(dir) {
  try {
    return await fs.readdir(dir, { withFileTypes: true });
  } catch (e) {
    return [];
  }
}

async function loadCanonDecisions() {
  const dir = path.join(GENESIS_ROOT, "canon/decisions");
  const files = await safeReaddir(dir);
  const decisions = [];
  for (const f of files) {
    if (!f.isFile() || !f.name.endsWith(".md")) continue;
    try {
      const content = await fs.readFile(path.join(dir, f.name), "utf-8");
      const { data } = parseFrontmatter(content);
      decisions.push({
        filename: f.name,
        id: data.id || f.name.replace(".md", ""),
        title: data.title || f.name,
        status: data.status || "unknown",
        subtype: data.subtype || "",
        decided_by: data.decided_by || "",
      });
    } catch (e) {}
  }
  return decisions.sort((a, b) => a.id.localeCompare(b.id));
}

async function loadGACCards() {
  const dir = path.join(GENESIS_ROOT, "intents");
  const entries = await safeReaddir(dir);
  const cards = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("GAC-")) continue;
    const readmePath = path.join(dir, entry.name, "README.md");
    try {
      const content = await fs.readFile(readmePath, "utf-8");
      const { data, content: body } = parseFrontmatter(content);
      cards.push({
        dir: entry.name,
        id: data.id || entry.name,
        title: data.title || entry.name,
        status: data.status || "pending",
        priority: data.priority || "unknown",
        category: data.category || "unknown",
        resolution: data.resolution || "",
        answered_at: data.answered_at || "",
        body, // full markdown body — parsed by vapp.js for GAC Queue rendering
        parsed: vapp.parseGACCardBody(body), // structured options/context/recommendation
      });
    } catch (e) {}
  }
  return cards.sort((a, b) => a.id.localeCompare(b.id));
}

async function loadResearchStats() {
  const dir = path.join(GENESIS_ROOT, "research");
  const entries = await safeReaddir(dir);
  const stats = { categories: {}, total: 0 };
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith("_")) continue;
    const catDir = path.join(dir, entry.name);
    const files = await safeReaddir(catDir);
    const mdFiles = files.filter(
      (f) => f.isFile() && f.name.endsWith(".md") && !f.name.startsWith("_")
    );
    stats.categories[entry.name] = mdFiles.length;
    stats.total += mdFiles.length;
  }
  return stats;
}

async function loadExtractionStats() {
  const dir = path.join(GENESIS_ROOT, "research/_extractions");
  const files = await safeReaddir(dir);
  const mdFiles = files.filter(
    (f) => f.isFile() && f.name.endsWith(".md") && !f.name.startsWith("_")
  );
  return { count: mdFiles.length };
}

async function loadCloneStats() {
  const dir = path.join(GENESIS_ROOT, "research/_clones");
  const entries = await safeReaddir(dir);
  const dirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith("."));
  return { count: dirs.length, names: dirs.map((e) => e.name).sort() };
}

async function loadSchematic() {
  try {
    return await fs.readFile(
      path.join(GENESIS_ROOT, "SCHEMATIC-v0.md"),
      "utf-8"
    );
  } catch (e) {
    return "";
  }
}

async function loadCanonStatus() {
  try {
    return await fs.readFile(
      path.join(GENESIS_ROOT, "_meta/CANON-STATUS.md"),
      "utf-8"
    );
  } catch (e) {
    return "";
  }
}

async function loadFileContent(relPath) {
  try {
    const absPath = path.join(GENESIS_ROOT, relPath);
    // prevent directory traversal
    if (!absPath.startsWith(GENESIS_ROOT)) return null;
    return await fs.readFile(absPath, "utf-8");
  } catch (e) {
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────
// HTML rendering — inline CSS, dark theme, zero JS (except meta refresh)
// ──────────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Very minimal markdown → HTML: handles headers, lists, code blocks, bold, inline code
function renderMarkdownLite(md) {
  if (!md) return "";
  let html = escapeHtml(md);

  // Code blocks (```...```)
  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (_, lang, code) => `<pre class="code"><code>${code}</code></pre>`
  );

  // Headers
  html = html.replace(/^######\s+(.+)$/gm, "<h6>$1</h6>");
  html = html.replace(/^#####\s+(.+)$/gm, "<h5>$1</h5>");
  html = html.replace(/^####\s+(.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^##\s+(.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^#\s+(.+)$/gm, "<h1>$1</h1>");

  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Wikilinks → just render as text-colored
  html = html.replace(
    /\[\[([^\]]+)\]\]/g,
    '<span class="wikilink">[[$1]]</span>'
  );

  // Bullet lists (very naive — just one level)
  html = html.replace(/^[\s]*[-*]\s+(.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>");

  // Paragraph breaks on blank lines
  html = html.replace(/\n\n+/g, "</p><p>");
  html = "<p>" + html + "</p>";
  html = html.replace(/<p>\s*(<h\d>)/g, "$1");
  html = html.replace(/(<\/h\d>)\s*<\/p>/g, "$1");
  html = html.replace(/<p>\s*(<pre)/g, "$1");
  html = html.replace(/(<\/pre>)\s*<\/p>/g, "$1");
  html = html.replace(/<p>\s*(<ul)/g, "$1");
  html = html.replace(/(<\/ul>)\s*<\/p>/g, "$1");

  return html;
}

const STYLE = `
* { box-sizing: border-box; }
body {
  background: #060610;
  color: rgba(255,255,255,0.87);
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  margin: 0;
  padding: 0;
  line-height: 1.5;
  font-size: 14px;
}
header.hero {
  background: linear-gradient(180deg, #0E1017 0%, #060610 100%);
  border-bottom: 1px solid rgba(255,255,255,0.08);
  padding: 24px 32px;
  position: sticky;
  top: 0;
  z-index: 10;
  backdrop-filter: blur(8px);
}
header.hero h1 {
  font-size: 20px;
  margin: 0 0 4px 0;
  font-weight: 600;
  color: #E5E7EB;
}
header.hero .subtitle {
  color: rgba(255,255,255,0.40);
  font-size: 12px;
  font-family: ui-monospace, "JetBrains Mono", monospace;
}
header.hero .stats {
  display: flex;
  gap: 20px;
  margin-top: 14px;
  flex-wrap: wrap;
}
header.hero .stat {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  padding: 10px 16px;
  border-radius: 6px;
  min-width: 100px;
}
header.hero .stat-label {
  font-size: 10px;
  text-transform: uppercase;
  color: rgba(255,255,255,0.40);
  letter-spacing: 0.05em;
  font-weight: 600;
}
header.hero .stat-value {
  font-size: 22px;
  font-weight: 700;
  color: #14B8A6;
  font-family: ui-monospace, monospace;
  margin-top: 2px;
}
main {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px 32px 80px;
}
section {
  margin-bottom: 40px;
}
section h2 {
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.40);
  border-bottom: 1px solid rgba(255,255,255,0.08);
  padding-bottom: 8px;
  margin-bottom: 16px;
  font-weight: 600;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
table th, table td {
  text-align: left;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  vertical-align: top;
}
table th {
  font-size: 11px;
  text-transform: uppercase;
  color: rgba(255,255,255,0.40);
  letter-spacing: 0.05em;
  font-weight: 600;
  background: rgba(255,255,255,0.02);
}
table td.id { font-family: ui-monospace, monospace; color: #14B8A6; font-weight: 600; }
table td.status-locked { color: #14B8A6; }
table td.status-answered { color: #14B8A6; }
table td.status-pending { color: #F59E0B; }
table td.status-draft { color: rgba(255,255,255,0.40); }
.priority-critical { color: #EF4444; font-weight: 600; }
.priority-high { color: #F59E0B; font-weight: 600; }
.priority-medium { color: #3B82F6; }
.priority-low { color: rgba(255,255,255,0.40); }
.resolution { font-family: ui-monospace, monospace; color: rgba(255,255,255,0.60); font-size: 11px; }
details {
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px;
  padding: 12px 16px;
  margin-bottom: 8px;
}
details summary {
  cursor: pointer;
  font-weight: 600;
  color: rgba(255,255,255,0.87);
  outline: none;
  user-select: none;
}
details[open] summary {
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.md-content {
  font-size: 13px;
  color: rgba(255,255,255,0.75);
}
.md-content h1 { font-size: 18px; margin: 16px 0 8px 0; color: #E5E7EB; }
.md-content h2 { font-size: 16px; margin: 14px 0 6px 0; color: #E5E7EB; }
.md-content h3 { font-size: 14px; margin: 12px 0 4px 0; color: #E5E7EB; }
.md-content code {
  background: rgba(255,255,255,0.06);
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 12px;
  font-family: ui-monospace, monospace;
}
.md-content pre.code {
  background: #0A0C14;
  border: 1px solid rgba(255,255,255,0.08);
  padding: 12px;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 12px;
  font-family: ui-monospace, monospace;
  margin: 8px 0;
}
.md-content pre.code code {
  background: transparent;
  padding: 0;
}
.md-content .wikilink {
  color: #14B8A6;
  font-weight: 500;
}
.md-content ul { padding-left: 20px; }
.md-content li { margin-bottom: 2px; }
.schematic-pre {
  background: #0A0C14;
  border: 1px solid rgba(255,255,255,0.08);
  padding: 16px;
  border-radius: 6px;
  font-family: ui-monospace, "JetBrains Mono", monospace;
  font-size: 11px;
  line-height: 1.4;
  overflow-x: auto;
  white-space: pre;
  color: rgba(255,255,255,0.75);
}
.category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}
.category-card {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  padding: 14px 16px;
  border-radius: 6px;
}
.category-card .cat-name {
  font-family: ui-monospace, monospace;
  font-size: 12px;
  color: rgba(255,255,255,0.60);
  margin-bottom: 4px;
}
.category-card .cat-count {
  font-size: 24px;
  font-weight: 700;
  color: #14B8A6;
  font-family: ui-monospace, monospace;
}
footer {
  border-top: 1px solid rgba(255,255,255,0.08);
  padding: 24px 32px;
  color: rgba(255,255,255,0.40);
  font-size: 11px;
  font-family: ui-monospace, monospace;
  background: #0A0C14;
  margin-top: 40px;
}
footer a { color: #14B8A6; text-decoration: none; }
footer a:hover { text-decoration: underline; }
.muted { color: rgba(255,255,255,0.40); }
`;

function renderDashboard(data) {
  const {
    decisions,
    gacCards,
    researchStats,
    extractionStats,
    cloneStats,
    schematic,
    genesisRoot,
    scannedAt,
  } = data;

  const answered = gacCards.filter((c) => c.status === "answered");
  const pending = gacCards.filter((c) => c.status !== "answered");
  const locked = decisions.filter((d) => d.status === "active");

  // stats bar
  const stats = [
    { label: "Canon decisions", value: decisions.length },
    { label: "GAC answered", value: answered.length },
    { label: "GAC open", value: pending.length },
    { label: "Research nodes", value: researchStats.total },
    { label: "Extractions", value: extractionStats.count },
    { label: "Clones on disk", value: cloneStats.count },
  ];

  // decisions table
  const decisionRows = decisions
    .map((d) => {
      const statusClass = d.status === "active" ? "status-locked" : "status-draft";
      return `<tr>
        <td class="id">${escapeHtml(d.id)}</td>
        <td>${escapeHtml(d.title)}</td>
        <td class="${statusClass}">${escapeHtml(d.status)}</td>
        <td class="muted">${escapeHtml(d.decided_by || d.subtype)}</td>
      </tr>`;
    })
    .join("");

  // GAC tables
  function gacRow(c) {
    const prClass = `priority-${c.priority}`;
    const statusClass =
      c.status === "answered" ? "status-answered" : "status-pending";
    return `<tr>
      <td class="id">${escapeHtml(c.id)}</td>
      <td>${escapeHtml(c.title.replace(/^"|"$/g, ""))}</td>
      <td class="${prClass}">${escapeHtml(c.priority)}</td>
      <td class="${statusClass}">${escapeHtml(c.status)}</td>
      <td class="resolution">${escapeHtml(c.resolution || "")}</td>
    </tr>`;
  }

  const pendingRows = pending.map(gacRow).join("");
  const answeredRows = answered.map(gacRow).join("");

  // research categories
  const catCards = Object.entries(researchStats.categories)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([name, count]) => `
    <div class="category-card">
      <div class="cat-name">${escapeHtml(name)}</div>
      <div class="cat-count">${count}</div>
    </div>`
    )
    .join("");

  const schematicHtml = schematic
    ? `<pre class="schematic-pre">${escapeHtml(schematic)}</pre>`
    : '<p class="muted">(SCHEMATIC-v0.md not found)</p>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="60">
  <title>EMA Blueprint Planner — v0.2-preview</title>
  <style>${STYLE}</style>
</head>
<body>
  <header class="hero">
    <h1>EMA Blueprint Planner <span class="muted">— Bootstrap v0.2-preview</span></h1>
    <div class="subtitle">genesis: ${escapeHtml(genesisRoot)} · scanned: ${escapeHtml(scannedAt)} · auto-refresh 60s</div>
    <div class="stats">
      ${stats
        .map(
          (s) => `
        <div class="stat">
          <div class="stat-label">${escapeHtml(s.label)}</div>
          <div class="stat-value">${s.value}</div>
        </div>`
        )
        .join("")}
    </div>
  </header>

  <main>
    <section>
      <h2>Schematic (SCHEMATIC-v0.md)</h2>
      <details>
        <summary>Expand full architecture diagram</summary>
        ${schematicHtml}
      </details>
    </section>

    <section>
      <h2>Canon Decisions — locked</h2>
      ${
        decisions.length === 0
          ? '<p class="muted">No decisions in canon/decisions/</p>'
          : `<table>
              <thead>
                <tr><th>ID</th><th>Title</th><th>Status</th><th>Decided by</th></tr>
              </thead>
              <tbody>${decisionRows}</tbody>
            </table>`
      }
    </section>

    <section>
      <h2>Open GAC Queue — ${pending.length} pending</h2>
      ${
        pending.length === 0
          ? '<p class="muted">All GAC cards answered. Write new ones or declare done.</p>'
          : `<table>
              <thead>
                <tr><th>ID</th><th>Title</th><th>Priority</th><th>Status</th><th>Resolution</th></tr>
              </thead>
              <tbody>${pendingRows}</tbody>
            </table>`
      }
    </section>

    <section>
      <h2>Answered GAC Queue — ${answered.length} resolved</h2>
      ${
        answered.length === 0
          ? '<p class="muted">None yet.</p>'
          : `<table>
              <thead>
                <tr><th>ID</th><th>Title</th><th>Priority</th><th>Status</th><th>Resolution</th></tr>
              </thead>
              <tbody>${answeredRows}</tbody>
            </table>`
      }
    </section>

    <section>
      <h2>Research Layer — ${researchStats.total} nodes across ${Object.keys(researchStats.categories).length} categories</h2>
      <div class="category-grid">${catCards}</div>
      <p class="muted" style="margin-top:16px;">
        Extraction docs in _extractions/: <strong style="color:#14B8A6;">${extractionStats.count}</strong> ·
        Cloned source trees in _clones/: <strong style="color:#14B8A6;">${cloneStats.count}</strong>
      </p>
    </section>

    <section>
      <h2>Next Action Hints</h2>
      <div class="md-content">
        <ul>
          ${
            pending.length > 0
              ? `<li>${pending.length} open GAC card${pending.length === 1 ? "" : "s"} remain — answer them to keep unblocking canon</li>`
              : "<li>All GAC cards resolved. Next: Phase 1 ema-core library port per SELF-POLLINATION-FINDINGS.md</li>"
          }
          ${
            cloneStats.count < researchStats.total
              ? `<li>${researchStats.total - cloneStats.count} research nodes still lack Tier 3 extractions — parallel agents running</li>`
              : "<li>All research nodes have extractions</li>"
          }
          <li>Blueprint v0.2-preview is <strong>read-only</strong>. Next iteration: POST handlers for answering GACs in-browser.</li>
          <li>Edit any file in <code>ema-genesis/</code> and refresh this page — state is live.</li>
        </ul>
      </div>
    </section>
  </main>

  <footer>
    EMA Blueprint Planner · v0.2-preview · zero deps · reads ema-genesis/ on every request<br>
    start: <code>node /home/trajan/Projects/ema/blueprint/server.js</code> · port: <code>${PORT}</code><br>
    kill:  <code>pkill -f "blueprint/server.js"</code>
  </footer>
</body>
</html>`;
}

// ──────────────────────────────────────────────────────────────────────
// Single-file node view — GET /node/:path renders a genesis file
// ──────────────────────────────────────────────────────────────────────

function renderNodePage(relPath, content) {
  const { data, content: body } = parseFrontmatter(content);
  const frontmatterRows = Object.entries(data)
    .map(
      ([k, v]) =>
        `<tr><td class="id">${escapeHtml(k)}</td><td>${
          Array.isArray(v)
            ? v.map((x) => escapeHtml(x)).join("<br>")
            : escapeHtml(v)
        }</td></tr>`
    )
    .join("");

  const rendered = renderMarkdownLite(body);

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${escapeHtml(relPath)}</title><style>${STYLE}</style></head>
<body>
  <header class="hero">
    <h1>${escapeHtml(relPath)}</h1>
    <div class="subtitle"><a href="/" style="color:#14B8A6;">← back to dashboard</a></div>
  </header>
  <main>
    <section>
      <h2>Frontmatter</h2>
      <table><tbody>${frontmatterRows}</tbody></table>
    </section>
    <section>
      <h2>Body</h2>
      <div class="md-content">${rendered}</div>
    </section>
  </main>
  <footer>EMA Blueprint Planner · node view</footer>
</body></html>`;
}

// ──────────────────────────────────────────────────────────────────────
// Live state API — JSON dump, SSE stream, POST handlers for writes
// ──────────────────────────────────────────────────────────────────────

const sseClients = new Set();

function broadcastSSE(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of Array.from(sseClients)) {
    try {
      client.write(payload);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

// Write an answer back to a GAC card's README.md
// Updates frontmatter fields (status / answered_at / answered_by / resolution)
// and appends a Resolution section with the chosen option.
async function answerGACCard(id, payload) {
  const { option, freeform, resolution } = payload || {};
  if (!id || !id.startsWith("GAC-")) throw new Error("Invalid GAC id: " + id);
  if (!option) throw new Error("Missing 'option' in payload");

  const readmePath = path.join(GENESIS_ROOT, "intents", id, "README.md");
  let content = await fs.readFile(readmePath, "utf-8");
  const today = new Date().toISOString().slice(0, 10);
  const resolutionValue = resolution || `option-${option}`;

  if (/^status:\s*.*$/m.test(content)) {
    content = content.replace(/^status:\s*.*$/m, "status: answered");
  }
  if (/^updated:\s*.*$/m.test(content)) {
    content = content.replace(/^updated:\s*.*$/m, `updated: ${today}`);
  }
  const insertOrReplace = (field, value) => {
    const re = new RegExp(`^${field}:\\s*.*$`, "m");
    if (re.test(content)) {
      content = content.replace(re, `${field}: ${value}`);
    } else {
      content = content.replace(/^(updated:\s*.*)$/m, `$1\n${field}: ${value}`);
    }
  };
  insertOrReplace("answered_at", today);
  insertOrReplace("answered_by", "human");
  insertOrReplace("resolution", resolutionValue);

  // Strip existing Resolution section if any, then append a fresh one
  content = content.replace(/\n\n## Resolution \([^)]+\)[\s\S]*$/m, "");
  content = content.trimEnd();
  const freeformLine = freeform ? ` ${freeform}` : "";
  content += `\n\n## Resolution (${today})\n\n**Answer: [${option}]**${freeformLine}\n\n*Answered via Blueprint Planner vApp.*\n\n#gac #answered\n`;

  await fs.writeFile(readmePath, content, "utf-8");
  return { ok: true, id, option, resolution: resolutionValue };
}

// ──────────────────────────────────────────────────────────────────────
// HTTP server
// ──────────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);

  // CORS — allow the React renderer (any origin, it's localhost only)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // GET /api/state — full JSON dump of current genesis state
  if (parsed.pathname === "/api/state") {
    try {
      const [
        decisions,
        gacCards,
        researchStats,
        extractionStats,
        cloneStats,
      ] = await Promise.all([
        loadCanonDecisions(),
        loadGACCards(),
        loadResearchStats(),
        loadExtractionStats(),
        loadCloneStats(),
      ]);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          decisions,
          gacCards,
          researchStats,
          extractionStats,
          cloneStats,
          scannedAt: new Date().toISOString(),
        })
      );
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // GET /api/events — Server-Sent Events stream (pushes on file change)
  if (parsed.pathname === "/api/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write("retry: 3000\n\n");
    res.write(`data: ${JSON.stringify({ type: "hello", ts: Date.now() })}\n\n`);
    sseClients.add(res);
    req.on("close", () => sseClients.delete(res));
    return;
  }

  // POST /api/gac/:id/answer — write answer back to the GAC card markdown
  const gacAnswerMatch =
    parsed.pathname && parsed.pathname.match(/^\/api\/gac\/([^/]+)\/answer\/?$/);
  if (gacAnswerMatch && req.method === "POST") {
    const gacId = gacAnswerMatch[1];
    try {
      const raw = await readRequestBody(req);
      const payload = raw ? JSON.parse(raw) : {};
      const result = await answerGACCard(gacId, payload);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (e) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // GET / — dashboard
  if (parsed.pathname === "/" || parsed.pathname === "") {
    try {
      const [
        decisions,
        gacCards,
        researchStats,
        extractionStats,
        cloneStats,
        schematic,
      ] = await Promise.all([
        loadCanonDecisions(),
        loadGACCards(),
        loadResearchStats(),
        loadExtractionStats(),
        loadCloneStats(),
        loadSchematic(),
      ]);
      const html = renderDashboard({
        decisions,
        gacCards,
        researchStats,
        extractionStats,
        cloneStats,
        schematic,
        genesisRoot: GENESIS_ROOT,
        scannedAt: new Date().toISOString().replace("T", " ").slice(0, 19),
      });
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
    } catch (e) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("ERROR: " + e.message + "\n" + e.stack);
    }
    return;
  }

  // GET /vapp — Blueprint Planner vApp (Tauri-style)
  if (parsed.pathname === "/vapp" || parsed.pathname === "/vapp/") {
    try {
      const [
        decisions,
        gacCards,
        researchStats,
        extractionStats,
        cloneStats,
      ] = await Promise.all([
        loadCanonDecisions(),
        loadGACCards(),
        loadResearchStats(),
        loadExtractionStats(),
        loadCloneStats(),
      ]);
      const html = vapp.renderVAppPage({
        decisions,
        gacCards,
        researchStats,
        extractionStats,
        cloneStats,
        scannedAt: new Date().toISOString().replace("T", " ").slice(0, 19),
      });
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
    } catch (e) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("ERROR: " + e.message + "\n" + e.stack);
    }
    return;
  }

  // GET /node/:path — single file view
  if (parsed.pathname && parsed.pathname.startsWith("/node/")) {
    const relPath = parsed.pathname.slice(6);
    const content = await loadFileContent(relPath);
    if (!content) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found: " + relPath);
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(renderNodePage(relPath, content));
    return;
  }

  // GET /health — liveness
  if (parsed.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, genesis: GENESIS_ROOT, ts: Date.now() }));
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

server.listen(PORT, HOST, () => {
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(` EMA Blueprint Planner · Bootstrap v0.2-preview`);
  console.log(` Live at: http://${HOST}:${PORT}/`);
  console.log(` Genesis: ${GENESIS_ROOT}`);
  console.log(` Reading live on every request · refresh to update`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
});

// ──────────────────────────────────────────────────────────────────────
// File watcher — push SSE events on any ema-genesis/ .md change
// Uses fs.watch recursive (Node 20+ supports it on Linux via inotify).
// ──────────────────────────────────────────────────────────────────────

const watchTargets = [
  path.join(GENESIS_ROOT, "intents"),
  path.join(GENESIS_ROOT, "canon"),
  path.join(GENESIS_ROOT, "_meta"),
  path.join(GENESIS_ROOT, "research"),
];

// Debounce rapid file events (agents writing many files in a burst)
let lastBroadcast = 0;
const MIN_INTERVAL_MS = 300;

for (const target of watchTargets) {
  try {
    fsSync.watch(target, { recursive: true }, (event, filename) => {
      if (!filename) return;
      const fname = filename.toString();
      if (!fname.endsWith(".md")) return;
      const now = Date.now();
      if (now - lastBroadcast < MIN_INTERVAL_MS) return;
      lastBroadcast = now;
      broadcastSSE({
        type: "file-change",
        event,
        filename: path.join(path.basename(target), fname),
        ts: now,
      });
    });
    console.log(`[ema] watching ${target}`);
  } catch (e) {
    console.warn(`[ema] failed to watch ${target}: ${e.message}`);
  }
}

process.on("SIGINT", () => {
  console.log("\nshutting down");
  server.close();
  process.exit(0);
});
