// EMA Blueprint Planner vApp — renderer
// Mirrors the style/format of the old Tauri build (archived under IGNORE_OLD_TAURI_BUILD/).
// Glass morphism, custom titlebar with traffic lights, ambient strip, accent-colored chrome.
// Zero runtime dependencies — pure string templating + inline CSS + inline vanilla JS.
//
// Ref: IGNORE_OLD_TAURI_BUILD/app/src/components/layout/AppWindowChrome.tsx
// Ref: IGNORE_OLD_TAURI_BUILD/app/src/components/layout/AmbientStrip.tsx
// Ref: ema-genesis/canon/specs/BLUEPRINT-PLANNER.md
//
// This file exports `renderVAppPage(data)` + `parseGACCardBody(body)` and is consumed by server.js.

// ──────────────────────────────────────────────────────────────────────
// GAC card body parser — extracts structured sections from the markdown
// ──────────────────────────────────────────────────────────────────────

function parseGACCardBody(body) {
  if (!body) return { question: "", context: "", options: [], recommendation: "" };

  function extractSection(heading) {
    const re = new RegExp(
      `##\\s+${heading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`,
      "i"
    );
    const m = body.match(re);
    return m ? m[1].trim() : "";
  }

  const question = extractSection("Question");
  const context = extractSection("Context");
  const recommendation = extractSection("Recommendation");
  const resolution = extractSection("Resolution \\(\\d{4}-\\d{2}-\\d{2}\\)");

  // Options are parsed line-by-line from the Options section
  const optionsText = extractSection("Options");
  const options = [];
  if (optionsText) {
    const lines = optionsText.split(/\r?\n/);
    let current = null;
    for (const raw of lines) {
      // Top-level option: - **[X] <title>**: <description>
      const m = raw.match(/^-\s+\*\*\[([^\]]+)\]\s+([^*]+?)\*\*:\s*(.*)$/);
      if (m) {
        if (current) options.push(current);
        current = {
          label: m[1].trim(),
          title: m[2].trim(),
          description: m[3].trim(),
          implications: "",
        };
        continue;
      }
      if (!current) continue;
      // Sub-bullet for Implications
      const impl = raw.match(/^\s+-\s+\*\*Implications?:?\*\*\s*(.*)$/i);
      if (impl) {
        current.implications = impl[1].trim();
        continue;
      }
      // Continuation lines
      const trimmed = raw.trim();
      if (trimmed && !trimmed.startsWith("##")) {
        if (current.implications) {
          current.implications += " " + trimmed;
        } else {
          current.description += " " + trimmed;
        }
      }
    }
    if (current) options.push(current);
  }

  return { question, context, options, recommendation, resolution };
}

// ──────────────────────────────────────────────────────────────────────
// HTML escape
// ──────────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ──────────────────────────────────────────────────────────────────────
// CSS — glass tokens + layout, mirroring the Tauri build
// ──────────────────────────────────────────────────────────────────────

const CSS = `
:root {
  /* Base colors — from IGNORE_OLD_TAURI_BUILD/app/src/globals.css */
  --pn-void: #060610;
  --pn-base: #0A0C14;
  --pn-window-core: #0E1017;
  --pn-window-deep: #060610;
  --pn-window-wash: rgba(14, 16, 23, 0.72);
  --pn-window-header: rgba(14, 16, 23, 0.65);
  --pn-surface-1: #0E1017;
  --pn-surface-2: #141721;
  --pn-surface-3: #1A1D2A;

  /* Text opacities */
  --pn-text-primary: rgba(255, 255, 255, 0.87);
  --pn-text-secondary: rgba(255, 255, 255, 0.60);
  --pn-text-tertiary: rgba(255, 255, 255, 0.40);
  --pn-text-muted: rgba(255, 255, 255, 0.25);

  /* Borders */
  --pn-border-subtle: rgba(255, 255, 255, 0.06);
  --pn-border-surface: rgba(255, 255, 255, 0.10);
  --pn-border-elevated: rgba(255, 255, 255, 0.14);

  /* Accents — teal primary, amber/blue secondaries */
  --color-pn-primary-400: #2DD4A8;
  --color-pn-primary-300: #5EE5BE;
  --color-pn-primary-500: #14B8A6;
  --color-pn-accent-blue: #6B95F0;
  --color-pn-accent-amber: #F59E0B;
  --color-pn-accent-violet: #A78BFA;

  /* States */
  --color-pn-success: #22C55E;
  --color-pn-warning: #EAB308;
  --color-pn-error: #E24B4A;
  --color-pn-info: #3B82F6;

  /* Typography */
  --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono: ui-monospace, "JetBrains Mono", "Fira Code", "SF Mono", monospace;
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  height: 100vh;
  overflow: hidden;
  background: var(--pn-void);
  color: var(--pn-text-primary);
  font-family: var(--font-sans);
  font-size: 13px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

/* ── Window root — standalone chrome with glass ambient ─────────────── */
.window-root {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(circle at top, rgba(45, 212, 168, 0.08), transparent 24%),
    radial-gradient(circle at 85% 0%, rgba(107, 149, 240, 0.07), transparent 22%),
    linear-gradient(180deg, var(--pn-window-core), var(--pn-window-deep)),
    var(--pn-window-wash);
  backdrop-filter: blur(20px) saturate(128%);
  -webkit-backdrop-filter: blur(20px) saturate(128%);
}

/* ── Ambient strip — 32px global titlebar ───────────────────────────── */
.ambient-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: 32px;
  flex-shrink: 0;
  background: rgba(14, 16, 23, 0.40);
  backdrop-filter: blur(6px) saturate(130%);
  -webkit-backdrop-filter: blur(6px) saturate(130%);
  border-bottom: 1px solid var(--pn-border-subtle);
  -webkit-app-region: drag;
}

.ambient-brand {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-pn-primary-400);
}

.ambient-clock {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--pn-text-tertiary);
}

/* ── App header — 36px window chrome with accent icon/title ─────────── */
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  height: 36px;
  flex-shrink: 0;
  background: var(--pn-window-header);
  backdrop-filter: blur(20px) saturate(150%);
  -webkit-backdrop-filter: blur(20px) saturate(150%);
  border-bottom: 1px solid var(--pn-border-subtle);
}

.app-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.app-icon {
  font-size: 14px;
  color: var(--color-pn-primary-400);
}

.app-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--color-pn-primary-400);
  text-transform: uppercase;
}

.app-breadcrumb {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--pn-text-muted);
}

/* ── Traffic lights (3 × 12px rounded buttons) ──────────────────────── */
.traffic-lights {
  display: flex;
  align-items: center;
  gap: 8px;
}

.traffic-light {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  opacity: 0.80;
  transition: opacity 120ms ease;
  padding: 0;
}

.traffic-light:hover { opacity: 1; }
.traffic-light.yellow { background: var(--color-pn-warning); }
.traffic-light.green  { background: var(--color-pn-success); }
.traffic-light.red    { background: var(--color-pn-error); }

/* ── Tab bar — sub-navigation for the 4 Blueprint tabs ──────────────── */
.tab-bar {
  display: flex;
  align-items: stretch;
  padding: 0 14px;
  height: 38px;
  flex-shrink: 0;
  background: rgba(10, 12, 20, 0.55);
  border-bottom: 1px solid var(--pn-border-subtle);
  gap: 4px;
}

.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 14px;
  height: 100%;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--pn-text-secondary);
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: all 160ms ease;
}

.tab:hover { color: var(--pn-text-primary); }

.tab.active {
  color: var(--color-pn-primary-400);
  border-bottom-color: var(--color-pn-primary-400);
}

.tab-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 16px;
  padding: 0 5px;
  background: rgba(45, 212, 168, 0.12);
  border: 1px solid rgba(45, 212, 168, 0.25);
  border-radius: 8px;
  font-size: 9px;
  font-family: var(--font-mono);
  color: var(--color-pn-primary-400);
}

/* ── Main content area ──────────────────────────────────────────────── */
main {
  flex: 1;
  overflow-y: auto;
  padding: 18px 24px;
}

main::-webkit-scrollbar { width: 8px; }
main::-webkit-scrollbar-track { background: transparent; }
main::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }
main::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.14); }

.tab-panel { display: none; }
.tab-panel.active { display: block; animation: fadeIn 200ms ease; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

/* ── GAC card ────────────────────────────────────────────────────────── */
.gac-card {
  background: rgba(20, 23, 33, 0.55);
  backdrop-filter: blur(20px) saturate(130%);
  -webkit-backdrop-filter: blur(20px) saturate(130%);
  border: 1px solid var(--pn-border-surface);
  border-radius: 10px;
  padding: 22px 26px;
  margin-bottom: 18px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
}

.gac-card-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--pn-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 10px;
}

.gac-card-meta .category { color: var(--color-pn-primary-400); font-weight: 600; }
.gac-card-meta .priority.critical { color: var(--color-pn-error); font-weight: 600; }
.gac-card-meta .priority.high     { color: var(--color-pn-warning); font-weight: 600; }
.gac-card-meta .priority.medium   { color: var(--color-pn-info); font-weight: 600; }
.gac-card-meta .priority.low      { color: var(--pn-text-tertiary); }
.gac-card-meta .progress          { margin-left: auto; color: var(--pn-text-muted); }

.gac-card-id {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--pn-text-muted);
}

.gac-card-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--pn-text-primary);
  margin: 4px 0 14px 0;
  letter-spacing: -0.01em;
  line-height: 1.35;
}

.gac-card-question,
.gac-card-context {
  font-size: 12px;
  color: var(--pn-text-secondary);
  margin-bottom: 14px;
  line-height: 1.6;
}

.gac-card-context {
  padding: 10px 14px;
  background: rgba(14, 16, 23, 0.55);
  border-left: 2px solid var(--color-pn-primary-400);
  border-radius: 4px;
}

/* ── Option buttons — [A][B][C][D] + [1][2] per Blueprint spec ──────── */
.gac-options {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-top: 16px;
}

.gac-options .wide-row {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.gac-option {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  background: rgba(10, 12, 20, 0.50);
  border: 1px solid var(--pn-border-surface);
  border-radius: 8px;
  cursor: pointer;
  transition: all 160ms ease;
  text-align: left;
  color: var(--pn-text-primary);
  font-family: var(--font-sans);
  font-size: 12px;
  min-height: 62px;
}

.gac-option:hover {
  background: rgba(20, 23, 33, 0.75);
  border-color: rgba(45, 212, 168, 0.30);
  transform: translateY(-1px);
}

.gac-option-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: rgba(45, 212, 168, 0.15);
  border: 1px solid rgba(45, 212, 168, 0.35);
  border-radius: 6px;
  color: var(--color-pn-primary-400);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.gac-option-label.defer { background: rgba(234, 179, 8, 0.12); border-color: rgba(234, 179, 8, 0.30); color: var(--color-pn-warning); }
.gac-option-label.skip  { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.14); color: var(--pn-text-tertiary); }

.gac-option-body { flex: 1; min-width: 0; }
.gac-option-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--pn-text-primary);
  margin-bottom: 2px;
  line-height: 1.3;
}

.gac-option-desc {
  font-size: 11px;
  color: var(--pn-text-secondary);
  line-height: 1.5;
}

/* ── Freeform textarea ──────────────────────────────────────────────── */
.gac-freeform {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.gac-freeform label {
  font-size: 10px;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--pn-text-tertiary);
}

.gac-freeform textarea {
  background: rgba(10, 12, 20, 0.60);
  border: 1px solid var(--pn-border-surface);
  border-radius: 6px;
  padding: 10px 12px;
  color: var(--pn-text-primary);
  font-family: var(--font-sans);
  font-size: 12px;
  line-height: 1.5;
  resize: vertical;
  min-height: 60px;
  outline: none;
}
.gac-freeform textarea:focus { border-color: rgba(45, 212, 168, 0.40); }

.gac-recommendation {
  margin-top: 14px;
  padding: 12px 14px;
  background: rgba(45, 212, 168, 0.06);
  border: 1px solid rgba(45, 212, 168, 0.20);
  border-radius: 6px;
  font-size: 11px;
  color: var(--pn-text-secondary);
  line-height: 1.5;
}
.gac-recommendation strong { color: var(--color-pn-primary-400); }

/* ── Answered GAC card (collapsed, muted) ────────────────────────────── */
.gac-card.answered {
  padding: 14px 20px;
  margin-bottom: 8px;
}

.gac-card.answered .gac-card-title {
  font-size: 13px;
  margin: 0;
  color: var(--pn-text-secondary);
}

.gac-card.answered .answered-tag {
  display: inline-block;
  padding: 2px 8px;
  background: rgba(34, 197, 94, 0.10);
  border: 1px solid rgba(34, 197, 94, 0.25);
  border-radius: 4px;
  color: var(--color-pn-success);
  font-family: var(--font-mono);
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
  margin-left: 10px;
}

.gac-card.answered .resolution-text {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--pn-text-tertiary);
  margin-top: 4px;
}

/* ── Recent Decisions panel (bottom) ────────────────────────────────── */
.recent-decisions {
  margin-top: 30px;
  background: rgba(14, 16, 23, 0.65);
  backdrop-filter: blur(28px) saturate(135%);
  -webkit-backdrop-filter: blur(28px) saturate(135%);
  border: 1px solid var(--pn-border-surface);
  border-radius: 8px;
  padding: 16px 20px;
}

.recent-decisions-title {
  font-size: 10px;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--pn-text-tertiary);
  margin-bottom: 12px;
}

.recent-decisions ul { list-style: none; padding: 0; margin: 0; }
.recent-decisions li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  font-size: 12px;
  color: var(--pn-text-secondary);
  border-bottom: 1px solid var(--pn-border-subtle);
}
.recent-decisions li:last-child { border-bottom: none; }
.recent-decisions li .check { color: var(--color-pn-success); font-weight: 700; }
.recent-decisions li .id { font-family: var(--font-mono); font-size: 11px; color: var(--color-pn-primary-400); font-weight: 600; min-width: 70px; }

/* ── Empty states ───────────────────────────────────────────────────── */
.empty-state {
  padding: 40px 20px;
  text-align: center;
  color: var(--pn-text-muted);
  font-size: 12px;
  font-family: var(--font-mono);
}

/* ── Intent Graph placeholder (ASCII rendered) ──────────────────────── */
.intent-graph {
  background: rgba(10, 12, 20, 0.75);
  border: 1px solid var(--pn-border-surface);
  border-radius: 8px;
  padding: 20px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--pn-text-secondary);
  white-space: pre;
  overflow-x: auto;
  line-height: 1.5;
}

/* ── Stats strip (bottom of window) ─────────────────────────────────── */
.stats-strip {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 10px 24px;
  background: rgba(6, 6, 16, 0.80);
  border-top: 1px solid var(--pn-border-subtle);
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--pn-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  flex-shrink: 0;
}

.stats-strip .stat-item { display: flex; align-items: center; gap: 6px; }
.stats-strip .stat-value { color: var(--color-pn-primary-400); font-weight: 700; }
`;

// ──────────────────────────────────────────────────────────────────────
// Render helpers
// ──────────────────────────────────────────────────────────────────────

function renderGACOption(opt) {
  const isDefer = opt.label === "1";
  const isSkip = opt.label === "2";
  const labelClass = isDefer ? "defer" : isSkip ? "skip" : "";
  return `
    <button class="gac-option" type="button">
      <span class="gac-option-label ${labelClass}">${escapeHtml(opt.label)}</span>
      <div class="gac-option-body">
        <div class="gac-option-title">${escapeHtml(opt.title)}</div>
        <div class="gac-option-desc">${escapeHtml(opt.description)}</div>
      </div>
    </button>
  `;
}

function renderGACCard(card, index, total) {
  const parsed = parseGACCardBody(card.body || "");
  const categoryLabel = (card.category || "gap").toUpperCase();
  const priorityClass = card.priority || "medium";

  // Split options into letter options (A/B/C/D) and numeric (1/2)
  const letterOpts = parsed.options.filter((o) => /^[A-Z]$/.test(o.label));
  const numericOpts = parsed.options.filter((o) => /^\d$/.test(o.label));

  const letterHtml = letterOpts.map(renderGACOption).join("");
  const numericHtml = numericOpts.map(renderGACOption).join("");

  const title = card.title.replace(/^"|"$/g, "");
  // Use question if available, otherwise strip "— " prefix from title
  const questionText =
    parsed.question ||
    title.replace(/^[^—]+—\s*/, "");

  return `
    <div class="gac-card">
      <div class="gac-card-meta">
        <span class="category">${escapeHtml(categoryLabel)}</span>
        <span class="priority ${priorityClass}">● ${escapeHtml(card.priority || "unknown")} priority</span>
        <span class="progress">Card ${index + 1} of ${total}</span>
      </div>

      <div class="gac-card-id">${escapeHtml(card.id)}</div>
      <h2 class="gac-card-title">${escapeHtml(title)}</h2>

      ${
        parsed.context
          ? `<div class="gac-card-context">${escapeHtml(parsed.context.split("\n")[0])}</div>`
          : ""
      }

      <div class="gac-options">
        ${letterHtml}
        ${numericOpts.length > 0 ? `<div class="wide-row">${numericHtml}</div>` : ""}
      </div>

      <div class="gac-freeform">
        <label>Or type your answer</label>
        <textarea placeholder="Freeform response..." disabled></textarea>
      </div>

      ${
        parsed.recommendation
          ? `<div class="gac-recommendation">
              <strong>Recommendation:</strong> ${escapeHtml(
                parsed.recommendation.split("\n\n")[0]
              )}
            </div>`
          : ""
      }
    </div>
  `;
}

function renderAnsweredCard(card) {
  const title = card.title.replace(/^"|"$/g, "");
  return `
    <div class="gac-card answered">
      <div class="gac-card-meta" style="margin-bottom: 6px;">
        <span class="gac-card-id">${escapeHtml(card.id)}</span>
        <span class="answered-tag">ANSWERED</span>
      </div>
      <div class="gac-card-title">${escapeHtml(title)}</div>
      ${
        card.resolution
          ? `<div class="resolution-text">→ ${escapeHtml(card.resolution)}</div>`
          : ""
      }
    </div>
  `;
}

// ──────────────────────────────────────────────────────────────────────
// Main page renderer
// ──────────────────────────────────────────────────────────────────────

function renderVAppPage(data) {
  const {
    decisions,
    gacCards,
    researchStats,
    extractionStats,
    cloneStats,
    scannedAt,
  } = data;

  const pending = gacCards.filter((c) => c.status !== "answered");
  const answered = gacCards.filter((c) => c.status === "answered");

  // GAC queue — pending
  const gacQueueHtml =
    pending.length > 0
      ? pending.map((c, i) => renderGACCard(c, i, pending.length)).join("")
      : '<div class="empty-state">No pending GAC cards. Write new ones or declare the queue clear.</div>';

  // Answered GAC — compact list for context
  const answeredHtml =
    answered.length > 0
      ? `<div style="margin-top: 30px;">
          <div class="recent-decisions-title" style="margin-bottom: 10px;">Answered (${answered.length})</div>
          ${answered.map(renderAnsweredCard).join("")}
        </div>`
      : "";

  // Recent Decisions panel (locked canon)
  const decisionsHtml =
    decisions.length > 0
      ? `<ul>
          ${decisions
            .map(
              (d) => `<li>
                <span class="check">✓</span>
                <span class="id">${escapeHtml(d.id)}</span>
                <span>${escapeHtml(d.title.replace(/^"|"$/g, ""))}</span>
              </li>`
            )
            .join("")}
        </ul>`
      : '<div class="empty-state">No canon decisions yet.</div>';

  // Intent graph — naive rendering for v0.2
  const intentGraphHtml = `Intent graph rendering (v0.3 target — SVG over ema-links frontmatter)

      DEC-001 ─┐           ┌─ DEC-002
               ├─ graph   ─┤
      DEC-003 ─┘           └─ DEC-004/5/6
                │
                └── GAC-001..010 (5 answered, 5 open)

      → View full text at /node/SCHEMATIC-v0.md`;

  // Category counts for research layer tab
  const catRows = Object.entries(researchStats.categories || {})
    .sort((a, b) => b[1] - a[1])
    .map(
      ([name, count]) =>
        `<li><span class="id">${count}</span><span>${escapeHtml(name)}</span></li>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="120">
  <title>Blueprint Planner · EMA</title>
  <style>${CSS}</style>
</head>
<body>
  <div class="window-root">
    <!-- Ambient strip (global) -->
    <div class="ambient-strip">
      <span class="ambient-brand">ema</span>
      <span class="ambient-clock" id="clock">—</span>
      <div class="traffic-lights">
        <button class="traffic-light yellow" title="Minimize"></button>
        <button class="traffic-light green" title="Maximize"></button>
        <button class="traffic-light red" title="Close" onclick="window.close()"></button>
      </div>
    </div>

    <!-- App header (window chrome) -->
    <div class="app-header">
      <div class="app-header-left">
        <span class="app-icon">📐</span>
        <span class="app-title">Blueprint Planner</span>
        <span class="app-breadcrumb" id="breadcrumb">· GAC Queue</span>
      </div>
      <div class="traffic-lights">
        <button class="traffic-light yellow"></button>
        <button class="traffic-light green"></button>
        <button class="traffic-light red" onclick="window.close()"></button>
      </div>
    </div>

    <!-- Tab bar -->
    <nav class="tab-bar" role="tablist">
      <button class="tab active" data-tab="gac" role="tab">
        GAC Queue <span class="tab-count">${pending.length}</span>
      </button>
      <button class="tab" data-tab="blockers" role="tab">
        Blockers <span class="tab-count">0</span>
      </button>
      <button class="tab" data-tab="aspirations" role="tab">
        Aspirations <span class="tab-count">0</span>
      </button>
      <button class="tab" data-tab="intents" role="tab">
        Intent Graph
      </button>
      <button class="tab" data-tab="research" role="tab">
        Research <span class="tab-count">${researchStats.total || 0}</span>
      </button>
    </nav>

    <!-- Main content (panels) -->
    <main>

      <!-- GAC Queue panel -->
      <section class="tab-panel active" id="panel-gac">
        ${gacQueueHtml}
        ${answeredHtml}

        <!-- Recent Decisions (locked canon) -->
        <div class="recent-decisions">
          <div class="recent-decisions-title">Recent Decisions (locked)</div>
          ${decisionsHtml}
        </div>
      </section>

      <!-- Blockers panel -->
      <section class="tab-panel" id="panel-blockers">
        <div class="empty-state">
          No blocker cards yet.<br>
          Blockers surface when a GAC card is deferred with option [1].<br>
          Canon spec: canon/specs/BLUEPRINT-PLANNER.md §Blocker Card
        </div>
      </section>

      <!-- Aspirations panel -->
      <section class="tab-panel" id="panel-aspirations">
        <div class="empty-state">
          Aspirations log is empty.<br>
          v0.3 will auto-populate from brain dumps and journal entries<br>
          via LLM detection per DEC-003 (empty niche claimed).
        </div>
      </section>

      <!-- Intent Graph panel -->
      <section class="tab-panel" id="panel-intents">
        <pre class="intent-graph">${escapeHtml(intentGraphHtml)}</pre>
      </section>

      <!-- Research panel -->
      <section class="tab-panel" id="panel-research">
        <div class="recent-decisions">
          <div class="recent-decisions-title">Research Layer — ${
            researchStats.total || 0
          } nodes across ${
    Object.keys(researchStats.categories || {}).length
  } categories</div>
          <ul>${catRows}</ul>
        </div>
        <div style="margin-top: 16px; font-family: var(--font-mono); font-size: 10px; color: var(--pn-text-tertiary);">
          Extractions: <span style="color: var(--color-pn-primary-400); font-weight: 700;">${
            extractionStats.count || 0
          }</span> ·
          Clones on disk: <span style="color: var(--color-pn-primary-400); font-weight: 700;">${
            cloneStats.count || 0
          }</span>
        </div>
      </section>

    </main>

    <!-- Stats strip footer -->
    <div class="stats-strip">
      <span class="stat-item">CANON <span class="stat-value">${decisions.length}</span></span>
      <span class="stat-item">GAC ANSWERED <span class="stat-value">${answered.length}</span></span>
      <span class="stat-item">GAC OPEN <span class="stat-value">${pending.length}</span></span>
      <span class="stat-item">RESEARCH <span class="stat-value">${
        researchStats.total || 0
      }</span></span>
      <span class="stat-item">EXTRACTIONS <span class="stat-value">${
        extractionStats.count || 0
      }</span></span>
      <span class="stat-item">CLONES <span class="stat-value">${
        cloneStats.count || 0
      }</span></span>
      <span style="margin-left: auto; color: var(--pn-text-muted);">
        bootstrap v0.2-preview · scanned ${escapeHtml(scannedAt)}
      </span>
    </div>
  </div>

  <script>
    // Tab switching
    const tabs = document.querySelectorAll('.tab');
    const panels = document.querySelectorAll('.tab-panel');
    const breadcrumb = document.getElementById('breadcrumb');
    const labels = {
      gac: '· GAC Queue',
      blockers: '· Blockers',
      aspirations: '· Aspirations',
      intents: '· Intent Graph',
      research: '· Research Layer',
    };
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        panels.forEach((p) => p.classList.remove('active'));
        const id = 'panel-' + tab.dataset.tab;
        const panel = document.getElementById(id);
        if (panel) panel.classList.add('active');
        breadcrumb.textContent = labels[tab.dataset.tab] || '';
      });
    });

    // Live clock (mirrors AmbientStrip.tsx formatting)
    function formatTime() {
      const now = new Date();
      const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      const date = now.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
      return time + ' · ' + date;
    }
    function updateClock() {
      const el = document.getElementById('clock');
      if (el) el.textContent = formatTime();
    }
    updateClock();
    setInterval(updateClock, 1000);
  </script>
</body>
</html>`;
}

module.exports = {
  parseGACCardBody,
  renderVAppPage,
};
