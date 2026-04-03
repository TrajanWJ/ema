
---

## 2026-04-03T21:11:50.810231Z — oKBgIdGjONU

**Mode:** research

Research written to `.superman/intents/research-what-is-the-minimal-viable-router-that-classifies/research.md`.

**Key findings:**

**The core answer**: The minimal viable Router is a plain Elixir module (~80 lines) of pure functions with no side effects, no database, no PubSub, no filesystem. It takes `(mode, result_summary)` and returns a classification struct.

**What it classifies**:
- **Mode class**: maps `research/outline/implement/review/refactor/harvest` to `{mode_class, phase}` — a position in a lifecycle DAG
- **Outcome signal**: `:success | :partial | :failed | :unknown` derived from result content (not from status field)
- **Eligible next modes**: which modes are logically unblocked — but only reported, never triggered

**The critical insight**: Classification logic is currently scattered — `Dispatcher` has mode→role/files/criteria, `Executions` has `infer_signal/1` and `infer_mode_from_proposal/1`. These are all pure functions masquerading as private helpers inside orchestrators. Step 0 is just extraction: move them into a `Router` module, update call sites, zero behavior change.

**The four unresolved questions** (in the doc): whether `eligible_next_modes` risks becoming orchestration, how Router relates to `compute_intent_status`, content-based vs artifact-based outcome classification, and what to do with ad-hoc modes that don't fit the DAG.
