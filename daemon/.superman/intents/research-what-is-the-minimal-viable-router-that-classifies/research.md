# Research: Minimal Viable Router for Execution Event Classification

## Summary

The minimal viable Router is a **pure function module** that classifies execution events by mode and outcome. It has no side effects, no database access, no PubSub, no filesystem writes. It takes an event or execution struct and returns a classification struct. Consumers decide what to do with that classification — the Router never does.

---

## Durable Architecture Principles

### 1. Classification ≠ Orchestration

A Router that classifies must not trigger any side effects. It cannot:
- Broadcast PubSub messages
- Transition execution status
- Write result files
- Query the database

It takes input, returns a classification. That's it. The moment it calls `Repo`, `PubSub`, or `File`, it has become an orchestrator wearing a Router costume.

**Current violation**: `infer_signal/1` and `infer_mode_from_proposal/1` are private functions buried inside `Executions`, which does orchestrate. `Dispatcher` duplicates mode logic in `mode_to_role/1`, `mode_success_criteria/1`, `mode_read_files/1`, `mode_write_files/1`. This is classification scattered across orchestration layers.

### 2. Events Are the Unit of Input

The Router classifies events — records of what happened — not live execution structs. A live struct tempts the Router to query related data, which leads to side effects. An event has everything the Router needs: `mode`, `result_summary`, `status`, `type`.

This also means the Router can be called on historical events for analysis, not just live ones.

### 3. Mode Is a Lifecycle Position, Not a Task Type

Modes form a directed graph of phases. Research unlocks outline; outline unlocks implement; implement unlocks review/refactor. The Router knows where each mode sits in that graph. This is classification data, not routing logic — consumers decide whether to advance to the next phase.

```
research (phase 1) → outline (phase 2) → implement (phase 3) → review/refactor (phase 4) → harvest (phase 5)
```

### 4. Outcome Is a Signal, Not a Status

`status` is a database field owned by the Execution schema: `"completed"`, `"failed"`, `"running"`. Outcome signal is derived from result content: `:success`, `:partial`, `:failed`, `:unknown`. These are different things. The Router classifies signals. The Executions context owns statuses. They should never be confused.

Current `infer_signal/1` conflates them by using byte_size as a proxy for quality — it's a heuristic, not a classification rule. A real signal requires pattern matching on content.

### 5. Classification Output Is a Struct, Not a Decision

The Router returns structured data. It does NOT return "dispatch research next" or "retry this". That's orchestration. It returns: what mode class is this, what outcome signal, what phase does this represent, what modes are logically unblocked by completion. Consumers use this data to make decisions.

---

## Minimal Runtime Model

### Types

```elixir
@type mode :: String.t()
  # "research" | "outline" | "implement" | "review" | "refactor" | "harvest"

@type mode_class :: :exploration | :specification | :execution | :validation | :maintenance

@type outcome_signal :: :success | :partial | :failed | :unknown

@type classification :: %{
  mode: mode(),
  mode_class: mode_class(),
  phase: 1..5,
  outcome_signal: outcome_signal(),
  agent_role: String.t(),
  eligible_next_modes: [mode()]
}
```

### Mode → Class Mapping

| Mode       | Class          | Phase | Unblocks              |
|------------|----------------|-------|-----------------------|
| research   | :exploration   | 1     | outline               |
| outline    | :specification | 2     | implement             |
| implement  | :execution     | 3     | review, refactor      |
| review     | :validation    | 4     | refactor, harvest     |
| refactor   | :maintenance   | 4     | review, harvest       |
| harvest    | :maintenance   | 5     | (terminal)            |

`eligible_next_modes` is only populated on `:success` signal. On `:partial` or `:failed`, the same mode is eligible for retry — the Router reports that, but does not trigger it.

### Outcome Signal Classification Rules (in priority order)

1. `nil` or `""` → `:unknown`
2. Starts with `"FAILED:"` or contains `"** (exit"` (Elixir exception trace) → `:failed`
3. Contains `"ERROR:"` as a standalone line → `:failed`
4. `byte_size < 100` → `:partial` (too short to be a real output)
5. Result is structured (contains `#` headers or multiple paragraphs) → `:success`
6. `byte_size >= 300` → `:success` (length as last-resort proxy)
7. Otherwise → `:partial`

### Core API Surface

```elixir
defmodule Ema.Executions.Router do
  # Primary entry point
  @spec classify(mode(), result_summary :: String.t() | nil) :: classification()
  def classify(mode, result_summary)

  # Individual classifiers (public for testing and composition)
  @spec classify_mode(mode()) :: {mode_class(), phase :: 1..5}
  def classify_mode(mode)

  @spec classify_outcome(String.t() | nil) :: outcome_signal()
  def classify_outcome(result_summary)

  @spec mode_to_role(mode()) :: String.t()
  def mode_to_role(mode)

  @spec mode_success_criteria(mode()) :: [String.t()]
  def mode_success_criteria(mode)

  @spec mode_read_files(mode(), intent_path :: String.t()) :: [String.t()]
  def mode_read_files(mode, intent_path)

  @spec mode_write_files(mode(), intent_path :: String.t()) :: [String.t()]
  def mode_write_files(mode, intent_path)

  @spec infer_mode_from_text(String.t()) :: mode()
  def infer_mode_from_text(text)
end
```

No `use`, no `GenServer`, no `Repo`. A plain module of pure functions.

---

## Unresolved Questions

### Q1: Does `eligible_next_modes` belong in the Router?

If the Router says "these modes are unblocked", it's providing scheduling information. That's one step toward orchestration. The safer position: Router classifies current mode/outcome only. A separate `PhaseGraph` module (also pure) handles DAG traversal and next-mode suggestions. But this may be premature for the current scale.

**Current lean**: Keep it in Router for now, clearly named as "logically eligible, not scheduled". Revisit if a scheduler starts calling `classify` to decide what to enqueue.

### Q2: How should the Router relate to `compute_intent_status`?

`compute_intent_status/2` aggregates across all executions for an intent. It currently re-implements mode ordering inline. It should call `Router.classify_mode/1` for phase numbers instead of hardcoding. But `compute_intent_status` is aggregate logic — it's not classification of a single event. These are related but distinct.

**Current lean**: Router is per-event, `compute_intent_status` is aggregate. Router's `classify_mode/1` feeds into the aggregate logic but doesn't replace it.

### Q3: Content-based vs artifact-based outcome classification

Content-based (scan result text) is pure but fragile — Claude output varies. Artifact-based (check if `write_files` were actually written to disk) is reliable but requires filesystem access, making the classifier impure.

**Current lean**: Router does content-based classification only. A separate `ArtifactChecker` (called by `Executions.on_execution_completed`, not by Router) validates file presence and can override the signal before it's persisted. This keeps Router pure and ArtifactChecker as a named seam.

### Q4: What mode do executions have that don't fit the DAG?

Some intents are ad-hoc: "list three improvements", "smoke test", "clean cycle". These arrive with mode `nil` or `"implement"` by default, but they don't follow the research→outline→implement pipeline. The Router's phase model doesn't apply cleanly.

**Current lean**: Add an `:adhoc` mode class with phase 0. Executions with no mode or ambiguous mode classify as `:adhoc`, which has no `eligible_next_modes`. Phase graph doesn't apply to them.

---

## Smallest Viable Implementation Path

### Step 0: Extract (no behavior change)

Move existing scattered classification logic into `lib/ema/executions/router.ex`:

- From `Dispatcher`: `mode_to_role/1`, `mode_success_criteria/1`, `mode_read_files/2`, `mode_write_files/2`
- From `Executions`: `infer_signal/1` (rename to `classify_outcome/1`), `infer_mode_from_proposal/1` (rename to `infer_mode_from_text/1`)

Update call sites: `Dispatcher` calls `Router.mode_to_role(mode)`, etc. Tests pass unchanged. Zero behavior change.

**Deliverable**: `router.ex` with all existing logic centralized. ~80 lines.

### Step 1: Add taxonomy (additive)

Add `classify_mode/1` returning `{mode_class, phase}` and `classify/2` as the unified entry point returning a `%{}` struct. Add `eligible_next_modes/2` (mode + signal).

Strengthen `classify_outcome/1` with pattern matching for `"FAILED:"`, exception traces, and structured-content detection.

**Deliverable**: Full `classify/2` API. ~120 lines total.

### Step 2: Wire into Executions aggregate

Update `compute_intent_status/2` to call `Router.classify_mode/1` for phase numbers instead of hardcoded mode strings. This validates the Router's data matches what the aggregate expects.

**Deliverable**: Single call site change in `Executions`, no behavior change.

### Step 3: Enrich outcome with ArtifactChecker (optional, separate concern)

Add `Ema.Executions.ArtifactChecker.verify(execution, write_files)` that checks if expected output files exist and have non-trivial content. Called from `on_execution_completed`, overrides Router signal before persistence if artifacts are missing.

This is a separate module, not part of Router. Router remains pure.

**Deliverable**: `artifact_checker.ex`, ~40 lines. ArtifactChecker depends on filesystem; Router never does.

---

## Implementation Sketch

```elixir
defmodule Ema.Executions.Router do
  @moduledoc """
  Pure classification of execution events by mode and outcome.
  No side effects. No database. No PubSub. No filesystem.

  Callers (Dispatcher, Executions) use these classifications to make
  decisions. The Router classifies — it does not decide.
  """

  @mode_phases %{
    "research"  => {:exploration,   1},
    "outline"   => {:specification, 2},
    "implement" => {:execution,     3},
    "review"    => {:validation,    4},
    "refactor"  => {:maintenance,   4},
    "harvest"   => {:maintenance,   5}
  }

  @next_modes %{
    "research"  => ["outline"],
    "outline"   => ["implement"],
    "implement" => ["review", "refactor"],
    "review"    => ["refactor", "harvest"],
    "refactor"  => ["review", "harvest"],
    "harvest"   => []
  }

  def classify(mode, result_summary) do
    {mode_class, phase} = classify_mode(mode)
    signal = classify_outcome(result_summary)

    %{
      mode: mode,
      mode_class: mode_class,
      phase: phase,
      outcome_signal: signal,
      agent_role: mode_to_role(mode),
      eligible_next_modes: if(signal == :success, do: Map.get(@next_modes, mode, []), else: [mode])
    }
  end

  def classify_mode(mode) do
    Map.get(@mode_phases, mode, {:adhoc, 0})
  end

  def classify_outcome(nil), do: :unknown
  def classify_outcome(""), do: :unknown
  def classify_outcome(s) do
    cond do
      String.starts_with?(s, "FAILED:")                -> :failed
      String.contains?(s, "** (exit")                  -> :failed
      Regex.match?(~r/^ERROR:/m, s)                    -> :failed
      byte_size(s) < 100                               -> :partial
      Regex.match?(~r/^#+ /m, s) and byte_size(s) > 200 -> :success
      byte_size(s) >= 300                              -> :success
      true                                             -> :partial
    end
  end

  def mode_to_role("research"),  do: "researcher"
  def mode_to_role("outline"),   do: "outliner"
  def mode_to_role("review"),    do: "reviewer"
  def mode_to_role("refactor"),  do: "refactorer"
  def mode_to_role("harvest"),   do: "harvester"
  def mode_to_role(_),           do: "implementer"

  def mode_success_criteria("research") do
    ["Durable architecture principles extracted", "Minimal runtime model defined",
     "Unresolved questions listed", "Smallest viable implementation path identified"]
  end
  def mode_success_criteria("outline") do
    ["Filesystem structure defined", "Runtime schema specified", "Event flow documented",
     "App boundaries clear", "Build order established"]
  end
  def mode_success_criteria(_), do: ["Objective completed", "Output written to specified files"]

  def mode_read_files("outline", intent_path), do: ["#{intent_path}/research.md"]
  def mode_read_files(_, _), do: []

  def mode_write_files("research", intent_path), do: ["#{intent_path}/research.md"]
  def mode_write_files("outline", intent_path),  do: ["#{intent_path}/outline.md", "#{intent_path}/decisions.md"]
  def mode_write_files(_, intent_path),           do: ["#{intent_path}/result.md"]

  def infer_mode_from_text(text) do
    t = String.downcase(text)
    cond do
      String.contains?(t, ["research", "investigate", "explore", "study"])  -> "research"
      String.contains?(t, ["refactor", "clean up", "simplify", "improve"])  -> "refactor"
      String.contains?(t, ["review", "audit", "check", "assess"])           -> "review"
      String.contains?(t, ["outline", "plan", "design", "architect"])       -> "outline"
      true                                                                    -> "implement"
    end
  end
end
```

Total: ~80 lines for Step 0+1 combined. No new dependencies. All existing tests continue to pass.
