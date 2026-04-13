alias Ema.Canvases

canvas_id = "cvs_1775522736219_05ef3ec2"

# Verify canvas exists
{:ok, canvas} = Canvases.get_canvas(canvas_id)
IO.puts("Populating canvas: #{canvas.name}")

# Helper to create elements concisely
create = fn attrs ->
  case Canvases.create_element(canvas_id, attrs) do
    {:ok, el} -> IO.puts("  + #{el.element_type}: #{el.text || "(connection)"}")
    {:error, cs} -> IO.puts("  ! ERROR: #{inspect(cs.errors)}")
  end
end

# ═══════════════════════════════════════════════════════════════
# LAYER LABELS (left column)
# ═══════════════════════════════════════════════════════════════

create.(%{element_type: "text", x: 20, y: 60, width: 160, height: 40, z_index: 10,
  text: "SURFACES",
  style: %{"fontSize" => 16, "fontWeight" => "bold", "color" => "#7dd3fc", "opacity" => 0.7}})

create.(%{element_type: "text", x: 20, y: 280, width: 160, height: 40, z_index: 10,
  text: "WEB LAYER",
  style: %{"fontSize" => 16, "fontWeight" => "bold", "color" => "#a78bfa", "opacity" => 0.7}})

create.(%{element_type: "text", x: 20, y: 500, width: 200, height: 40, z_index: 10,
  text: "CORE PIPELINE",
  style: %{"fontSize" => 16, "fontWeight" => "bold", "color" => "#f59e0b", "opacity" => 0.7}})

create.(%{element_type: "text", x: 20, y: 740, width: 200, height: 40, z_index: 10,
  text: "DOMAIN CONTEXTS",
  style: %{"fontSize" => 16, "fontWeight" => "bold", "color" => "#34d399", "opacity" => 0.7}})

create.(%{element_type: "text", x: 20, y: 1020, width: 200, height: 40, z_index: 10,
  text: "KNOWLEDGE & AGENTS",
  style: %{"fontSize" => 16, "fontWeight" => "bold", "color" => "#fb923c", "opacity" => 0.7}})

create.(%{element_type: "text", x: 20, y: 1280, width: 200, height: 40, z_index: 10,
  text: "INFRASTRUCTURE",
  style: %{"fontSize" => 16, "fontWeight" => "bold", "color" => "#94a3b8", "opacity" => 0.7}})

# ═══════════════════════════════════════════════════════════════
# ROW 1: SURFACES (y=50) — Entry points into EMA
# ═══════════════════════════════════════════════════════════════

surface_style = %{"fill" => "#1e293b", "stroke" => "#7dd3fc", "strokeWidth" => 2,
  "borderRadius" => 12, "fontSize" => 11, "color" => "#e2e8f0", "textAlign" => "center"}

create.(%{element_type: "rectangle", x: 200, y: 40, width: 220, height: 80, z_index: 2,
  text: "Tauri 2 Desktop\nReact 19 + Zustand\n52 vApps · 73 stores", style: surface_style})

create.(%{element_type: "rectangle", x: 450, y: 40, width: 180, height: 80, z_index: 2,
  text: "CLI (ema)\nElixir escript v3\nAll domain commands", style: surface_style})

create.(%{element_type: "rectangle", x: 660, y: 40, width: 200, height: 80, z_index: 2,
  text: "MCP Server\nJSON-RPC 2.0 / stdio\n23 tools · 10 resources", style: surface_style})

create.(%{element_type: "rectangle", x: 890, y: 40, width: 180, height: 80, z_index: 2,
  text: "Discord Bridge\n7 semantic lanes\nAdaptive cadence", style: surface_style})

create.(%{element_type: "rectangle", x: 1100, y: 40, width: 180, height: 80, z_index: 2,
  text: "Jarvis Orb\nAlways-on 80x80\nVoice + ambient", style: surface_style})

# ═══════════════════════════════════════════════════════════════
# ROW 2: WEB LAYER (y=260)
# ═══════════════════════════════════════════════════════════════

web_style = %{"fill" => "#1e1b2e", "stroke" => "#a78bfa", "strokeWidth" => 2,
  "borderRadius" => 12, "fontSize" => 11, "color" => "#e2e8f0", "textAlign" => "center"}

create.(%{element_type: "rectangle", x: 200, y: 250, width: 280, height: 90, z_index: 2,
  text: "Phoenix Router\n318+ REST routes\n/api/* namespace\nBandit HTTP adapter", style: web_style})

create.(%{element_type: "rectangle", x: 510, y: 250, width: 240, height: 90, z_index: 2,
  text: "Controllers (50+)\nOne per domain\nJSON responses\nPubSub broadcast on mutation", style: web_style})

create.(%{element_type: "rectangle", x: 780, y: 250, width: 240, height: 90, z_index: 2,
  text: "Phoenix Channels (37)\nReal-time WebSocket push\ntopic:context pattern\nPubSub-backed broadcast", style: web_style})

create.(%{element_type: "rectangle", x: 1050, y: 250, width: 230, height: 90, z_index: 2,
  text: "Phoenix PubSub\nIn-process event bus\n70+ topics\nAll mutations broadcast", style: web_style})

# ═══════════════════════════════════════════════════════════════
# ROW 3: CORE PIPELINE (y=480) — Autonomous thinking flow
# ═══════════════════════════════════════════════════════════════

pipeline_style = %{"fill" => "#292524", "stroke" => "#f59e0b", "strokeWidth" => 2,
  "borderRadius" => 12, "fontSize" => 11, "color" => "#fde68a", "textAlign" => "center"}

create.(%{element_type: "rectangle", x: 200, y: 470, width: 200, height: 100, z_index: 3,
  text: "Brain Dump\nLowest-friction capture\nema dump \"thought\"\nAsync embedding\nIntent clustering",
  style: pipeline_style})

create.(%{element_type: "rectangle", x: 440, y: 470, width: 200, height: 100, z_index: 3,
  text: "Intent System\n6-level hierarchy (L0-L5)\nFilesystem canonical\nDB runtime queryable\nDual-layer sync",
  style: pipeline_style})

create.(%{element_type: "rectangle", x: 680, y: 470, width: 220, height: 100, z_index: 3,
  text: "Proposal Engine\n9-stage pipeline\nGenerate > Refine > Debate\nScore > Tag > Combine\nVector dedup (cos>0.85)",
  style: pipeline_style})

create.(%{element_type: "rectangle", x: 940, y: 470, width: 200, height: 100, z_index: 3,
  text: "Execution System\nRuntime lifecycle objects\n5 modes x 5 phases\nContext assembly\nReflexion lessons",
  style: pipeline_style})

create.(%{element_type: "rectangle", x: 1180, y: 470, width: 200, height: 100, z_index: 3,
  text: "Babysitter\nAdaptive observability\n7 semantic lanes\n4 cadence buckets\n3 emission tiers",
  style: pipeline_style})

# Pipeline flow arrows
arrow_style = %{"stroke" => "#f59e0b", "strokeWidth" => 2}

create.(%{element_type: "connection", x: 0, y: 0, width: 0, height: 0, z_index: 1,
  points: [%{"x" => 400, "y" => 520}, %{"x" => 440, "y" => 520}], style: arrow_style})
create.(%{element_type: "connection", x: 0, y: 0, width: 0, height: 0, z_index: 1,
  points: [%{"x" => 640, "y" => 520}, %{"x" => 680, "y" => 520}], style: arrow_style})
create.(%{element_type: "connection", x: 0, y: 0, width: 0, height: 0, z_index: 1,
  points: [%{"x" => 900, "y" => 520}, %{"x" => 940, "y" => 520}], style: arrow_style})
create.(%{element_type: "connection", x: 0, y: 0, width: 0, height: 0, z_index: 1,
  points: [%{"x" => 1140, "y" => 520}, %{"x" => 1180, "y" => 520}], style: arrow_style})

# ═══════════════════════════════════════════════════════════════
# ROW 4: DOMAIN CONTEXTS (y=720)
# ═══════════════════════════════════════════════════════════════

domain_style = %{"fill" => "#0f2620", "stroke" => "#34d399", "strokeWidth" => 2,
  "borderRadius" => 12, "fontSize" => 11, "color" => "#d1fae5", "textAlign" => "center"}

create.(%{element_type: "rectangle", x: 200, y: 710, width: 160, height: 90, z_index: 2,
  text: "Tasks\nStatus lifecycle\nProject-scoped\nComments, deps", style: domain_style})

create.(%{element_type: "rectangle", x: 380, y: 710, width: 160, height: 90, z_index: 2,
  text: "Projects\nLinked to filesystem\nContext bundles\nWorker registry", style: domain_style})

create.(%{element_type: "rectangle", x: 560, y: 710, width: 140, height: 90, z_index: 2,
  text: "Goals\nParent-child\nTop-level objectives\nIntent L0-L1 map", style: domain_style})

create.(%{element_type: "rectangle", x: 720, y: 710, width: 140, height: 90, z_index: 2,
  text: "Habits\nDaily/weekly/monthly\nStreak tracking\nCompletion rates", style: domain_style})

create.(%{element_type: "rectangle", x: 880, y: 710, width: 140, height: 90, z_index: 2,
  text: "Journal\nDaily entries\nFTS5 full-text\nMood + energy", style: domain_style})

create.(%{element_type: "rectangle", x: 1040, y: 710, width: 140, height: 90, z_index: 2,
  text: "Focus Timer\nPomodoro sessions\nTask-linked\n45/15 config", style: domain_style})

create.(%{element_type: "rectangle", x: 1200, y: 710, width: 160, height: 90, z_index: 2,
  text: "Responsibilities\nHealth scoring\nScheduled check-ins\nDecay calculation", style: domain_style})

# ═══════════════════════════════════════════════════════════════
# ROW 5: KNOWLEDGE & AGENTS (y=980)
# ═══════════════════════════════════════════════════════════════

knowledge_style = %{"fill" => "#2a1f0e", "stroke" => "#fb923c", "strokeWidth" => 2,
  "borderRadius" => 12, "fontSize" => 11, "color" => "#fed7aa", "textAlign" => "center"}

create.(%{element_type: "rectangle", x: 200, y: 970, width: 240, height: 100, z_index: 2,
  text: "Vault / SecondBrain\nMarkdown + SQLite FTS5\nVaultWatcher · GraphBuilder\nwiki/ canonical, intents/ derived\nAgent-writability rules",
  style: knowledge_style})

create.(%{element_type: "rectangle", x: 470, y: 970, width: 220, height: 100, z_index: 2,
  text: "Agent System\nDynamicSupervisor per agent\nMemory + Worker + Channels\nDiscord · Telegram · Webchat\nConversation threading",
  style: knowledge_style})

create.(%{element_type: "rectangle", x: 720, y: 970, width: 200, height: 100, z_index: 2,
  text: "Pipes & Automation\n22 triggers · 15 actions\n7 stock pipes\nEvent-driven transforms\nRegistry + Loader + Executor",
  style: knowledge_style})

create.(%{element_type: "rectangle", x: 950, y: 970, width: 200, height: 100, z_index: 2,
  text: "Context Assembly\n3 paths: Assembler,\nBuilder, Injector\nHot/Warm/Cold tiers\n4000 token budget",
  style: knowledge_style})

create.(%{element_type: "rectangle", x: 1180, y: 970, width: 200, height: 100, z_index: 2,
  text: "Claude Sessions\nSessionWatcher\nSessionMonitor · Parser\nLinker · Usage tracking\nBridge dispatch",
  style: knowledge_style})

# ═══════════════════════════════════════════════════════════════
# ROW 6: INFRASTRUCTURE (y=1240)
# ═══════════════════════════════════════════════════════════════

infra_style = %{"fill" => "#1e1e24", "stroke" => "#94a3b8", "strokeWidth" => 2,
  "borderRadius" => 12, "fontSize" => 11, "color" => "#cbd5e1", "textAlign" => "center"}

create.(%{element_type: "rectangle", x: 200, y: 1240, width: 220, height: 100, z_index: 2,
  text: "OTP Supervision Tree\none_for_one root\n70+ always-on children\nDynamic domain supervisors\n3-tier depth",
  style: infra_style})

create.(%{element_type: "rectangle", x: 450, y: 1240, width: 200, height: 100, z_index: 2,
  text: "SQLite + Ecto\necto_sqlite3\n84 tables · 117 migrations\nFTS5 full-text index\n~/.local/share/ema/ema.db",
  style: infra_style})

create.(%{element_type: "rectangle", x: 680, y: 1240, width: 220, height: 100, z_index: 2,
  text: "Intelligence Layer\nTokenTracker · TrustScorer\nVmMonitor · CostForecaster\nUCBRouter · VaultLearner\nBudgetEnforcer · GapScanner",
  style: infra_style})

create.(%{element_type: "rectangle", x: 930, y: 1240, width: 200, height: 100, z_index: 2,
  text: "AI Provider Routing\nSmartRouter (6 strategies)\nCircuit breaker per provider\nAccount rotation on 429\nQuality gate scoring",
  style: infra_style})

create.(%{element_type: "rectangle", x: 1160, y: 1240, width: 220, height: 100, z_index: 2,
  text: "Conditional Subsystems\nBabysitter · Orchestration\nCanvas · Voice · Evolution\nMCP · Git Watcher\nHarvesters · Temporal",
  style: infra_style})

# ═══════════════════════════════════════════════════════════════
# INTER-LAYER CONNECTIONS (dashed lines)
# ═══════════════════════════════════════════════════════════════

dash_style = %{"stroke" => "#475569", "strokeWidth" => 1, "strokeDasharray" => "4,4"}

# Surfaces → Web Layer
create.(%{element_type: "connection", x: 0, y: 0, width: 0, height: 0, z_index: 0,
  points: [%{"x" => 310, "y" => 120}, %{"x" => 340, "y" => 250}], style: dash_style})
create.(%{element_type: "connection", x: 0, y: 0, width: 0, height: 0, z_index: 0,
  points: [%{"x" => 540, "y" => 120}, %{"x" => 500, "y" => 250}], style: dash_style})
create.(%{element_type: "connection", x: 0, y: 0, width: 0, height: 0, z_index: 0,
  points: [%{"x" => 760, "y" => 120}, %{"x" => 700, "y" => 250}], style: dash_style})
create.(%{element_type: "connection", x: 0, y: 0, width: 0, height: 0, z_index: 0,
  points: [%{"x" => 980, "y" => 120}, %{"x" => 900, "y" => 295}], style: dash_style})

# Web Layer → Core Pipeline
create.(%{element_type: "connection", x: 0, y: 0, width: 0, height: 0, z_index: 0,
  points: [%{"x" => 400, "y" => 340}, %{"x" => 350, "y" => 470}], style: dash_style})
create.(%{element_type: "connection", x: 0, y: 0, width: 0, height: 0, z_index: 0,
  points: [%{"x" => 630, "y" => 340}, %{"x" => 640, "y" => 470}], style: dash_style})
create.(%{element_type: "connection", x: 0, y: 0, width: 0, height: 0, z_index: 0,
  points: [%{"x" => 900, "y" => 340}, %{"x" => 900, "y" => 470}], style: dash_style})

# Core Pipeline → Domains
create.(%{element_type: "connection", x: 0, y: 0, width: 0, height: 0, z_index: 0,
  points: [%{"x" => 540, "y" => 570}, %{"x" => 460, "y" => 710}], style: dash_style})
create.(%{element_type: "connection", x: 0, y: 0, width: 0, height: 0, z_index: 0,
  points: [%{"x" => 540, "y" => 570}, %{"x" => 280, "y" => 710}], style: dash_style})
create.(%{element_type: "connection", x: 0, y: 0, width: 0, height: 0, z_index: 0,
  points: [%{"x" => 1040, "y" => 570}, %{"x" => 1040, "y" => 710}], style: dash_style})

# Domains → Knowledge
create.(%{element_type: "connection", x: 0, y: 0, width: 0, height: 0, z_index: 0,
  points: [%{"x" => 380, "y" => 800}, %{"x" => 320, "y" => 970}], style: dash_style})
create.(%{element_type: "connection", x: 0, y: 0, width: 0, height: 0, z_index: 0,
  points: [%{"x" => 630, "y" => 800}, %{"x" => 580, "y" => 970}], style: dash_style})
create.(%{element_type: "connection", x: 0, y: 0, width: 0, height: 0, z_index: 0,
  points: [%{"x" => 1050, "y" => 800}, %{"x" => 1050, "y" => 970}], style: dash_style})

# Knowledge → Infrastructure
create.(%{element_type: "connection", x: 0, y: 0, width: 0, height: 0, z_index: 0,
  points: [%{"x" => 320, "y" => 1070}, %{"x" => 450, "y" => 1240}], style: dash_style})
create.(%{element_type: "connection", x: 0, y: 0, width: 0, height: 0, z_index: 0,
  points: [%{"x" => 820, "y" => 1070}, %{"x" => 790, "y" => 1240}], style: dash_style})
create.(%{element_type: "connection", x: 0, y: 0, width: 0, height: 0, z_index: 0,
  points: [%{"x" => 1050, "y" => 1070}, %{"x" => 1030, "y" => 1240}], style: dash_style})

# ═══════════════════════════════════════════════════════════════
# RIGHT SIDEBAR: Knowledge Topology
# ═══════════════════════════════════════════════════════════════

create.(%{element_type: "text", x: 1460, y: 40, width: 300, height: 30, z_index: 10,
  text: "THREE TRUTH DOMAINS",
  style: %{"fontSize" => 14, "fontWeight" => "bold", "color" => "#e2e8f0", "opacity" => 0.9}})

create.(%{element_type: "sticky", x: 1460, y: 80, width: 300, height: 130, z_index: 2,
  text: "SEMANTIC (Intent Engine)\nFilesystem: .superman/intents/<slug>/\nDB runtime: intents, intent_links, intent_events\nCanonical anchor — loss = data loss\n6 levels: Vision > Strategy > Objective\n> Initiative > Task > Step",
  style: %{"color" => "#fbbf24", "fontSize" => 10}})

create.(%{element_type: "sticky", x: 1460, y: 230, width: 300, height: 110, z_index: 2,
  text: "OPERATIONAL (Home Domains)\nExecutions, sessions, proposals, tasks, goals\nStored in home tables, not absorbed\nBridged via IntentLink (polymorphic join)\n12 roles · 9 provenances",
  style: %{"color" => "#34d399", "fontSize" => 10}})

create.(%{element_type: "sticky", x: 1460, y: 360, width: 300, height: 130, z_index: 2,
  text: "KNOWLEDGE (Multi-source)\nCurated: wiki/ (highest trust)\nProject: vault/projects/ema/\nImports: vault/imports/host/ & /agent-vm/\nHost: ~/vault/ (QMD-indexed)\nRule: curated > generated > imported",
  style: %{"color" => "#fb923c", "fontSize" => 10}})

# Key Stats
create.(%{element_type: "text", x: 1460, y: 520, width: 300, height: 30, z_index: 10,
  text: "SYSTEM STATS",
  style: %{"fontSize" => 14, "fontWeight" => "bold", "color" => "#e2e8f0", "opacity" => 0.9}})

create.(%{element_type: "sticky", x: 1460, y: 560, width: 300, height: 200, z_index: 2,
  text: "150+ Elixir modules\n55+ domain contexts\n50+ controllers · 37 channels\n318+ REST routes\n84 SQLite tables · 117 migrations\n52+ React vApps · 73 Zustand stores\n23 MCP tools · 10 MCP resources\n7 semantic lanes · 9 proposal stages\n6 intent levels · 5 execution modes\nPort 4488 (daemon) · 1420 (dev)",
  style: %{"color" => "#a78bfa", "fontSize" => 10}})

# Design Principles
create.(%{element_type: "text", x: 1460, y: 790, width: 300, height: 30, z_index: 10,
  text: "DESIGN PRINCIPLES",
  style: %{"fontSize" => 14, "fontWeight" => "bold", "color" => "#e2e8f0", "opacity" => 0.9}})

create.(%{element_type: "sticky", x: 1460, y: 830, width: 300, height: 170, z_index: 2,
  text: "Filesystem as canonical anchor\nIntent folders read like documentation\nNo curated overwrite by generated\nProvisional until promoted\nProvenance labels always\nNo blind merge — surface conflicts\nPromotion requires thresholds\nL0-2 needs operator confirmation",
  style: %{"color" => "#94a3b8", "fontSize" => 10}})

# Data flow legend
create.(%{element_type: "text", x: 1460, y: 1030, width: 300, height: 30, z_index: 10,
  text: "DATA FLOW LEGEND",
  style: %{"fontSize" => 14, "fontWeight" => "bold", "color" => "#e2e8f0", "opacity" => 0.9}})

create.(%{element_type: "sticky", x: 1460, y: 1070, width: 300, height: 140, z_index: 2,
  text: "Solid amber arrows = Core pipeline flow\nDashed gray lines = Layer-to-layer calls\n\nREST: Initial load (store.loadViaRest)\nWebSocket: Real-time sync (store.connect)\nPubSub: Internal event broadcast\nStdio: MCP JSON-RPC to Claude Code",
  style: %{"color" => "#64748b", "fontSize" => 10}})

IO.puts("\nDone! Canvas populated with architecture elements.")
