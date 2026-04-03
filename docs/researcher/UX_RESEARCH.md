# EMA UX Research

**Researcher Agent — User Testing Simulation & Reference Research**
**Date:** 2026-04-03
**Status:** Living document — update as features ship, simulate user workflows

---

## Part 1: Trajan User Testing Simulation

Simulated based on USER.md profile: power user, direct, no filler, values things working over things being perfect, gets annoyed by hallucinated responses, extensibility-focused.

---

### Workflow 1: "Brainstorm ideas → Create proposals → Select best → Execute"

**Simulated session:**

1. Trajan opens EMA on the workstation
2. Launchpad loads — app grid, greeting, One Thing card
3. Wants to brainstorm improvements to proposals feature
4. Opens Brain Dump (Super+Shift+C if wired — it isn't)
5. Types: "what if proposals could auto-categorize themselves by project"
6. Clicks "→ Seed" to convert to a one-shot proposal seed

**Friction points found:**
- ❌ Global shortcut `Super+Shift+C` is not wired (CLAUDE.md: "not wired")
- Must click through Dock → Brain Dump → type. Extra steps = fewer captures.
- **Recommendation:** Prioritize global shortcuts in Sprint 2. This is the highest-frequency interaction.

7. Seed runs through pipeline (~60s)
8. Opens Proposals to see result
9. Sees proposal card: title, 8px confidence dot, tags, scope badge
10. Clicks to expand: problem statement, steelman, red team, synthesis

**Friction points found:**
- ✅ Expand flow is well-designed
- ❌ Confidence dot has no tooltip explaining the score (0.87 means what?)
- ❌ `estimated_scope: "M"` — what does M mean? Medium? Minutes?
- **Recommendation:** Add hover tooltip: "Confidence: 0.87 (High)" and scope legend (XS=hours, S=day, M=2-3 days, L=week, XL=weeks)

11. Clicks Redirect — types "what if it was opt-in per project?"
12. Original proposal disappears, 3 forks generating (~180s)

**Friction points found:**
- ❌ No confirmation after redirect. No progress indicator for the 3 generating forks.
- Trajan will wonder: "did it work?" and look for evidence
- **Recommendation:** After redirect, show inline: "⟳ Generating 3 forks... (~2-3 min)" with spinner that resolves when forks arrive

13. Approves the best fork 3 minutes later
14. Task created — navigates to Tasks to find it

**Friction points found:**
- ❌ No visual feedback that approval created a specific task in a specific project
- Task creation is async via pipe — no synchronous confirmation
- **Recommendation:** After approve, show toast: "✅ Task created — [Open Task]" with a link

**Overall workflow assessment: 6/10**
Core flow works. Friction is in feedback — user doesn't know what's happening between actions.

---

### Workflow 2: "Morning Review — What needs attention today?"

**Simulated session:**

1. Opens EMA in the morning
2. Wants: proposals arrived overnight, blocked tasks, at-risk goals
3. Opens Launchpad — sees greeting + One Thing card

**Gap:** No "Morning Briefing" view. The proposals queue shows everything (not just overnight). Tasks shows everything (not just blocked). No unified triage screen.

**What Trajan would want:**
- A daily digest: "8 new proposals overnight, 2 tasks overdue, 3 responsibilities at risk"
- Filterable by "since I last opened EMA"
- Responsibility health summary at a glance

**Reference:** FEATURES.md mentions "Morning Briefing" as planned Phase 3 pipe template. Designed but not built.

**Recommendation:** Sprint 3 should ship a "Daily Digest" view as a first-class screen — not just a pipe. Digest = Proposals (since yesterday) + Tasks (overdue/blocked) + Responsibilities (unhealthy) + Goals (stalled). One view, scannable in 30 seconds.

---

### Workflow 3: "Debug — Why isn't the proposal engine running?"

**Simulated session:**

1. Notices no new proposals in queue for hours
2. Opens Proposals → Engine tab
3. Sees Engine Observatory: pipeline status, harvester statuses, activity feed

**Good:** This view is well-designed. Crashed GenServers would show status changes.

**Gap:** Missing per-proposal pipeline timing. "Proposal #42 in Generator for 8 min" = stuck indicator. The design shows throughput counts but not individual proposal staleness.

**Simulated complaint:** "Engine says 3 in generator but I see nothing. How long? Is Claude hanging?"

**Recommendation:** Add pipeline health indicator: if any proposal in single stage >5 min, show warning: "⚠️ 1 proposal stuck in Generator (8 min). Claude may be timing out."

---

### Workflow 4: "Search — Find my notes about proposal engine design"

**Simulated session:**

1. Types "proposal engine" into Second Brain search
2. Expects: spec documents, ADRs, session summaries

**Current state:** `VaultSearch.tsx` exists. FTS5 implemented.

**Critical gap:** Vault search searches EMA's own vault (`~/.local/share/ema/vault/`), NOT Trajan's Obsidian vault (`~/Documents/obsidian_first_stuff/twj1/`). All design specs, architecture notes, and research live in Obsidian. EMA vault is new and mostly empty.

**Simulated complaint:** "I searched 'proposal engine' and got 0 results. All my notes are in Obsidian."

**This is the single biggest onboarding friction point.** EMA's Second Brain needs content before it's useful.

**Recommendation:** Add first-run onboarding: "Import from Obsidian" wizard that copies key notes into EMA vault. VaultHarvester can ingest from Obsidian as read-only source immediately.

---

### Workflow 5: "Agent Chat — Ask an agent to create a task"

**Simulated session:**

1. Opens Agents app
2. Chats with agent: "Create a task for fixing the brain dump shortcuts"
3. Agent says it created the task

**Gap:** Only `brain_dump:create_item` tool is implemented. `tasks:create` is NOT. Agent will either hallucinate success (bad) or fail silently.

**Simulated complaint:** "The agent said it created a task. There's no task. This is broken."

**Severity: HIGH.** This will cause immediate trust erosion. If the agent says it did something it can't do, Trajan stops using agents entirely.

**Recommendation:** Either:
1. Implement `tasks:create` tool in AgentWorker (best)
2. Or, have AgentWorker return "I can't do that yet" for unimplemented tools (acceptable temporary fix)
Never let agents claim success on unimplemented actions.

---

### Workflow 6: "View my project graph — see connections"

**Simulated session:**

1. Opens Vault → Graph view
2. Expects: interconnected nodes showing projects, proposals, tasks, decisions

**Current state:** VaultGraph.tsx renders vault notes only (custom Canvas 2D). `react-force-graph-2d` is installed but unused.

**Gap:** Graph shows vault notes + wikilinks. Does NOT show projects, proposals, tasks, or intent nodes as graph nodes. The unified cross-entity graph (Feature 8 in FEATURES.md) is designed but not implemented.

**Simulated complaint:** "The graph is mostly empty. I want to see how my projects connect to proposals and tasks."

**Recommendation:** Phase 1: add project nodes to graph (simple — query projects, render as larger nodes). Phase 2: add proposal + task nodes. Phase 3: full unified graph API.

---

## Part 2: Reference Research — How Do Similar Systems Handle This?

### Notion — Intent & Proposals

**How they do it:** Notion has no autonomous proposal engine. Users create databases manually. AI assists with writing but doesn't generate ideas autonomously.

**What EMA does better:** The proposal engine is genuinely novel. No consumer tool generates, debates, and scores proposals autonomously. This is EMA's strongest differentiator.

**What to steal:** Notion's database views (list, board, calendar, timeline, gallery) are interchangeable on the same data. EMA should let the proposal queue be viewed as a list (current), board (by confidence tier), or timeline (by generation date).

### Linear — Task Triage

**How they do it:** Linear's triage is the gold standard. New issues arrive in Triage. You drag to Backlog, Todo, or decline. Keyboard-first (J/K to navigate, 1-4 to set priority, D to change status). The inbox auto-clears as you process items.

**What EMA does better:** EMA's proposals are richer than Linear issues — they come with steelman, red team, synthesis. More information for decision-making.

**What to steal:**
- ❗ **Keyboard shortcuts for proposal triage.** J/K to navigate proposals, G for approve, Y for redirect, R for kill. This is the #1 UX improvement EMA needs. Trajan is a keyboard-first user.
- **Auto-clear processed items.** After approve/redirect/kill, the proposal should animate out and the next one should auto-focus.
- **"Mark all as reviewed" batch action.** If 12 proposals queue overnight, Trajan should be able to process them in rapid-fire, not one-click-at-a-time.

### GitHub Projects — Board Views

**How they do it:** Projects v2 has views: Board, Table, Roadmap. Same data, different projections. Custom fields, grouping, filtering.

**What to steal:** EMA's Tasks app has Board + List views. Good. But Proposals doesn't have alternative views. Add: Board view (columns by confidence tier: High/Medium/Low) and a "compact" list view (title + dot + actions only, no tags or summary).

### Obsidian — Knowledge Graph

**How they do it:** Obsidian's graph view shows all notes as nodes, wikilinks as edges. Force-directed layout. Color by folder. Filter by tag, path. Local graph (neighbors of current note) vs global graph.

**What EMA does better:** EMA adds typed edges (9 types: depends-on, implements, contradicts, etc.) — richer semantics than Obsidian's flat links.

**What to steal:**
- **Local graph view.** When viewing a note, show its immediate neighborhood (1-2 hops). This is more useful than the full graph for exploration.
- **Path highlighting.** "Show me the path from this decision to that task" — shortest path through the graph. EMA has `Graph.path/2` in the spec but it's not in the UI.

### Height — AI-as-Teammate Feed

**How they do it:** Height's AI generates proactive updates: "This task blocked 5 days — reassign?", "PR merged — auto-close related issues?". Shows up in activity feed as a teammate, not a tool.

**What EMA should steal:** EMA's proposal engine generates ideas, but the system never *proactively surfaces observations about existing work*. The gap scanning catches stale tasks and orphan notes, but results only appear if you open the Gaps view.

**Recommendation:** Add a "System Observations" section to Launchpad (home screen):
- "3 tasks blocked for >7 days"
- "Proposal #42 is similar to killed proposal #18"
- "Your 'Maintainer' responsibilities health dropped to 0.4"
Observations should be generated as a pipe (existing gap scanner → format as observations → display on Launchpad).

### Motion — Scheduling Intelligence

**How they do it:** Motion schedules tasks based on priority, duration, deadlines, and calendar availability. "Do Date ≠ Due Date." Re-plans dynamically when anything changes.

**What EMA should steal:** EMA has due dates on tasks but no scheduling intelligence. The gap is captured in the "Executive Layer Synthesis" doc (Gap 3: No automatic scheduling loop). Not Sprint 2 material, but important for Sprint 4+.

### Fibery — Cross-Entity Queries

**How they do it:** Fibery's Smart Agent generates JavaScript query pipelines at runtime. "How many in-progress tasks with deadlines this month?" answers correctly because it writes code to join relational data.

**What EMA should steal:** EMA's entities (projects, tasks, proposals, responsibilities) are separate contexts. The MCP approach (expose all state to Claude) is the right path. The "Executive Layer Synthesis" (Gap 1) describes this correctly. Priority for Sprint 3-4.

---

## Part 3: UX Recommendations Summary

### Critical (Sprint 2)

| # | Issue | Impact | Fix |
|---|---|---|---|
| 1 | No keyboard shortcuts for proposal triage | High-frequency action requires mouse | Add J/K/G/Y/R shortcuts |
| 2 | Agent tool execution gap | Trust erosion when agent claims impossible action | Implement tasks:create or return honest "can't do that" |
| 3 | No feedback after approve/redirect/kill | User doesn't know what happened | Add toast notifications with links |
| 4 | Confidence dot has no tooltip | Score is meaningless without context | Add hover tooltip with explanation |

### Important (Sprint 3)

| # | Issue | Impact | Fix |
|---|---|---|---|
| 5 | No daily digest / morning briefing | Morning review requires opening 4+ apps | Build unified daily digest view |
| 6 | Second Brain is empty (no Obsidian import) | Search returns nothing, vault feels broken | Add "Import from Obsidian" onboarding |
| 7 | Redirect gives no progress feedback | User confused about fork status | Show inline spinner with expected time |
| 8 | Pipeline staleness not visible | Can't tell if Claude is hanging | Add per-proposal stage timer |

### Nice to Have (Sprint 4+)

| # | Issue | Impact | Fix |
|---|---|---|---|
| 9 | Graph is vault-only, not cross-entity | Limited usefulness | Build unified entity graph |
| 10 | No alternative proposal views (board, compact) | Only list view | Add board + compact views |
| 11 | No local graph (note neighborhood) | Full graph is overwhelming | Show 1-2 hop neighborhood |
| 12 | System observations on Launchpad | Proactive intelligence hidden in Gaps view | Surface observations on home screen |

---

## Part 4: Design Consistency Audit

### ✅ Consistent

- Glass morphism tiers used correctly across all 13 apps (post-FIXES.md patch)
- Color semantic: teal = positive/high, blue = neutral/medium, amber = low/warning, red = danger/kill
- Card layout: header → content → action row pattern in ProposalCard, TaskCard, ProjectCard
- Text hierarchy: `--pn-text-primary` (0.87 opacity), `--pn-text-secondary` (0.60), `--pn-text-tertiary` (0.40)
- Font system: system-ui for UI text, JetBrains Mono for code

### ⚠️ Minor Inconsistencies

- Sidebar width varies between apps (some 200px, some 240px). Not a bug, but Dock-aware apps should agree on sidebar inset.
- App window default dimensions in `APP_CONFIGS` are reasonable but Brain Dump (400×600) feels narrow. Recommend 500×650 for comfortable typing.
- Border radius: most cards use `rounded-lg` (0.5rem). Some use `rounded-xl` (0.75rem). Standardize to `rounded-lg` everywhere.

### ❌ Missing

- No loading skeleton animations. All apps show text "Loading..." then snap to content. Should use skeleton cards matching the glass aesthetic for polish.
- No empty state illustrations. Empty proposal queue shows no text/illustration. Should show "No proposals yet — add a seed to start generating ideas" with a CTA button.
- Accessibility: no aria labels on action buttons (approve/redirect/kill are icon-only with color, no screenreader text). Add `aria-label="Approve proposal"`.
