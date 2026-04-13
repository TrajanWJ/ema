---
id: CANON-VAPPS
type: canon
layer: canon
title: "vApp Catalog"
status: active
created: 2026-04-11
updated: 2026-04-11
tags: [vapps, catalog, modules, platform]
---

# EMA vApp Catalog

> Every vApp is a web component (framework-agnostic) that opens as its own
> Electron BrowserWindow. All share full access to EMA Core API and the
> unified design token system. Distribution: local-first now, git-based later.

> **Status note (2026-04-12):** The in-progress renderer at `apps/renderer/src/App.tsx` wires 28 vApps, but the set barely overlaps with the 35 entries below — the renderer reflects concepts from the old Elixir/Tauri build (Governance, Babysitter, Evolution, Campaigns, Storyboard, Operator Chat, etc.) rather than this canonical catalog. Reconciliation is tracked in [[_meta/SELF-POLLINATION-FINDINGS]] §B (Appendix B — Frontend Layer) and will be executed via `INT-FRONTEND-VAPP-RECONCILIATION` (intent card pending). Do not assume the delta is 7 tiles — it is a two-sided divergence that must be resolved per-vApp.

## Human Productivity

### 1. Notes
Rich note-taking with bidirectional graph connections. Notes are nodes in
the wiki. Tags, links, search. Agent can suggest related notes.

### 2. Tasks / To-Do
Task management. Agent auto-fills suggestions — human taps accept/reject.
Priority, due dates, tags, graph connections. Per-space task boards.

### 3. Schedule / Calendar
Calendar with time-aware agent coordination. Agent sees your schedule
and plans around it. Integrates with time blocking and Pomodoro.

### 4. Responsibilities
Track roles, ongoing responsibilities, ownership areas. Agents reference
this to understand who owns what.

### 5. Brain Dumps
Unstructured capture — type/voice anything. LLM auto-extracts:
aspirations → aspirations log, tasks → task suggestions, knowledge → wiki.

### 6. Pomodoro / Focus
Focus timer. Visible to agents (they know not to interrupt during
focus sessions). Tracks focus history and patterns.

### 7. Time Blocking
Block-based schedule planning. Drag/drop time blocks. Agents can
suggest blocks. Integrates with calendar and Pomodoro.

### 8. Graphing / Charting / Diagrams
Data visualization. Bar, line, scatter, mermaid diagrams, flowcharts.
Context graph auto-generates charts from data. Manual creation too.

### 9. Whiteboard / Canvas
Freeform visual workspace. Drawing, sticky notes, diagrams, spatial
arrangement. Collaborative via CRDTs.

### 10. File Manager
File explorer across local machine and all networked machines in the
P2P mesh. Browse, move, copy, delete. Agent-accessible.

### 11. Email / Messaging Integration
Connect external email and messaging. View and respond within EMA.
Agent can draft responses for approval.

### 12. Journal / Log
Personal logging. LLM auto-detects aspirational/goal statements and
files to aspirations log. Daily, weekly, freeform entries.

### 13. Code Editor / IDE
*DEFERRED — Superman project may cover this. See BLOCK-003 in DEFERRED.md.*

## Knowledge & Research

### 14. Wiki Viewer
Browse, edit, and search the graph wiki. Renders canon, intents, and
research layers. Also available as Wikipedia-style web frontend accessible
from any browser (configurable public/private per space).

### 15. Graph Visualizer
Visual interactive map of all nodes and connections in the graph.
Filter by layer, type, status. Navigate by clicking nodes. Zoom,
pan, search. Shows relationship types on edges.

### 16. Feeds
AI-curated unified discovery stream. Combines:
- Research feeds (YouTube, Reddit, arxiv, GitHub, RSS, HN, blogs, custom)
- System feeds (agent activity, executions, approvals)
- Space feeds (team updates, new knowledge)
User configures sources, filters, signal thresholds. Cron-scheduled +
on-demand + agent-triggered. Content goes to research layer of graph.

### 17. Research Viewer
Deep-dive into ingested research content. Full-text of ingested sources.
See how content connects to existing knowledge. Compare sources.
Natural language queries against the research graph.

### 18. Blueprint / Schematic Planner
System design and planning tool. THE meta-app. Contains:
- **GAC Queue**: Auto-generated cards for Gaps, Assumptions, Clarifications.
  Each card has pre-filled answer options [A][B][C][D] + [1][2].
- **Blockers Queue**: Tricky questions, deferred decisions, dependencies.
  Cards can be promoted back to GAC when ready.
- **Aspirations Log**: Auto-populated from user input via LLM detection +
  manual tagging. Long-term goals, idealistic visions, "what if" ideas.
  Feeds back into intent generation.
- **Intent Graph View**: Visual map of intents with connections and statuses.
Strong connections to wiki, knowledge graph, and agent hub. This vApp
formalizes the design process — the genesis brainstorm IS this vApp
operated manually.

## Agent Observation & Control

> These vApps are the human's **interactive window** into the agent workspace.
> They are NOT read-only — humans can modify agent schedules, redirect work,
> edit plans, dispatch agents, and send messages through them. The agent itself
> never uses these vApps — its world is the CLI. Each vApp mirrors a
> corresponding agent CLI tool surface.

### 19. Agent Hub
Central dispatch and management for all agents. Start, stop, configure
agents. Assign to spaces. Set auto-approve levels. View capabilities.
Manage wrapped CLI agents (Claude Code, Codex, etc.).
**Mirrors:** `ema agent` CLI commands.

### 20. Agent Calendar
View AND modify agent virtual planning schedules. Humans can adjust
agent timelines, reprioritize blocks, and reschedule work.
**Mirrors:** `ema agent schedule` CLI commands.

### 21. Agent Scratchpads
Read and annotate agent working notes and drafts. Human can add comments,
flag items, or redirect agent's working direction.
**Mirrors:** `ema agent scratchpad` CLI commands.

### 22. Agent Plans / Status
Monitor and modify agent plans, progress, and statuses. Human can
reprioritize tasks, mark items as blocked, or redirect active work.
**Mirrors:** `ema agent plan`, `ema agent status` CLI commands.

### 23. Agent Live View
Real-time stream of agent terminal sessions (xterm.js rendered in a
BrowserWindow, like tmux attach). Full session replay from recorded
history. Searchable logs. Human can send commands into the session.
**Mirrors:** `ema agent session` CLI commands.

### 24. Agent Comms
View and participate in agent-to-agent communication through the graph.
Human can inject messages, redirect coordination, or clarify goals.
**Mirrors:** `ema agent comms` CLI commands.

### 25. Terminal
Direct terminal access. Open shells on local or networked machines.
Attach to agent tmux sessions. Run commands. Full SSH access.

## System & Infrastructure

### 26. Machine Manager
Manage all machines in the P2P network. SSH connections, system access
levels, machine roles (host, regular, invisible). Monitor resources,
uptime, available tools. Dispatch agents to specific machines.

### 27. Space Manager
Manage the org > team > project hierarchy. Create, nest, configure spaces.
Set visibility, permissions, member access. Move content between spaces.

### 28. Team Manager
Manage members (humans and agents). Invite via codes/secrets.
Assign roles (owner, admin, member, observer). View activity.

### 29. Settings
All configuration in one place. System settings, space settings,
agent configuration, network/peer settings, design tokens/theming,
notification preferences, auto-approve levels, cron schedules.
Intuitive UI — not config files.

### 30. Analytics
System-wide dashboards. Agent work metrics, resource usage across
the P2P mesh, knowledge graph growth, research ingestion stats,
task completion rates. Auto-generated from system data.

### 31. Services Manager
Self-hosted service management across the distributed homelab.
Deploy, monitor, and manage services across all org machines.
Auto-redistribution when machines go offline. Role-based machine
assignment for different service types.

### 32. Network / Peer Manager
P2P peer status and configuration. See all connected peers, their
roles (host/regular/invisible), resource availability. Configure
host peer settings, invisible mode. Network health monitoring.

### 33. Permissions
Per-space access control configuration. Agent auto-approve levels.
Data access scope (per-space vs cross-space vs full system).
SSH/sudo access management. Human and agent permission matrices.

### 34. Comms
Built-in communications hub:
- Threaded chat (Slack-style) per space or cross-space
- Contextual comments on any graph node (Figma-style)
- Direct messages between humans
- External tool integration (Slack, Discord, email)

### 35. Notifications Hub
Central notification management. View all pending:
- Approval requests (agent proposals)
- Messages and mentions
- System alerts (machine status, service health)
- Agent completion notices
Configure notification preferences, quiet hours, per-space settings.

---

*This catalog is a living document. New vApps are added through the
intent → proposal → execution pipeline.*
