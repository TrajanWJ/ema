export interface DraftAction {
  readonly label: string;
  readonly appId: string;
  readonly note: string;
}

export interface DraftDefinition {
  readonly appId: string;
  readonly eyebrow: string;
  readonly headline: string;
  readonly summary: string;
  readonly status: string;
  readonly maturity: "first-draft" | "connected-preview";
  readonly primaryQuestion: string;
  readonly currentTruth: readonly string[];
  readonly draftCapabilities: readonly string[];
  readonly buildTracks: readonly string[];
  readonly relatedActions: readonly DraftAction[];
  readonly operatorNotes: readonly string[];
}

export const DRAFT_DEFINITIONS: Record<string, DraftDefinition> = {
  wiki: {
    appId: "wiki",
    eyebrow: "Knowledge Surface",
    headline: "Browse and shape working knowledge without pretending vault contracts are settled.",
    summary:
      "Wiki remains important for long-form context, but the old vault API is not part of the live backend spine. This first draft reframes Wiki as a knowledge workstation connected to Chronicle, Review, Intents, and Feeds instead of a fake source of truth.",
    status: "Knowledge shell, active reframing",
    maturity: "first-draft",
    primaryQuestion: "What knowledge should become durable runtime context, and what should stay archival?",
    currentTruth: [
      "The old vault routes are not part of the active backend manifest.",
      "Intent, Chronicle, Review, and Feeds now carry the most trustworthy live knowledge flows.",
      "Wiki should become a browser/editor over durable knowledge layers, not a second hidden backend.",
    ],
    draftCapabilities: [
      "Map the app's real role in the EMA loop.",
      "Jump directly into live related surfaces.",
      "Keep future knowledge-browser design grounded in the current system spine.",
    ],
    buildTracks: [
      "Bind Chronicle and Review records into a knowledge browser.",
      "Add durable note storage only after a backend owner exists.",
      "Reconnect graph/search to active entities rather than dead vault assumptions.",
    ],
    relatedActions: [
      { label: "Open Intent Schematic", appId: "intent-schematic", note: "Inspect runtime intent knowledge" },
      { label: "Open Feeds", appId: "feeds", note: "Source and triage incoming material" },
      { label: "Open Proposals", appId: "proposals", note: "Promote knowledge into work" },
    ],
    operatorNotes: [
      "Use this as a design anchor for future knowledge UX, not as a hidden backend escape hatch.",
      "Any future wiki editing path should preserve provenance back to Chronicle, Review, or canon files.",
    ],
  },
  canvas: {
    appId: "canvas",
    eyebrow: "Spatial Workspace",
    headline: "Make spatial thinking part of the live system again.",
    summary:
      "Canvas is one of the most place-native surfaces in EMA. The old build had a real spatial system; the new stack does not yet have backend ownership. This first draft keeps the app present, connected, and product-shaped while backend restoration is deferred.",
    status: "Place-inspired workspace draft",
    maturity: "first-draft",
    primaryQuestion: "How should ideas, intents, executions, and notes inhabit shared spatial context?",
    currentTruth: [
      "The current Electron backend does not own `/canvases` or `/canvas/*` routes.",
      "The product direction is still valid: place-native, desktop-first, atmospheric, and agent-aware.",
      "Canvas should eventually bind to intents, proposals, projects, and review items as nodes, not just pixels.",
    ],
    draftCapabilities: [
      "Position Canvas inside the real EMA operating model.",
      "Show the main live entities it should connect to.",
      "Keep a high-quality placeholder instead of a broken dead-route editor.",
    ],
    buildTracks: [
      "Reintroduce a durable canvas entity model.",
      "Support intent/proposal/execution/review node cards.",
      "Add local-first persistence and multi-surface navigation.",
    ],
    relatedActions: [
      { label: "Open Intent Schematic", appId: "intent-schematic", note: "Use live intent structure as node input" },
      { label: "Open Blueprint Planner", appId: "blueprint-planner", note: "Bring design questions into spatial planning" },
      { label: "Open Whiteboard", appId: "whiteboard", note: "Sketch freeform before durable modeling" },
    ],
    operatorNotes: [
      "Canvas should be one of the boldest surfaces in EMA once a backend owner exists.",
      "Do not quietly reintroduce the old canvas API without contract cleanup.",
    ],
  },
  evolution: {
    appId: "evolution",
    eyebrow: "System Adaptation",
    headline: "Keep evolution visible without pretending the adaptation backend is already trustworthy.",
    summary:
      "Evolution remains a high-value EMA concept: rules, signals, proposals, and safe adaptation. The current renderer still points at a backend that is not part of the live spine, so this draft turns the app into a design-ready control room instead of a broken pseudo-runtime.",
    status: "Adaptive systems draft",
    maturity: "first-draft",
    primaryQuestion: "How should EMA learn from behavior and improve without creating an opaque self-modifying subsystem?",
    currentTruth: [
      "The legacy evolution routes and stores are not part of the trustworthy active backend spine.",
      "Proposal, execution, review, and blueprint domains already hold the safer building blocks for system improvement.",
      "A future evolution layer should expose explicit governance, provenance, and rollback rather than hidden adaptive behavior.",
    ],
    draftCapabilities: [
      "Keep the adaptation domain visible in the product without faking backend health.",
      "Tie future evolution work to the live proposal, execution, and governance surfaces.",
      "Protect the system from silently reviving unsafe self-modification flows.",
    ],
    buildTracks: [
      "Rebuild evolution over explicit rules, signals, and approval checkpoints.",
      "Route adaptation proposals through Governance and Proposals instead of a hidden side loop.",
      "Add durable rollback and result inspection before any autonomous activation path exists.",
    ],
    relatedActions: [
      { label: "Open Governance", appId: "governance", note: "Keep adaptive changes reviewable and policy-bound" },
      { label: "Open Proposals", appId: "proposals", note: "Use the live queue for system changes" },
      { label: "Open Blueprint Planner", appId: "blueprint-planner", note: "Frame adaptation questions before implementation" },
    ],
    operatorNotes: [
      "Evolution should only return as an explicit, observable subsystem with strong rollback semantics.",
      "Do not reintroduce legacy self-modification routes just because the UI already existed once.",
    ],
  },
  journal: {
    appId: "journal",
    eyebrow: "Reflection Layer",
    headline: "Turn reflection into a real loop surface instead of a dead personal app.",
    summary:
      "Journal matters because EMA needs a place for reflection, retrospection, and human-state narrative. The legacy journal backend is gone, so this first draft repositions the app around live daily planning, review, and future reflection storage.",
    status: "Reflection draft over live day systems",
    maturity: "first-draft",
    primaryQuestion: "Where should reflection live so it can actually inform tomorrow's work?",
    currentTruth: [
      "There is no active `/journal` backend in the Electron stack.",
      "Desk, Agenda, Human Ops, Chronicle, and Review already carry parts of the reflection workflow.",
      "A future Journal should feed human review, daily reset, and longer-term pattern recognition.",
    ],
    draftCapabilities: [
      "Clarify how reflection connects to live work systems.",
      "Point into the current daily loop instead of stalling on broken storage.",
      "Define a stronger eventual journal surface.",
    ],
    buildTracks: [
      "Add a durable journal entry model backed by the live backend.",
      "Connect review notes, day summaries, and retrospective prompts.",
      "Surface journal-derived signals into Desk and Agenda.",
    ],
    relatedActions: [
      { label: "Open Desk", appId: "desk", note: "Use the live daily operating surface" },
      { label: "Open Agenda", appId: "agenda", note: "Ground reflection in schedule and commitments" },
      { label: "Open Operator Chat", appId: "operator-chat", note: "Capture reflective notes into the system now" },
    ],
    operatorNotes: [
      "Reflection should produce usable signals, not become an isolated notebook.",
      "Keep Journal connected to Human Ops instead of rebuilding an old life-dashboard silo.",
    ],
  },
  habits: {
    appId: "habits",
    eyebrow: "Rhythm Support",
    headline: "Support human consistency without splitting off from the live operating loop.",
    summary:
      "Habits was strong in the old personal system, but it currently has no real backend owner. This draft keeps the surface intentional and tied to daily work, focus, and reflection rather than leaving it as a broken life-app relic.",
    status: "Rhythm and consistency draft",
    maturity: "first-draft",
    primaryQuestion: "How should recurring human behavior feed planning and review without becoming its own silo?",
    currentTruth: [
      "No active `/habits` backend exists today.",
      "Human Ops and future reflection surfaces are the right integration points.",
      "Habit support should reinforce the day loop rather than compete with it.",
    ],
    draftCapabilities: [
      "Frame habits as a support layer for the real operating system.",
      "Connect the app to planning, focus, and review surfaces.",
      "Preserve product direction while the backend is deferred.",
    ],
    buildTracks: [
      "Add durable streak/log models only when tied to Human Ops and Journal.",
      "Support routines, reset rituals, and review prompts.",
      "Expose habit-derived signals inside Desk instead of isolating them here.",
    ],
    relatedActions: [
      { label: "Open Desk", appId: "desk", note: "Anchor rhythm in the day surface" },
      { label: "Open Focus", appId: "focus", note: "Connect routines to focused work" },
      { label: "Open Journal", appId: "journal", note: "Reflect on consistency and drift" },
    ],
    operatorNotes: [
      "A good Habits app should feel quietly powerful, not toy-like.",
      "Do not re-add fake CRUD over absent routes just to make the UI appear active.",
    ],
  },
  focus: {
    appId: "focus",
    eyebrow: "Attention Control",
    headline: "Make focus a real execution aid rather than a dead timer shell.",
    summary:
      "Focus should eventually orchestrate protected work blocks, active execution pairing, and interruption control. This first draft reframes the surface around how focus should serve the live execution and planning loop.",
    status: "Attention workflow draft",
    maturity: "first-draft",
    primaryQuestion: "How should focused work blocks align with executions, tasks, and human planning?",
    currentTruth: [
      "No active `/focus` backend exists in the current stack.",
      "Executions, tasks, calendar, and human-ops already define the real work loop.",
      "Focus should become a thin but high-value orchestration surface over those domains.",
    ],
    draftCapabilities: [
      "Show focus as part of the real work system.",
      "Connect attention management to executions and agenda context.",
      "Avoid a fake timer app that teaches the wrong product behavior.",
    ],
    buildTracks: [
      "Add durable focus blocks linked to executions and calendar entries.",
      "Support session starts from active tasks and executions.",
      "Reflect focus outcomes back into day review and retrospectives.",
    ],
    relatedActions: [
      { label: "Open Executions", appId: "executions", note: "Pair focus with real runtime work" },
      { label: "Open Tasks", appId: "tasks", note: "Choose the next concrete work slice" },
      { label: "Open Agenda", appId: "agenda", note: "Place focus blocks inside the day plan" },
    ],
    operatorNotes: [
      "Focus should help work happen, not just measure time passing.",
      "Integrate with active executions before building standalone focus analytics.",
    ],
  },
  responsibilities: {
    appId: "responsibilities",
    eyebrow: "Ownership Map",
    headline: "Track obligations and roles in a way the rest of EMA can use.",
    summary:
      "Responsibilities should help encode durable obligations across life, work, and system maintenance. This draft makes the app a design-ready ownership surface instead of a broken CRUD shell.",
    status: "Ownership mapping draft",
    maturity: "first-draft",
    primaryQuestion: "What recurring obligations should shape planning and review across human and agent work?",
    currentTruth: [
      "No active `/responsibilities` backend exists today.",
      "Goals, projects, tasks, and spaces already carry parts of responsibility indirectly.",
      "A future responsibilities model should clarify ownership rather than duplicate tasks.",
    ],
    draftCapabilities: [
      "Define the role of responsibility tracking in EMA.",
      "Connect ownership to goals, projects, and review outcomes.",
      "Preserve the domain as a first-class future build target.",
    ],
    buildTracks: [
      "Introduce durable responsibility records linked to spaces and goals.",
      "Support role-based planning and review slices.",
      "Surface neglected obligations inside Desk or HQ.",
    ],
    relatedActions: [
      { label: "Open Goals", appId: "goals", note: "Link obligations to owned outcomes" },
      { label: "Open Projects", appId: "projects", note: "Connect role ownership to project load" },
      { label: "Open Review", appId: "proposals", note: "Translate obligations into concrete work" },
    ],
    operatorNotes: [
      "Responsibilities should answer 'who owns this over time?' not just 'what is the next task?'.",
      "This domain is useful only if it tightens accountability across the system.",
    ],
  },
  temporal: {
    appId: "temporal",
    eyebrow: "Rhythm Intelligence",
    headline: "Model human energy and timing as part of the work loop.",
    summary:
      "Temporal remains a valuable idea, but its current routes do not exist. This draft turns it into a coherent rhythm-intelligence concept tied to daily planning, focus, and reflection until a real backend is ready.",
    status: "Rhythm intelligence draft",
    maturity: "first-draft",
    primaryQuestion: "How should EMA adapt work to time, energy, and rhythm?",
    currentTruth: [
      "There is no active `/temporal` backend in the Electron stack.",
      "Calendar, Human Ops, and future Focus/Journal layers are the right places to consume timing intelligence.",
      "Temporal should become a recommendation layer over live planning data.",
    ],
    draftCapabilities: [
      "Keep the domain visible and product-shaped.",
      "Tie rhythm intelligence to the real operating loop.",
      "Prevent the old dead-route app from encoding wrong expectations.",
    ],
    buildTracks: [
      "Add energy/rhythm logging backed by the live backend.",
      "Generate timing recommendations from calendar and execution history.",
      "Surface recommended work modes inside Desk and Agenda.",
    ],
    relatedActions: [
      { label: "Open Agenda", appId: "agenda", note: "Timing belongs inside the day plan" },
      { label: "Open Focus", appId: "focus", note: "Translate rhythm into work blocks" },
      { label: "Open Journal", appId: "journal", note: "Reflect on timing and energy patterns" },
    ],
    operatorNotes: [
      "Temporal should become smart scheduling guidance, not a separate toy dashboard.",
      "Keep the eventual backend recommendation-oriented and tightly integrated.",
    ],
  },
  campaigns: {
    appId: "campaigns",
    eyebrow: "Multi-Step Operations",
    headline: "Frame campaigns as orchestrated work, not a dead legacy workflow editor.",
    summary:
      "Campaigns belongs in EMA as a multi-step orchestration and rollout surface. The current routes are absent, so this draft positions the app around proposals, executions, agents, and future automation instead of broken CRUD.",
    status: "Operational orchestration draft",
    maturity: "first-draft",
    primaryQuestion: "How should EMA package repeated or staged multi-step work?",
    currentTruth: [
      "The current backend does not own `/campaigns` or `/campaign-runs`.",
      "Executions, proposals, pipes, and agents are the live operational primitives today.",
      "Campaigns should emerge from those primitives rather than reintroducing a separate legacy subsystem.",
    ],
    draftCapabilities: [
      "Define the future orchestration role clearly.",
      "Connect campaign thinking to live runtime surfaces now.",
      "Keep the app feeling purposeful instead of abandoned.",
    ],
    buildTracks: [
      "Model campaign templates over proposals, executions, and pipes.",
      "Support staged rollouts and multi-agent runbooks.",
      "Add real run history only after orchestration contracts exist.",
    ],
    relatedActions: [
      { label: "Open Proposals", appId: "proposals", note: "Package staged work from approved ideas" },
      { label: "Open Executions", appId: "executions", note: "Use the live runtime ledger as the base" },
      { label: "Open Pipes", appId: "pipes", note: "Connect campaigns to automation" },
    ],
    operatorNotes: [
      "Campaigns should become an orchestration layer, not a duplicate task board.",
      "Design it around repeatability, staging, and observability.",
    ],
  },
  "decision-log": {
    appId: "decision-log",
    eyebrow: "Decision Memory",
    headline: "Preserve important calls with provenance and downstream impact.",
    summary:
      "Decision logging is strategically important, but the active backend does not yet own a decision domain. This draft keeps the concept alive and tied to Blueprint, Review, and Proposals rather than a dead standalone store.",
    status: "Decision memory draft",
    maturity: "first-draft",
    primaryQuestion: "Which decisions matter enough to preserve, inspect, and route into future work?",
    currentTruth: [
      "The renderer's old decision-log store is not backed by an active backend domain.",
      "Blueprint cards, Review decisions, and proposal approvals already capture high-value decision points.",
      "A future decision layer should unify those records instead of duplicating them.",
    ],
    draftCapabilities: [
      "Give the decision domain an honest place in the system.",
      "Connect it to the current review and planning layers.",
      "Prepare for a unified durable decision ledger later.",
    ],
    buildTracks: [
      "Aggregate Blueprint, Review, and proposal decisions into one ledger.",
      "Add provenance and downstream work links.",
      "Expose decisions to HQ, Governance, and future knowledge views.",
    ],
    relatedActions: [
      { label: "Open Blueprint Planner", appId: "blueprint-planner", note: "Architecture decisions start here" },
      { label: "Open Proposals", appId: "proposals", note: "Operational decisions become queue state" },
      { label: "Open Intent Schematic", appId: "intent-schematic", note: "Trace decisions into runtime work" },
    ],
    operatorNotes: [
      "The decision log should become a convergence layer, not another isolated app database.",
      "Capture provenance first, commentary second.",
    ],
  },
  hq: {
    appId: "hq",
    eyebrow: "Strategic Command Surface",
    headline: "Make HQ ambitious but honest while the backend catches up.",
    summary:
      "HQ is still the intended strategic command center for EMA. This draft frames it as a composition surface over live apps and future control systems instead of overselling it as fully operational today.",
    status: "Command-center draft",
    maturity: "connected-preview",
    primaryQuestion: "What deserves top-level strategic visibility in EMA, and what should stay in lower-level apps?",
    currentTruth: [
      "HQ currently aggregates a mix of live and absent endpoints.",
      "Desk remains the truthful day home; HQ should stay strategically distinct.",
      "A good HQ should emphasize visibility, routing, and intervention rather than duplicating every domain.",
    ],
    draftCapabilities: [
      "Position HQ as a connected overview surface.",
      "Keep strategic framing while the backend converges.",
      "Link directly to the apps that are real today.",
    ],
    buildTracks: [
      "Bind HQ panels only to active backend domains.",
      "Add intervention flows for proposals, executions, review, and feeds.",
      "Promote HQ once the command-center contract is truly honest.",
    ],
    relatedActions: [
      { label: "Open Desk", appId: "desk", note: "Return to truthful daily control" },
      { label: "Open Executions", appId: "executions", note: "Inspect live runtime work" },
      { label: "Open Proposals", appId: "proposals", note: "Manage the queue that drives work" },
    ],
    operatorNotes: [
      "HQ should feel bold, but it should not lie.",
      "Keep it strategic until the underlying surfaces are ready for stronger aggregation.",
    ],
  },
};
