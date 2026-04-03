# EMA Patterns Discovered

**Researcher Agent — Pattern Detection Layer**
**Date:** 2026-04-03
**Status:** Living document — patterns crystallize from usage. Sprint 1 patterns below. Update monthly.

---

## What Is a Pattern?

A **pattern** is a recurring structure in the codebase, architecture, or UX that appears 3+ times independently. Patterns can be:
- **Structural** — how code is organized
- **Interaction** — how users engage with features
- **Data** — how information flows
- **Anti-pattern** — what keeps breaking

Patterns at **5+ successes / 70%+ rate** → crystallization candidate (convert to skill, script, or AGENTS.md shortcut).

---

## Sprint 1 Patterns (observed from codebase analysis)

---

### P-001: The GenServer + PubSub Observer Pattern

**Appearances:** GapScanner, VmMonitor, GapInbox, SessionWatcher, Scheduler, TrustScorer, Combiner, KillMemory

**Structure:**
```elixir
defmodule Ema.Some.Worker do
  use GenServer

  @interval :timer.minutes(N)

  def init(state) do
    Process.send_after(self(), :tick, initial_delay)
    {:ok, state}
  end

  def handle_info(:tick, state) do
    do_work()
    EmaWeb.Endpoint.broadcast("channel:name", "event_type", %{data: ...})
    schedule_next()
    {:noreply, state}
  end
end
```

**What It Enables:** Background workers that observe system state, react to changes, and broadcast results to the frontend via Phoenix channels. Fully decoupled — the worker doesn't know what's listening.

**Pattern strength:** Appears in 8+ modules. Well-established. ✅

**Note for Architect:** Consider a `Ema.Workers.Periodic` behavior module that provides `use Ema.Workers.Periodic, interval: :timer.minutes(60)` and just requires `handle_tick/1` callback. Would reduce boilerplate.

---

### P-002: Ecto Schema + Context + REST Controller Triad

**Appearances:** All 16+ domain modules (Tasks, Proposals, Projects, Habits, Journal, etc.)

**Structure:**
```
Ema.Domain.Schema — Ecto schema (changeset, validations)
Ema.Domain — Context module (CRUD functions, business logic)
EmaWeb.DomainController — REST controller
EmaWeb.DomainChannel — Phoenix channel for real-time
domain-store.ts — Zustand store (loadViaRest + connect)
DomainApp.tsx — React component
```

**Pattern strength:** Every feature follows this. The 6-layer pattern is EMA's architectural backbone.

**Crystallization status:** Already crystallized — it's the established architecture. New features MUST follow this pattern. Any deviation is tech debt.

**Anti-pattern risk:** The `Goals` and `Notes` modules are scaffolded but missing the full 6 layers. They have schema + context but no controller, channel, store, or UI. This creates invisible gaps. New scaffolded modules should either be complete or explicitly marked `TODO: incomplete scaffold`.

---

### P-003: The loadViaRest + connect() Init Pattern

**Appearances:** All 15 Zustand stores

**Structure:**
```typescript
// Every store follows:
const init = async () => {
  try {
    await store.loadViaRest();
    store.setReady(true);
  } catch (e) {
    store.setError(e.message);
    store.setReady(true); // always set ready so UI renders
  }
  
  try {
    await store.connect(); // join Phoenix channel
  } catch { /* swallow */ }
};
```

**Pattern strength:** 15/15 stores. Absolutely consistent.

**Fragility:** If the daemon isn't running, every store fails its REST load silently. The error state shows a banner but the store is marked "ready" with empty data. This means the UI renders empty — not broken, but visually identical to "no data exists yet."

**Recommendation:** Add a "daemon status" store that pings `/api/health` on init. If health check fails, show a global "Daemon not running" overlay rather than 15 separate error banners. This is the pattern Linear and Raycast use for offline state.

---

### P-004: Glass Surface Tier Signal

**Appearances:** All UI components (ProposalCard, TaskCard, ProjectGrid, NoteEditor, etc.)

**CSS classes observed:**
- `.glass-ambient` — app backgrounds, sidebar fills
- `.glass-surface` — cards, list items, panels
- `.glass-elevated` — modals, active/focused states, dropdowns

**UX pattern strength:** Strong. Consistent across all 13 app components.

**Detected inconsistency:** Some components applied both `glass-surface` CSS class AND inline `border: 1px solid var(--pn-border-subtle)`. The inline style overrides the class border. This was patched in FIXES.md (2026-03-30) but suggests the pattern needs a lint rule or prop-based abstraction.

**Recommendation:** Create a `<GlassCard tier="surface|elevated|ambient" />` component that encapsulates the correct class. Eliminates override risk entirely. 5 lines of code, 0 CSS footguns.

---

### P-005: The Three-Action Decision Pattern

**Appearances:** Proposals (approve/redirect/kill), Tasks (todo/in_progress/done), Responsibilities (healthy/at_risk/failing), Sessions (link/ignore/archive)

**Structure:** Binary or trinary action options on any reviewable entity. The "middle" action (redirect, block, at_risk) is the most informative — it signals nuance rather than a hard yes/no.

**UX implication:** EMA's mental model is consistent: everything that needs human judgment gets a structured 2-3 option response. This matches Trajan's documented preference for "action over deliberation."

**Crystallization candidate:** Should be a standard component:
```typescript
<DecisionButtons
  onApprove={() => ...}
  onRedirect={() => ...}  // optional — shows text input
  onKill={() => ...}
  redirectLabel="Redirect..."
/>
```

---

### P-006: Context Injection as Quality Multiplier

**Appearances:** Generator, Refiner, Debater, Scorer (all use ContextManager), AgentWorker (injects personality + history), GitHarvester (seeds enriched with repo context)

**Structure:** Every Claude CLI call assembles context before prompting:
1. Base prompt (task-specific)
2. Project context doc (project summary + decisions + recent sessions)
3. Recent similar outputs (avoid repetition)
4. User preferences (from vault user-preferences space)

**Pattern strength:** 5+ callsites. The `ContextManager.build_prompt/1` abstraction is correct.

**Gap discovered:** The user-preferences vault space (`~/.local/share/ema/vault/user-preferences/`) feeds into context injection — but it's manually maintained. If Trajan never writes preferences there, the proposals are uncalibrated. This is an onboarding gap.

**Recommendation:** Ship a "Preferences Onboarding" step in EMA's first-run flow that asks Trajan to fill in 5-10 preferences. Pre-populate from vault/Trajan/Preferences.md if it exists.

---

### P-007: Seed → Pipeline → Queue → Action Feedback Loop

**Appearances:** Proposal Engine (main loop), Responsibility → Task generation, Brain Dump Harvester → Seeds

**Structure:**
```
[Input Source] → Seed → Generator → Queue → Human Action → [Consequence]
                          ↑                           |
                          └───────────────────────────┘ (feedback)
```

**Pattern strength:** This is EMA's fundamental learning loop. Proposals killed → KillMemory learns. Proposals approved → dependency seeds created. Redirect → 3 fork seeds.

**Observation:** The feedback loop is incomplete. The "consequence" stage (what happens after a task created from a proposal is COMPLETED?) doesn't feed back. Trajan approves a proposal → task created → task completed. Does that improve future proposal quality? Not yet. The outcome feedback path is unbuilt.

**Crystallization candidate:** Add a `proposal_outcomes` table (proposal_id, task_id, outcome: success|abandoned|partial, completion_time_days). Feed aggregate stats into ContextManager as "proposals that typically succeed have these traits."

---

### P-008: GenServer State + DB as Dual State

**Appearances:** KillMemory, Scheduler, TrustScorer, GapScanner

**Structure:** GenServer holds hot state in process memory (quick access). SQLite holds cold state (persistence). On `init`, GenServer loads from DB. On change, GenServer updates both memory + DB.

**Problem detected:** Most GenServers have `init/1` that starts fresh rather than reloading from DB. Example: `GapScanner.init/1` only schedules the first scan at 30s delay — it doesn't reload previous gap results. After a daemon restart, gaps disappear from the in-memory scanner until the first scan completes.

This is subtle: users won't see broken behavior, but they'll see gaps disappearing and reappearing after restarts. Confusing.

**Recommendation:** Each GenServer `init/1` should log how much state was reloaded from DB. "KillMemory loaded 23 patterns." "GapScanner: last scan was 14 minutes ago, 7 gaps remain open." This makes state recovery transparent.

---

## Anti-Patterns Detected

---

### AP-001: Incomplete Scaffold Syndrome

**Symptom:** Several modules exist with schema + context but no controller, channel, or frontend component.

**Examples from codebase:**
- `Ema.Goals` — schema + API stub, no UI
- `Ema.Focus` — schema, no GenServer, no UI
- `Ema.Notes` — overlaps with SecondBrain, no clear ownership

**Risk:** These appear in `Application.ex` supervision tree and `mix compile` output, creating false impression of completeness. When Trajan asks "what's the status of Goals?" there's no answer.

**Fix:** Add a `STATUS.md` to EMA listing all modules with completion status (schema only / partial / complete). Required for Sprint planning.

---

### AP-002: Tool Execution Gap

**Symptom:** Agents can only call one tool (`brain_dump:create_item`). The tool registry in `Ema.Pipes.Registry` has many more actions registered, but AgentWorker only implements one executor.

**Risk:** Agents that promise to "create tasks, write vault notes, create proposal seeds" actually can't do most of those things. Trajan will discover this in real usage when an agent says "I created the task" but nothing appears in Tasks.

**Fix:** Implement the remaining tool executors in `AgentWorker`. Priority order:
1. `tasks:create` — most common
2. `vault:create_note` — second most common
3. `proposals:create_seed` — third
4. `brain_dump:create_item` — already done

---

### AP-003: Channel Adapter Blocking Pattern

**Symptom:** Discord and Telegram adapters are stubbed with `# TODO: need nostrum/ex_gram deps`. This blocks the "Channels God Mode" feature claimed in Sprint 1.

**Risk:** EMA shipped EMA-006 (Channels God Mode) but the channels are webchat-only. External channels (Discord, Telegram) appear in the UI but don't connect.

**Fix:** Add deps, implement adapters. But this may conflict with OpenClaw's channel management. Need to decide: does EMA manage its own Discord/Telegram connections, or does it delegate to OpenClaw agents?

**Recommendation:** Don't build Discord/Telegram into EMA directly. Instead, add an OpenClaw pipe adapter: EMA events → OpenClaw agent → Discord. This avoids duplicating channel management code.

---

### AP-004: The "Claimed Shipped but Not Complete" Pattern

**Symptom:** Sprint 1 items (EMA-001 through EMA-007) are marked ✅ Merged, but several critical sub-features within them are not functional.

**Examples:**
- EMA-006 "Channels God Mode" — Discord/Telegram adapters not built
- EMA-004 "MetaMind" — prompt interception exists, but peer review quality is unverified
- EMA-001 "Claude Bridge" — bridge module built, but daemon auto-start on Tauri launch still failing (noted in Sprint Status)

**Risk:** Sprint 2 planning is based on Sprint 1 being "done." If Sprint 1 has ~30% incomplete work, Sprint 2 will compound the debt.

**Recommendation:** Add acceptance criteria to each sprint ticket that Trajan can test himself. The smoke test script in FEATURE_VALIDATIONS.md is a start.

---

## Simplification Opportunities

### S-001: VaultIndex + SecondBrain Consolidation
Two modules (`Ema.VaultIndex` and `Ema.SecondBrain`) do overlapping vault work. The CLAUDE.md notes this explicitly. One needs to absorb the other. `SecondBrain` is the richer, more complete implementation — `VaultIndex` should be retired.

### S-002: Notes ↔ SecondBrain Consolidation
`Ema.Notes` (simple notes) exists alongside `SecondBrain` vault notes. Two note systems is one too many. Retire `Ema.Notes`, route note creation to `SecondBrain` with a "simple" view that hides the wiki complexity.

### S-003: Agent Channels Simplification
Current design: each agent has multiple channel GenServers (Discord, Telegram, Webchat). For personal use, Trajan has one agent talking to him via webchat. The multi-channel architecture is overbuilt for the current use case. Consider: ship webchat fully, leave Discord/Telegram for Sprint 5 (per roadmap).

---

## Pattern Crystallization Queue

These patterns are ready for crystallization (5+ successes, clear structure):

| Pattern | Crystallization Form | Status |
|---|---|---|
| P-001 GenServer+PubSub | `use Ema.Workers.Periodic` behavior | Proposal needed |
| P-002 6-layer module | Template / generator script | Proposal needed |
| P-004 Glass Surface | `<GlassCard>` component | Proposal needed |
| P-005 Three-Action Decision | `<DecisionButtons>` component | Proposal needed |

**Next step:** Each crystallization candidate should become a proposal seed. The Proposal Engine should generate these itself after Sprint 2.
