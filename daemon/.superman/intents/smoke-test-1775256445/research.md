# Research: Smoke Test — Execution System Verification

## Summary

This execution was dispatched as a smoke test (ID: 1775256445) to verify that the Superman dispatch-and-research pipeline is operational. No signals file was present; `project.md` and `context.md` were absent. The intent body contained only the slug `smoke-test-1775256445`.

The system is functional: execution was dispatched, the researcher role was assigned, mode-gated file conventions were applied, and this output file is being written to the expected path.

---

## Durable Architecture Principles

### 1. Smoke Tests Are Adhoc-Class Executions

Based on the Router research (`research-what-is-the-minimal-viable-router-that-classifies`), smoke tests belong to the `:adhoc` mode class (phase 0). They do not follow the `research → outline → implement` DAG and should not be classified as phase-1 research. The intent slug format encodes this: `smoke-test-{timestamp}` vs `research-{description}`.

**Principle**: Intent slugs are the cheapest signal for mode inference. A properly named intent should not require content analysis to determine its class.

### 2. Missing Context Files Are Informative, Not Failures

`signals.md`, `project.md`, and `context.md` were absent. This is valid state for a smoke test — the system must handle sparse intents without crashing. The researcher role should degrade gracefully: read what exists, write what was specified, report what was missing.

**Principle**: Execution delegates must treat missing optional context as empty input, not as an error condition. Only `intent.md` and the write-file path are required.

### 3. Research Output Format Must Be Self-Consistent

The success criteria for research mode are structural, not content-dependent: principles extracted, runtime model defined, questions listed, implementation path identified. These criteria apply even when the research subject is trivial. This ensures the output is parseable by downstream outline/implement phases regardless of subject matter.

**Principle**: Mode success criteria define output shape, not output depth. A smoke-test research.md and a complex architecture research.md have the same structural contract.

### 4. Execution IDs Encode Ordering, Not Meaning

The `1775256445` suffix is a Unix-style timestamp or sequence number. It is not semantically meaningful for routing, classification, or DAG traversal. Consumers should strip numeric suffixes before using slugs as keys.

---

## Minimal Runtime Model

For a smoke-test class execution, the minimal runtime is:

```
input:   intent.md (slug only, no body)
context: none
role:    researcher (assigned by dispatcher)
output:  research.md (this file)
```

The execution path is:
1. Dispatcher reads intent slug → infers mode `"implement"` or `:adhoc` (no content to analyze)
2. Role assigned: `"researcher"` (from execution packet, not from mode inference)
3. Read files: `[intent.md]` — only file present
4. Write files: `[research.md]` — written now
5. Classification: `mode=nil/adhoc, signal=:success` (output written, non-trivial length)

No GenServer. No PubSub. No DB queries. This execution is stateless end-to-end.

---

## Unresolved Questions

### Q1: How should the dispatcher handle slug-only intents?

When `intent.md` contains only the slug and no description, `infer_mode_from_text/1` will default to `"implement"`. But the role in the execution packet may say `"researcher"`. These conflict. Which wins?

**Current lean**: Execution packet role wins — it was set by a human or orchestrator who knew the intent. `infer_mode_from_text` is a fallback for when no explicit role is given.

### Q2: Should smoke tests be excluded from intent graph indexing?

The F1 Intent Graph intent (`f1-intent-graph-core`) will extract and index intents. Smoke tests are noise in that graph — they have no semantic content, no proposal genealogy, no vault relevance.

**Current lean**: Filter by slug prefix. Any intent matching `smoke-test-*` or `ping-*` is excluded from graph indexing. This is a one-line filter in the extractor.

### Q3: Should missing `signals.md` generate a warning artifact?

Currently: silent. The researcher reads what exists, skips what doesn't. A `warnings.md` output (listing absent expected files) would make the execution log more useful for debugging dispatch failures.

**No lean yet** — depends on how noisy this becomes in practice.

---

## Smallest Viable Implementation Path

No implementation is needed for this smoke test. The system worked:

1. Intent created at `.superman/intents/smoke-test-1775256445/intent.md`
2. Execution dispatched with role `researcher`, mode `research`
3. Researcher read available files (intent.md only)
4. Researcher wrote output to `research.md` (this file)
5. Output meets structural success criteria for research mode

**If the goal was to verify the end-to-end pipeline**: it is verified. The dispatch → read → write loop completes. Patchback will write this file to the intent directory.

**If the goal was to identify gaps**: three were found (see Unresolved Questions). None are blockers.
