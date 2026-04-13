---
id: EXTRACT-Significant-Gravitas-AutoGPT
type: extraction
layer: research
category: agent-orchestration
title: "Source Extractions — Significant-Gravitas/AutoGPT"
status: active
created: 2026-04-12
updated: 2026-04-12
author: A4
clone_path: "../_clones/Significant-Gravitas-AutoGPT/"
source:
  url: https://github.com/Significant-Gravitas/AutoGPT
  sha: ef477ae
  clone_date: 2026-04-12
  depth: shallow-1
  size_mb: 34
tags: [extraction, agent-orchestration, AutoGPT, approval-gate, human-review, HITL]
connections:
  - { target: "[[research/agent-orchestration/Significant-Gravitas-AutoGPT]]", relation: source_of }
  - { target: "[[research/_clones/INDEX]]", relation: references }
  - { target: "[[ema-genesis/canon/specs/BLUEPRINT-APPROVAL-GATE]]", relation: primary_steal_for }
---

# Source Extractions — Significant-Gravitas/AutoGPT

> **PRIMARY STEAL** for EMA's Blueprint Planner approval gate. AutoGPT's `PendingHumanReview` schema is the production-grade model EMA should port verbatim into its canon §3 Approval Pattern spec.

## Clone metadata

| Field | Value |
|---|---|
| URL | https://github.com/Significant-Gravitas/AutoGPT |
| Clone depth | --depth=1 shallow |
| Clone date | 2026-04-12 |
| Clone size | 34 MB |
| Language | Python (FastAPI + Prisma) backend; Next.js frontend |
| License | MIT / polyform (platform) |
| Key commit SHA | ef477ae — "fix(backend): convert AttributeError to ValueError in _generate_schema (#12714)" |

## Install attempt

- **Attempted:** no
- **Command:** n/a
- **Result:** skipped
- **If skipped, why:** Requires Postgres + Redis + RabbitMQ + ClamAV via `docker compose up -d`, plus Supabase auth and Prisma migrations. Per brief, skip all install.

## Run attempt

- **Attempted:** no
- **Command:** n/a
- **Result:** skipped
- **If skipped, why:** see install

## Key files identified

Ordered by porting priority:

1. `autogpt_platform/backend/schema.prisma:669-693` — `PendingHumanReview` model + `ReviewStatus` enum (database ground truth)
2. `autogpt_platform/backend/backend/data/human_review.py:1-610` — full data-layer module: check_approval, create_auto_approval_record, get_or_create_human_review, process_all_reviews_for_execution, cancel_pending_reviews_for_execution
3. `autogpt_platform/backend/backend/api/features/executions/review/model.py:1-227` — Pydantic API contracts: `PendingHumanReviewModel`, `ReviewItem`, `ReviewRequest`, `ReviewResponse`, `SafeJsonData` type
4. `autogpt_platform/backend/backend/api/features/executions/review/routes.py:1-375` — FastAPI endpoints: GET `/pending`, GET `/execution/{id}`, POST `/action`
5. `autogpt_platform/backend/backend/blocks/human_in_the_loop.py:1-169` — `HumanInTheLoopBlock` — the block that creates a pending review and waits
6. `autogpt_platform/backend/backend/blocks/helpers/review.py:1-150+` — `HITLReviewHelper._handle_review_request` — shared helper used by both the dedicated HITL block and any block opting into safe-mode review

## Extracted patterns

### Pattern 1: PendingHumanReview — the database schema

This is THE steal target. Every field here has a reason. EMA's Blueprint Planner approval gate should mirror this 1:1, translated to SQLite.

**Files:**
- `autogpt_platform/backend/schema.prisma:663-693` — Prisma schema definition

**Snippet (verbatim from source):**
```prisma
// autogpt_platform/backend/schema.prisma:663-693
enum ReviewStatus {
  WAITING
  APPROVED
  REJECTED
}

// Pending human reviews for Human-in-the-loop blocks
// Also stores auto-approval records with special nodeExecId patterns (e.g., "auto_approve_{graph_exec_id}_{node_id}")
model PendingHumanReview {
  nodeExecId    String       @id
  userId        String
  graphExecId   String
  graphId       String
  graphVersion  Int
  payload       Json // The actual payload data to be reviewed
  instructions  String? // Instructions/message for the reviewer
  editable      Boolean      @default(true) // Whether the reviewer can edit the data
  status        ReviewStatus @default(WAITING)
  reviewMessage String? // Optional message from the reviewer
  wasEdited     Boolean? // Whether the data was modified during review
  processed     Boolean      @default(false) // Whether the review result has been processed by the execution engine
  createdAt     DateTime     @default(now())
  updatedAt     DateTime?    @updatedAt
  reviewedAt    DateTime?

  User User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([nodeExecId]) // One pending review per node execution
  @@index([userId, status])
  @@index([graphExecId, status])
}
```

**What to port to EMA:**

Land this in `ema-genesis/schemas/approval.yaml` and port to TypeScript types in `new-build/core/src/types/approval.ts`. Map:

| AutoGPT field | EMA field | Notes |
|---|---|---|
| `nodeExecId` (PK) | `proposalStepId` (PK) | Each paused step gets one pending review row |
| `userId` | `actorId` (FK) | EMA's actor system — human is the reviewer |
| `graphExecId` | `proposalRunId` | The overall proposal execution instance |
| `graphId` | `proposalId` | The proposal template |
| `graphVersion` | `proposalVersion` | Version integer |
| `payload` | `suggestion` (Json) | The AI-filled data awaiting approval |
| `instructions` | `instructions` (String?) | Reviewer-facing message — displayed in Blueprint UI |
| `editable` | `editable` (Boolean, default true) | Whether Accept path allows Revise |
| `status` | `status` (waiting/approved/rejected) | Same enum |
| `reviewMessage` | `reviewMessage` (String?) | Optional note from human |
| `wasEdited` | `wasEdited` (Boolean?) | True iff payload was mutated during review |
| `processed` | `processed` (Boolean) | Whether the resuming side has consumed the result (prevents double-apply) |
| `createdAt/updatedAt/reviewedAt` | same | Full audit trail |

EMA should add two indexes: `(actor_id, status)` for "my pending reviews" and `(proposal_run_id, status)` for "what's blocking run X".

**Adaptation notes:**

- AutoGPT's `nodeExecId` is a string PK because their execution engine generates synthetic ids (CoPilot synthetic pattern: `copilot-node-block-id:abc12345`). EMA doesn't need this; use UUIDv7.
- The `payload` is `Json`. In SQLite this maps to TEXT with a strict Zod parse on read/write — adopt a `SafeJson` helper (AutoGPT's `SafeJson()` wraps `json.dumps` with safety checks).
- `@@unique([nodeExecId])` is important: exactly one pending review per execution step. Enforces idempotency under retry.

### Pattern 2: Auto-approval key trick — "Allow Always" without extra table

This is non-obvious and crucial. AutoGPT reuses the same `PendingHumanReview` table to store "allow always" decisions, using a special synthetic `nodeExecId`:

**Files:**
- `autogpt_platform/backend/backend/data/human_review.py:43-45` — key generator
- `autogpt_platform/backend/backend/data/human_review.py:48-110` — check_approval reads both patterns

**Snippet (verbatim from source):**
```python
# autogpt_platform/backend/backend/data/human_review.py:43-45
def get_auto_approve_key(graph_exec_id: str, node_id: str) -> str:
    """Generate the special nodeExecId key for auto-approval records."""
    return f"auto_approve_{graph_exec_id}_{node_id}"
```

```python
# autogpt_platform/backend/backend/data/human_review.py:72-108
auto_approve_key = get_auto_approve_key(graph_exec_id, node_id)

# Check for either normal approval or auto-approval in a single query
existing_review = await PendingHumanReview.prisma().find_first(
    where={
        "OR": [
            {"nodeExecId": node_exec_id},
            {"nodeExecId": auto_approve_key},
        ],
        "status": ReviewStatus.APPROVED,
        "userId": user_id,
    },
)

if existing_review:
    is_auto_approval = existing_review.nodeExecId == auto_approve_key
    logger.info(
        f"Found {'auto-' if is_auto_approval else ''}approval for node {node_id} "
        f"(exec: {node_exec_id}) in execution {graph_exec_id}"
    )
    # For auto-approvals, use current input_data to avoid replaying stale payload
    # For normal approvals, use the stored payload (which may have been edited)
    return ReviewResult(
        data=(
            input_data
            if is_auto_approval and input_data is not None
            else existing_review.payload
        ),
        status=ReviewStatus.APPROVED,
        message=(
            "Auto-approved (user approved all future actions for this node)"
            if is_auto_approval
            else existing_review.reviewMessage or ""
        ),
        processed=True,
        node_exec_id=existing_review.nodeExecId,
    )
```

**What to port to EMA:**

EMA's "Allow Always for this intent/step" can use the identical trick. Land in `ema-genesis/canon/specs/BLUEPRINT-APPROVAL-GATE.md` §3.2:

- Generate key `auto_approve_{proposal_run_id}_{step_id}` when user picks "Accept always"
- Store as a `PendingReview` row with `status=APPROVED` and `editable=false`
- On subsequent calls to `checkApproval()`, query with `OR` matching both current `proposalStepId` and auto-approve key
- **Critical:** for auto-approvals, use *current* input data (not stored), because the stored payload is stale by the time the auto-approval is re-triggered. For normal approvals, use the stored (possibly edited) payload.

**Adaptation notes:**

- The same row serves dual purposes. This is a small elegant hack that avoids a second table.
- EMA should document this in the schema file so future maintainers don't mistake auto-approval rows for pending ones.
- KillMemory-style interaction: if the user rejects an auto-approved suggestion later, EMA should delete the auto-approval row (AutoGPT does NOT do this — it's a gap worth noting).

### Pattern 3: get_or_create_human_review — upsert-and-wait

**Files:**
- `autogpt_platform/backend/backend/data/human_review.py:164-237`

**Snippet (verbatim from source):**
```python
# autogpt_platform/backend/backend/data/human_review.py:192-237
try:
    logger.debug(f"Getting or creating review for node {node_exec_id}")

    # Upsert - get existing or create new review
    review = await PendingHumanReview.prisma().upsert(
        where={"nodeExecId": node_exec_id},
        data={
            "create": {
                "userId": user_id,
                "nodeExecId": node_exec_id,
                "graphExecId": graph_exec_id,
                "graphId": graph_id,
                "graphVersion": graph_version,
                "payload": SafeJson(input_data),
                "instructions": message,
                "editable": editable,
                "status": ReviewStatus.WAITING,
            },
            "update": {},  # Do nothing on update - keep existing review as is
        },
    )

    logger.info(
        f"Review {'created' if review.createdAt == review.updatedAt else 'retrieved'} for node {node_exec_id} with status {review.status}"
    )
except Exception as e:
    logger.error(
        f"Database error in get_or_create_human_review for node {node_exec_id}: {str(e)}"
    )
    raise

# Early return if already processed
if review.processed:
    return None

# If pending, return None to continue waiting, otherwise return the review result
if review.status == ReviewStatus.WAITING:
    return None
else:
    return ReviewResult(
        data=review.payload,
        status=review.status,
        message=review.reviewMessage or "",
        processed=review.processed,
        node_exec_id=review.nodeExecId,
    )
```

**What to port to EMA:**

This is the block that the Blueprint agent calls when it hits an approval gate. The idempotent upsert means: if the engine retries the same step, no new review row is created. The function returns `None` when the review is still pending (execution engine treats None as "keep waiting" / "re-queue later"), or a `ReviewResult` object when the human has acted.

EMA port in `new-build/core/src/approval/get-or-create.ts`:
```typescript
async function getOrCreatePendingReview(args: {
  actorId: string;
  proposalStepId: string;
  proposalRunId: string;
  proposalId: string;
  proposalVersion: number;
  suggestion: unknown;
  instructions: string;
  editable: boolean;
}): Promise<ReviewResult | null> {
  // SQLite UPSERT (INSERT ... ON CONFLICT DO NOTHING)
  // If WAITING, return null (engine should suspend the step)
  // If APPROVED/REJECTED, return ReviewResult and mark processed on next write
}
```

**Adaptation notes:**

- SQLite supports `INSERT ... ON CONFLICT(proposalStepId) DO NOTHING` which is the equivalent of Prisma's `upsert` with empty `update`.
- EMA should NOT resume execution from inside this call — it's a check-and-suspend pattern. The engine layer checks the result and either continues (approved), abandons (rejected), or persists the suspended state (waiting).

### Pattern 4: process_all_reviews_for_execution — batch decisions with race handling

**Files:**
- `autogpt_platform/backend/backend/data/human_review.py:428-544`

This is the write path when the user clicks "Approve all" or acts on multiple reviews at once. Notable features:

1. All reviews must belong to the same execution (enforced in routes.py:193-199)
2. Handles the race where a concurrent request already processed the same row
3. Explicitly rejects edit attempts on non-editable reviews (line 499-501)
4. Only writes `payload` if data actually changed (line 497-511)
5. Uses `asyncio.gather` to update all rows in parallel

**Snippet (verbatim from source):**
```python
# autogpt_platform/backend/backend/data/human_review.py:495-520
for review in reviews_to_process:
    new_status, reviewed_data, message = review_decisions[review.nodeExecId]
    has_data_changes = reviewed_data is not None and reviewed_data != review.payload

    # Check edit permissions for actual data modifications
    if has_data_changes and not review.editable:
        raise ValueError(f"Review {review.nodeExecId} is not editable")

    update_data: PendingHumanReviewUpdateInput = {
        "status": new_status,
        "reviewMessage": message,
        "wasEdited": has_data_changes,
        "reviewedAt": datetime.now(timezone.utc),
    }

    if has_data_changes:
        update_data["payload"] = SafeJson(reviewed_data)

    task = PendingHumanReview.prisma().update(
        where={"nodeExecId": review.nodeExecId},
        data=update_data,
    )
    update_tasks.append(task)

# Execute all updates in parallel and get updated reviews
updated_reviews = await asyncio.gather(*update_tasks) if update_tasks else []
```

And the race-handling logic:
```python
# autogpt_platform/backend/backend/data/human_review.py:474-490
# Validate already-processed reviews have compatible status (same decision)
# This handles race conditions where another request processed the same reviews
for review in already_processed:
    requested_status = review_decisions[review.nodeExecId][0]
    if review.status != requested_status:
        raise ValueError(
            f"Review {review.nodeExecId} was already processed with status "
            f"{review.status}, cannot change to {requested_status}"
        )

# Log if we're handling a race condition (some reviews already processed)
if already_processed:
    already_processed_ids = [r.nodeExecId for r in already_processed]
    logger.info(
        f"Race condition handled: {len(already_processed)} review(s) already "
        f"processed by concurrent request: {already_processed_ids}"
    )
```

**What to port to EMA:**

The race-handling pattern is the key lesson. EMA's approval endpoint must be **idempotent to concurrent duplicate submissions** (e.g., double-tap on mobile, or two tabs open). Treat "already processed with same decision" as success; "already processed with different decision" as 409 Conflict.

Land in `new-build/core/src/approval/process-decisions.ts`. EMA's SQLite doesn't need asyncio.gather — use a single transaction to update all rows atomically.

### Pattern 5: ReviewItem — the API contract for the Accept/Reject payload

**Files:**
- `autogpt_platform/backend/backend/api/features/executions/review/model.py:109-188`

**Snippet (verbatim from source):**
```python
# autogpt_platform/backend/backend/api/features/executions/review/model.py:109-128
class ReviewItem(BaseModel):
    """Single review item for processing."""

    node_exec_id: str = Field(description="Node execution ID to review")
    approved: bool = Field(
        description="Whether this review is approved (True) or rejected (False)"
    )
    message: str | None = Field(
        None, description="Optional review message", max_length=2000
    )
    reviewed_data: SafeJsonData | None = Field(
        None, description="Optional edited data (ignored if approved=False)"
    )
    auto_approve_future: bool = Field(
        default=False,
        description=(
            "If true and this review is approved, future executions of this same "
            "block (node) will be automatically approved. This only affects approved reviews."
        ),
    )
```

And the validator that prevents payload-size attacks:
```python
# autogpt_platform/backend/backend/api/features/executions/review/model.py:154-178
# Validate data size to prevent DoS attacks
try:
    json_str = json.dumps(v)
    if len(json_str) > 1000000:  # 1MB limit
        raise ValueError("reviewed_data is too large (max 1MB)")
except (TypeError, ValueError) as e:
    raise ValueError(f"reviewed_data must be JSON serializable: {str(e)}")

# Ensure no dangerous nested structures (prevent infinite recursion)
def check_depth(obj, max_depth=10, current_depth=0):
    """Recursively check object nesting depth to prevent stack overflow attacks."""
    if current_depth > max_depth:
        raise ValueError("reviewed_data has excessive nesting depth")
```

**What to port to EMA:**

Port this Pydantic shape as a Zod schema in `new-build/core/src/approval/schemas.ts`:
```typescript
export const ReviewItemSchema = z.object({
  proposalStepId: z.string().uuid(),
  approved: z.boolean(),
  message: z.string().max(2000).nullish(),
  reviewedData: SafeJsonSchema.nullish(),
  autoApproveFuture: z.boolean().default(false),
});
```

Keep the 1MB payload limit and nesting-depth check — both are cheap and prevent a known class of attacks.

**Adaptation notes:**

- The `auto_approve_future` flag ties directly to Pattern 2. When this is true AND `approved=true`, AutoGPT creates a second row with the auto-approve key.
- `reviewed_data` is ignored on rejection — EMA should also reject this combination with a 400, not silently drop.

### Pattern 6: HumanInTheLoopBlock — the block that pauses execution

**Files:**
- `autogpt_platform/backend/backend/blocks/human_in_the_loop.py:22-168`

This is the block authors use when they want to insert an approval gate into a flow. Input schema has `data` (anything), `name` (description for reviewer), `editable` (bool). Two outputs: `approved_data` and `rejected_data` — the actual input data flows through whichever path the human picks.

**Snippet (verbatim from source):**
```python
# autogpt_platform/backend/backend/blocks/human_in_the_loop.py:120-165
async def handle_review_decision(self, **kwargs):
    return await HITLReviewHelper.handle_review_decision(**kwargs)

async def run(
    self,
    input_data: Input,
    *,
    user_id: str,
    node_id: str,
    node_exec_id: str,
    graph_exec_id: str,
    graph_id: str,
    graph_version: int,
    execution_context: ExecutionContext,
    **_kwargs,
) -> BlockOutput:
    if not execution_context.human_in_the_loop_safe_mode:
        logger.info(
            f"HITL block skipping review for node {node_exec_id} - safe mode disabled"
        )
        yield "approved_data", input_data.data
        yield "review_message", "Auto-approved (safe mode disabled)"
        return

    decision = await self.handle_review_decision(
        input_data=input_data.data,
        user_id=user_id,
        node_id=node_id,
        node_exec_id=node_exec_id,
        graph_exec_id=graph_exec_id,
        graph_id=graph_id,
        graph_version=graph_version,
        block_name=input_data.name,  # Use user-provided name instead of block type
        editable=input_data.editable,
    )

    if decision is None:
        return

    status = decision.review_result.status
    if status == ReviewStatus.APPROVED:
        yield "approved_data", decision.review_result.data
    elif status == ReviewStatus.REJECTED:
        yield "rejected_data", decision.review_result.data
    else:
        raise RuntimeError(f"Unexpected review status: {status}")

    if decision.message:
        yield "review_message", decision.message
```

**What to port to EMA:**

EMA's equivalent is the `BlueprintStep` entity (canon TBD). When a blueprint step has `requiresApproval: true`, the execution engine calls `getOrCreatePendingReview()` and either:
- Returns `approved_data` path with the (possibly edited) suggestion as the next-step input
- Returns `rejected_data` path (EMA probably just aborts the blueprint here — it has no parallel reject-flow concept yet)
- Suspends the execution if review is still pending

Note the "safe mode off" escape hatch: AutoGPT lets users disable HITL globally. EMA's equivalent is a boolean on the actor config — `humanApprovalSafeMode`. Genesis spec should decide whether this is per-actor, per-proposal, or both.

### Pattern 7: Resume execution after all reviews cleared

**Files:**
- `autogpt_platform/backend/backend/api/features/executions/review/routes.py:326-360`

**Snippet (verbatim from source):**
```python
# autogpt_platform/backend/backend/api/features/executions/review/routes.py:326-360
# Resume graph execution only for real graph executions (not CoPilot)
# CoPilot sessions are resumed by the LLM retrying run_block with review_id
if not is_copilot and updated_reviews:
    still_has_pending = await has_pending_reviews_for_graph_exec(graph_exec_id)

    if not still_has_pending:
        first_review = next(iter(updated_reviews.values()))

        try:
            user = await get_user_by_id(user_id)
            settings = await get_graph_settings(
                user_id=user_id, graph_id=first_review.graph_id
            )

            user_timezone = (
                user.timezone if user.timezone != USER_TIMEZONE_NOT_SET else "UTC"
            )

            workspace = await get_or_create_workspace(user_id)

            execution_context = ExecutionContext(
                human_in_the_loop_safe_mode=settings.human_in_the_loop_safe_mode,
                sensitive_action_safe_mode=settings.sensitive_action_safe_mode,
                user_timezone=user_timezone,
                workspace_id=workspace.id,
            )

            await add_graph_execution(
                graph_id=first_review.graph_id,
                user_id=user_id,
                graph_exec_id=graph_exec_id,
                execution_context=execution_context,
            )
            logger.info(f"Resumed execution {graph_exec_id}")
        except Exception as e:
            logger.error(f"Failed to resume execution {graph_exec_id}: {str(e)}")
```

**What to port to EMA:**

The resume logic is **only called when there are no more pending reviews for that run**. This is important: a proposal can have multiple approval gates, and the run only unblocks when all of them are resolved (approve OR reject).

EMA port: after `processDecisions()` completes, check `hasAnyPendingReviews(proposalRunId)`. If not, enqueue a `proposal:resume` event on the runtime pubsub. Land in `new-build/core/src/approval/resume.ts`.

**Adaptation notes:**

- AutoGPT's try/except swallows resume errors and just logs. EMA should at minimum write the failure to the proposal run record so the user sees the stuck state instead of a silent failure.

## Gotchas found while reading

- **`processed` vs `status`** — Two separate fields. `status` is the human's decision; `processed` is whether the execution engine has consumed that decision. Without both, you get race-condition double-applies. EMA must keep both.
- **`wasEdited` is nullable** — True means edited, False means explicitly not edited, NULL means "not yet reviewed". Easy to miss and use as a plain Boolean.
- **`updatedAt` is nullable** — Prisma's `@updatedAt` doesn't set on first create. Check for `createdAt == updatedAt` to detect "freshly created" in `get_or_create_human_review` (line 215).
- **Race condition handling is opinionated** — AutoGPT treats "already processed with same decision" as success (idempotent), but "already processed with different decision" as 409. This is a policy choice EMA needs to confirm.
- **Data size + nesting depth checks at Pydantic boundary** — Both are cheap defense against DoS. Not every codebase does this; it's worth the 20 lines.
- **Auto-approval records have `processed=True` at creation** — Because they're not awaiting any action. Gotcha: don't confuse these with "already-handled reviews" when querying pending lists.
- **`delete_review_by_node_exec_id` is CoPilot-only** — Used to clean up one-time-use review records after successful CoPilot run. EMA probably doesn't need this function.
- **Cascade delete via User FK** — If a user is deleted, all their reviews go with them. For EMA's single-user local-first stance, this is less relevant but still a good safety net.

## Port recommendation

Concrete next steps for EMA's port:

1. **Create schema file** at `ema-genesis/schemas/approval.yaml` with the full PendingHumanReview shape translated to YAML. Mirror field names and types 1:1 but use EMA's entity names (proposalStepId, actorId, proposalRunId).
2. **Write canon spec** at `ema-genesis/canon/specs/BLUEPRINT-APPROVAL-GATE.md` describing: the lifecycle (WAITING → APPROVED/REJECTED), the auto-approve-key hack from Pattern 2, the resume semantics from Pattern 7, the race-handling policy from Pattern 4.
3. **Port the data layer** to `new-build/core/src/approval/` as 5 files matching AutoGPT's shape: `schema.ts` (Zod), `check-approval.ts`, `get-or-create.ts`, `process-decisions.ts`, `resume.ts`. Aim for ~200 lines total; AutoGPT's is 610 but we skip CoPilot synthetic-id handling and multi-user auth.
4. **REST endpoints** in `new-build/core/src/api/approval-routes.ts`: `GET /api/approvals/pending`, `GET /api/approvals/run/:runId`, `POST /api/approvals/action`. Match AutoGPT's route names/shapes.
5. **Testing approach** — TDD from `review_routes_test.py` as a reference (they use FastAPI TestClient + snapshot testing). EMA should test: fresh upsert, idempotent second create, approve updates all rows, auto-approve-key works on second call, edit on non-editable raises 403, race-condition already-processed returns success, different-decision returns 409, resume fires only when zero pending.
6. **Risks** — The biggest one is the `processed` flag subtlety. Write a test that tries to apply an approval twice and asserts the second apply is a no-op.

## Related extractions

- `[[research/_extractions/langchain-ai-langgraph]]` — LangGraph's `interrupt()` is a different architectural approach to the same problem (checkpointer-based suspension vs database row)
- `[[research/_extractions/gotohuman-gotohuman-mcp-server]]` — field-level form schema is the UX layer; AutoGPT's is the persistence layer

## Connections

- `[[research/agent-orchestration/Significant-Gravitas-AutoGPT]]` — original research node
- `[[research/_clones/INDEX]]`
- `[[ema-genesis/canon/specs/BLUEPRINT-APPROVAL-GATE]]` — EMA canon target for this port

#extraction #agent-orchestration #AutoGPT #approval-gate #human-review #HITL #primary-steal
