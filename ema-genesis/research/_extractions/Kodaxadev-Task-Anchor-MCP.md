---
id: EXTRACT-Kodaxadev-Task-Anchor-MCP
type: extraction
layer: research
category: life-os-adhd
title: "Source Extractions — Kodaxadev/Task-Anchor-MCP"
status: active
created: 2026-04-12
updated: 2026-04-12
author: A9
clone_path: "../_clones/Kodaxadev-Task-Anchor-MCP/"
source:
  url: https://github.com/Kodaxadev/Task-Anchor-MCP
  sha: 7c0c8f7
  clone_date: 2026-04-12
  depth: shallow-1
  size_mb: 0.9
tags: [extraction, life-os-adhd, task-anchor, drift-detection, mcp, adhd]
connections:
  - { target: "[[research/life-os-adhd/Kodaxadev-Task-Anchor-MCP]]", relation: source_of }
  - { target: "[[research/_clones/INDEX]]", relation: references }
---

# Source Extractions — Kodaxadev/Task-Anchor-MCP

> Companion extraction doc for `[[research/life-os-adhd/Kodaxadev-Task-Anchor-MCP]]`. **PRIORITY extraction — the surgically-right 1-star repo.** The drift detection mechanism in `drift.py` is the highest-value steal in the entire Tier 3 batch. Everything below is verbatim from the cloned source.

## Clone metadata

| Field | Value |
|---|---|
| URL | https://github.com/Kodaxadev/Task-Anchor-MCP |
| Clone depth | --depth=1 shallow |
| Clone date | 2026-04-12 |
| Clone size | ~0.9 MB |
| Language | Python 3 (MCP server via `mcp` SDK) |
| License | See LICENSE (permissive) |
| Key commit SHA | 7c0c8f7 |

## Install attempt

- **Attempted:** no
- **Result:** skipped
- **Why skipped:** per instructions — read source only. The package is installable via `pip install -e .` from `mcp-server/`, but the code is small and self-contained enough to read end-to-end without running.

**Note:** The repo has unmerged Git conflict markers in `handlers.py`, `models.py`, `server.py`, `storage.py`, `streak.py`, `config.py`, and `tools.py` (HEAD vs `3dfce2ba419c32d...`). The HEAD branch adds `tone.py`, `flow.py`, tone messages, and flow mode. The base branch is the simpler original. Both are reproduced here — we steal from both. When porting, pick one side or merge cleanly; I document both below.

## Run attempt

- **Attempted:** no
- **Result:** skipped — read source only

## Key files identified

Ordered by porting priority (this is small enough to extract virtually end-to-end):

1. `mcp-server/task_anchor/drift.py` (186 lines) — **the mechanism**: whole-phrase regex scoring, gap penalty, completion validator
2. `mcp-server/task_anchor/models.py` (117 lines) — `DRIFT_SIGNALS` weight table (14 phrases) + `TaskLock` dataclass + `validate_scope`
3. `mcp-server/task_anchor/tools.py` (241 lines) — MCP tool schemas (10 in base, 14 on HEAD)
4. `mcp-server/task_anchor/handlers.py` (595 lines) — handler coroutines, scope check, completion rejection, session checkpoint
5. `mcp-server/task_anchor/storage.py` (166 lines) — atomic write + fcntl/msvcrt lock primitives, state-file bootstrap
6. `mcp-server/task_anchor/config.py` (63 lines) — path resolution (env var override + walk-up-to-repo-root)
7. `mcp-server/task_anchor/server.py` (120 lines) — MCP wiring, route table, stdio entry point
8. `mcp-server/task_anchor/streak.py` (109 lines) — daily streak counter + completion celebration (figlet/ASCII)
9. `mcp-server/task_anchor/helpers.py` (102 lines) — git-branch, parked timestamp parser, session log writer
10. `.claude/CLAUDE.md` — the enforcement protocol prompt shipped alongside the server

## Extracted patterns

### Pattern 1: Whole-phrase drift detection with weighted signals

**Files:**
- `mcp-server/task_anchor/models.py:42-69` — 14-phrase weighted signal dictionary
- `mcp-server/task_anchor/drift.py:30-39` — pre-compiled `\b`-bounded regex patterns
- `mcp-server/task_anchor/drift.py:46-75` — `score_input()` core scoring function

**Snippet (verbatim from `models.py:42-69`):**
```python
# Signals are matched as WHOLE PHRASES (not substrings) in drift.py.
# "rewrite" won't fire inside "overwrite"; "instead" won't fire inside "instantiate".
# Weights reflect how strongly each phrase predicts a context switch vs. being
# normal in-task language. Tune here without touching detection logic.
DRIFT_SIGNALS: dict[str, int] = {
    # Strong scope-switch indicators
    "while we're at it":  5,
    "might as well":      5,
    "new library":        5,
    "different approach": 5,
    # Moderate — directional pivots
    "instead of":         4,
    "what if we":         4,
    "can you also":       4,
    "let's switch":       4,
    "scrap that":         4,
    # Softer signals — need other signals to compound
    "actually":           2,
    "quick question":     2,
    "simpler approach":   3,
    "easier if we":       3,
    "rewrite the":        3,   # "rewrite the X" — directional, not substring noise
}

# Gap penalty is only added when input is clearly off-topic AND substantive.
# Raised from 20 → 40 chars to avoid penalising short focused questions.
DRIFT_GAP_MIN_LENGTH = 40   # chars — below this, gap penalty is skipped entirely
DRIFT_GAP_PENALTY    = 3    # score added when context overlap is low
DRIFT_GAP_MAX_OVERLAP = 2   # overlap below this triggers the penalty

DRIFT_THRESHOLD = 4   # score >= this triggers park+redirect
DRIFT_SCORE_CAP = 10  # display cap so UI label isn't misleading
```

**Count check:** 14 phrases, not 26 as the task brief implied. The brief's "26 weighted phrases" appears to be outdated / from a different version. The true count is 14 in the cloned `models.py`. (An older version may have had more; I read 14.)

**Snippet (verbatim from `drift.py:30-75`):**
```python
def _build_pattern(phrase: str) -> re.Pattern:
    escaped = re.escape(phrase)
    return re.compile(rf"\b{escaped}\b", re.IGNORECASE)


# Compiled once at import time — avoids re-compiling on every message.
_COMPILED_SIGNALS: list[tuple[re.Pattern, int]] = [
    (_build_pattern(phrase), weight)
    for phrase, weight in DRIFT_SIGNALS.items()
]


# ---------------------------------------------------------------------------
# Scoring engine
# ---------------------------------------------------------------------------

def score_input(user_input: str, current_context: str) -> Tuple[int, int]:
    """
    Returns (raw_score, keyword_overlap).

    raw_score       — sum of matched signal weights + optional gap penalty
    keyword_overlap — shared meaningful words between input and context
    """
    # Signal matching — whole-phrase, word-boundary aware
    signal_score = sum(
        weight
        for pattern, weight in _COMPILED_SIGNALS
        if pattern.search(user_input)
    )

    # Context gap penalty — only applied to substantive messages where the
    # input shares almost no vocabulary with the active task context.
    # Short messages (questions, confirmations) are exempt.
    context_words = _meaningful_words(current_context)
    input_words   = _meaningful_words(user_input)
    overlap       = len(context_words & input_words)

    gap_penalty = 0
    if (
        len(user_input) >= DRIFT_GAP_MIN_LENGTH
        and overlap < DRIFT_GAP_MAX_OVERLAP
    ):
        gap_penalty = DRIFT_GAP_PENALTY

    return signal_score + gap_penalty, overlap
```

**Snippet (verbatim from `drift.py:77-98`):**
```python
def _meaningful_words(text: str) -> set[str]:
    """
    Returns lowercase words longer than 3 chars, stripping noise words that
    appear in almost every message and pollute the overlap calculation.
    """
    _STOP = {
        "this", "that", "with", "from", "have", "will", "just", "been",
        "also", "when", "what", "they", "your", "here", "there", "then",
        "than", "into", "some", "like", "more", "make", "want",
    }
    words = re.findall(r"[a-z]{4,}", text.lower())
    return {w for w in words if w not in _STOP}


def is_drift(score: int) -> bool:
    return score >= DRIFT_THRESHOLD


def capped_score(score: int) -> int:
    """Display-safe score — prevents misleading label in UI output."""
    return min(score, DRIFT_SCORE_CAP)
```

**What to port to EMA:**
This maps to a new EMA module `Ema.Focus.DriftDetector` (or `Ema.Intents.DriftGuard`) that sits on the path of every user message in the agent system (`AgentWorker.handle_message/2`). It takes the raw user input + the active task-lock's `exit_condition` as context, returns `{:drift, score} | :clear`. On drift, the agent emits a `proposal` of type `park` instead of editing code. EMA's intent pipeline gives us a natural place for this — every intent declaration is also a lockable task.

**Adaptation notes:**
- Elixir port: use `:re.compile/2` with `[:caseless]` for the patterns; compile in a GenServer on boot, store in `:persistent_term`. The phrases + weights become a module attribute.
- The stop-word set can live in `Ema.Intents.DriftGuard.stopwords/0`.
- `_meaningful_words` trivially becomes `Regex.scan(~r/[a-z]{4,}/, text)` + `MapSet.new/1 |> MapSet.difference(stopwords)`.
- Keep the `DRIFT_THRESHOLD = 4` and `DRIFT_GAP_PENALTY = 3` — these are ADHD-validated. Do NOT re-tune blindly.

### Pattern 2: TaskLock dataclass + scope validation

**Files:**
- `mcp-server/task_anchor/models.py:79-117` — `TaskLock` dataclass
- `mcp-server/task_anchor/handlers.py:295-315` — `scope_validate_edit` handler (base branch)

**Snippet (verbatim from `models.py:79-117`):**
```python
@dataclass
class TaskLock:
    building:        str
    done_criteria:   str
    scope_files:     List[str]
    exit_condition:  str
    locked_at:       str
    status:          str = "active"          # active | suspended | completed
    git_branch:      Optional[str] = None
    emotional_state: Optional[str] = None
    rewards:         dict = field(default_factory=lambda: {
        "visual":     "minimal",
        "sound":      False,
        "git_emoji":  "⚓",
    })

    # ------------------------------------------------------------------
    # Scope validation — checks whether a given path is within any of
    # the declared scope_files entries (prefix match, case-insensitive).
    # ------------------------------------------------------------------

    def validate_scope(self, file_path: str) -> bool:
        abs_file = os.path.abspath(file_path).lower()
        for scope in self.scope_files:
            abs_scope = os.path.abspath(scope).lower()
            if abs_file.startswith(abs_scope):
                return True
        return False

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "TaskLock":
        # Strip unknown keys so future schema additions don't break old locks.
        known = {f.name for f in cls.__dataclass_fields__.values()}  # type: ignore[attr-defined]
        filtered = {k: v for k, v in data.items() if k in known}
        return cls(**filtered)
```

**Snippet (verbatim from `handlers.py` base branch, ~295-315):**
```python
async def handle_scope_validate_edit(args: Dict[str, Any]) -> List[TextContent]:
    lock = load_lock()
    if lock is None:
        return _text("⚓ VIOLATION: No active task lock. Cannot validate scope.")

    file_path = args["file_path"]
    if lock.validate_scope(file_path):
        return _text(f"✓ Scope validated: {file_path} is within locked bounds.")

    return _text(
        f"⚓ SCOPE VIOLATION\n\n"
        f"ATTEMPTED: {file_path}\n"
        f"LOCKED SCOPE: {lock.scope_files}\n\n"
        f"This file is outside your current task scope.\n\n"
        f"ACTIONS:\n"
        f"1. Park this edit idea (parked_add)\n"
        f"2. Expand scope (task_lock_create with updated scope)\n"
        f"3. Mark current task done first (task_complete)\n\n"
        f"Current task: {lock.building}"
    )
```

**What to port to EMA:**
EMA's `Ema.Intents.Intent` schema already has `scope_files` and `exit_condition` candidates. Extend `Ema.Intents.Intent` with these exact fields:

- `building :: String.t()` — the one-sentence task statement
- `done_criteria :: String.t()` — observable completion criteria
- `scope_files :: [String.t()]` — allowed path prefixes
- `exit_condition :: String.t()` — the micro-step that unlocks next
- `status :: :active | :suspended | :completed`
- `emotional_state :: :flow | :stuck | :frustrated | :tired | :satisfied | nil`

Add an `Ema.Intents.Intent.validate_scope/2` function as a direct port — prefix match on absolute paths, case-insensitive. Call it from every tool invocation that writes files (`Ema.Agents.AgentWorker.call_tool/2`). Refuse the call on mismatch.

**Adaptation notes:**
- Elixir: `Path.absname/1` + `String.downcase/1` + `String.starts_with?/2`.
- The `rewards` dict becomes a `%{visual: :minimal, sound: false, git_emoji: "⚓"}` map.
- `from_dict` filtering of unknown keys maps to `Map.take/2` with a known-field list.

### Pattern 3: Semantic-aware completion validation (stemmed overlap)

**Files:**
- `mcp-server/task_anchor/drift.py:143-169` — `_stem` + `score_completion`
- `mcp-server/task_anchor/handlers.py:318-393` — `task_complete` handler rejection path

**Snippet (verbatim from `drift.py:143-169`):**
```python
def _stem(word: str) -> str:
    """Naive suffix strip — handles the most common English inflections.

    Not a real stemmer; just enough to prevent false negatives like
    'tested' vs 'test' or 'returns' vs 'return'.
    """
    for suffix in ("ing", "tion", "ed", "es", "ly", "er", "est", "ment", "ness"):
        if word.endswith(suffix) and len(word) - len(suffix) >= 3:
            return word[: -len(suffix)]
    if word.endswith("s") and len(word) > 4:
        return word[:-1]
    return word


def score_completion(exit_condition: str, evidence: str) -> float:
    """Return 0.0–1.0 ratio of exit-condition keywords matched by evidence.

    Uses meaningful-word extraction (stop-word removal) + naive stemming
    so that 'test passes' is NOT matched by random mentions of 'test'.
    """
    exit_stems = {_stem(w) for w in _meaningful_words(exit_condition)}
    evidence_stems = {_stem(w) for w in _meaningful_words(evidence)}

    if not exit_stems:
        return 1.0  # vacuously true — empty exit condition

    return len(exit_stems & evidence_stems) / len(exit_stems)
```

**Snippet (verbatim from `handlers.py:318-360` base branch):**
```python
async def handle_task_complete(args: Dict[str, Any]) -> List[TextContent]:
    lock_data = read_json(TASK_LOCK_FILE)
    if lock_data is None:
        return _text("⚓ ERROR: No active task to complete.")

    evidence  = args["completion_evidence"]
    exit_cond = lock_data["exit_condition"]

    # Semantic-aware matching: stop-word removal + naive stemming
    # prevents false positives like "test" matching "I tested things"
    match_ratio = score_completion(exit_cond, evidence)

    if match_ratio < 0.5:
        return _text(
            f"⚓ COMPLETION REJECTED\n\n"
            f'Exit condition not satisfied: "{lock_data["exit_condition"]}"\n'
            f"Match ratio: {match_ratio:.0%}\n\n"
            f'Evidence: "{args["completion_evidence"]}"\n\n'
            f"You may be experiencing premature closure (ADHD pattern).\n"
            f"Current task remains LOCKED.\n\n"
            f"Provide evidence that specifically addresses the exit condition."
        )
```

**What to port to EMA:**
EMA currently has `Ema.Executions.Execution` with loose "completed" status. Add a mandatory `evidence :: String.t()` field that must be supplied on completion. Run `score_completion(execution.intent.exit_condition, evidence)` and reject below `0.5`. The rejection message names the ADHD failure mode ("premature closure") — ship that verbatim in the UI. That naming is load-bearing for ADHD users.

**Adaptation notes:**
- Elixir stemmer: `Ema.Text.Stem.stem/1` — port the suffix list verbatim: `["ing", "tion", "ed", "es", "ly", "er", "est", "ment", "ness"]` + plural `"s"` guard (min length 5 for `"s"` strip).
- Edge case: the 3-char-minimum-after-strip guard (`len(word) - len(suffix) >= 3`) must be preserved to avoid stripping `"being"` to `"b"`.
- 0.5 threshold is the magic number. Do NOT drop it to 0.3 without ADHD user testing.

### Pattern 4: Session checkpoint with emotional state + git commit

**Files:**
- `mcp-server/task_anchor/handlers.py:421-494` — `handle_session_checkpoint` (base branch)
- `mcp-server/task_anchor/handlers.py:497-548` — `handle_session_resume` (base branch)
- `mcp-server/task_anchor/tools.py:131-156` — session_checkpoint schema

**Snippet (verbatim from `tools.py:131-156`):**
```python
Tool(
    name="session_checkpoint",
    description="Mandatory session-end tool. Writes SESSION.json and creates a git checkpoint.",
    inputSchema={
        "type": "object",
        "properties": {
            "emotional_state": {
                "type": "string",
                "enum": ["flow", "stuck", "frustrated", "tired", "satisfied"],
                "description": "Critical for resume protocol.",
            },
            "next_micro_action": {
                "type": "string",
                "description": "The exact next step (specific, not 'finish the function').",
            },
            "blocker_note": {
                "type": "string",
                "description": "If stuck, what is the specific blocker?",
            },
            "force": {
                "type": "boolean",
                "description": "Allow checkpoint even without an active task lock.",
                "default": False,
            },
        },
        "required": ["emotional_state", "next_micro_action"],
    },
),
```

**Snippet (verbatim from `handlers.py:421-494` base branch):**
```python
async def handle_session_checkpoint(args: Dict[str, Any]) -> List[TextContent]:
    if not TASK_LOCK_FILE.exists() and not args.get("force"):
        return _text("⚓ WARNING: No active task. Pass force=true if intentional.")

    task_data = read_json(TASK_LOCK_FILE)  # None if no lock — that's valid with force

    session_data = {
        "timestamp":        datetime.now().isoformat(),
        "emotional_state":  args["emotional_state"],
        "next_micro_action": args["next_micro_action"],
        "blocker_note":     args.get("blocker_note", ""),
        "git_branch":       get_git_branch(),
        "task":             task_data,
    }

    write_json(SESSION_FILE, session_data)
    update_session_log(session_data)

    # Git checkpoint commit
    task_title = (task_data or {}).get("building", "unknown")[:40]
    git_msg = (
        f"session-anchor: {task_title} | "
        f"Next: {args['next_micro_action'][:30]} | "
        f"State: {args['emotional_state']}"
    )
    try:
        subprocess.run(["git", "add", "-A"], check=False, timeout=10)
        subprocess.run(
            ["git", "commit", "-m", git_msg, "--no-verify"],
            check=False,
            timeout=10,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass
```

**Snippet (verbatim from `handlers.py:497-548` base branch):**
```python
async def handle_session_resume() -> List[TextContent]:
    session = read_json(SESSION_FILE)
    if session is None:
        return _text("⚓ No previous session found. Start fresh with task_lock_create.")

    task      = session.get("task") or {}
    emotional = session["emotional_state"]

    body = (
        f"⚓ SESSION RESUME\n\n"
        f"Last active: {session['timestamp'][:16]}\n"
        f"Working on:  {task.get('building', 'Unknown')}\n"
        f"State:       {emotional.upper()}\n"
        f"Next action: {session['next_micro_action']}\n\n"
    )

    if emotional in ("stuck", "frustrated"):
        body += (
            f"⚠️ RESUMPTION ALERT: You left in a difficult state.\n\n"
            f"Blocker was: {session.get('blocker_note') or 'Not recorded'}\n\n"
            f"OPTIONS:\n"
            f'[1] TINY STEP: Attempt "{session["next_micro_action"]}" for 2 minutes\n'
            f"[2] DETOUR: Switch to a parked item (novelty reset)\n"
            f"[3] DEBUG: Analyse blocker before touching code\n"
            f"[4] RESET: Park yesterday's attempt, start fresh"
        )
    else:
        body += (
            f"Ready to resume? Next step: {session['next_micro_action']}\n\n"
            f"Call task_lock_create to re-engage enforcement."
        )

    return _text(body)
```

**What to port to EMA:**
EMA already has `Ema.ClaudeSessions.ClaudeSession` — add `emotional_state`, `next_micro_action`, `blocker_note` to that schema. On session end (detected by `SessionWatcher`), prompt the user (or agent) to fill them. Store as `session_checkpoint` JSON. On EMA morning startup (or `ema resume`), show the resume dialog. If `emotional_state in [:stuck, :frustrated]`, force the 4-option branching UI — the "TINY STEP / DETOUR / DEBUG / RESET" framing is the critical ADHD unlock ritual.

**Adaptation notes:**
- EMA is Elixir — use `System.cmd("git", ["add", "-A"])` and `System.cmd("git", ["commit", "-m", msg])` with `stderr_to_stdout: true`. Don't fail the checkpoint on git error.
- The git message format `"session-anchor: {title} | Next: {action} | State: {state}"` should be preserved exactly — it's useful as a `git log --grep` filter.
- The 40-char / 30-char truncations are cosmetic; keep them for consistency with the source.

### Pattern 5: Parked ideas append-only log with urgency tags

**Files:**
- `mcp-server/task_anchor/handlers.py:181-237` — `handle_parked_add` + `handle_parked_list`
- `mcp-server/task_anchor/storage.py:117-128` — `append_line` (locked append)
- `mcp-server/task_anchor/helpers.py:57-68` — `extract_parked_timestamp`

**Snippet (verbatim from `handlers.py:214-237` base branch):**
```python
async def handle_parked_add(args: Dict[str, Any]) -> List[TextContent]:
    idea     = args["idea"]
    category = args["category"]
    urgency  = args.get("urgency", "medium")

    timestamp = datetime.now().isoformat()
    entry = f"- [{urgency.upper()}] {timestamp} | {category}: {idea}"
    append_line(PARKED_FILE, entry)

    log_drift_event(DRIFT_HISTORY, "parked_success", True)

    return _text(
        f"🅿️ IDEA PARKED\n\n"
        f"Urgency:  {urgency}\n"
        f"Category: {category}\n\n"
        f"The idea is safe. You can let it go. Return to current task."
    )
```

**Snippet (verbatim from `storage.py:117-128`):**
```python
def append_line(path: Path, line: str) -> None:
    """
    Thread-safe append of a single line to a text file.
    Creates the file if missing.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a", encoding="utf-8") as f:
        _acquire(f)
        try:
            f.write(line if line.endswith("\n") else line + "\n")
        finally:
            _release(f)
```

**What to port to EMA:**
EMA's `Ema.BrainDump.Item` is already the brain-dump inbox. Add a `parked: boolean` flag and an `urgency :: :blocking | :high | :medium | :low` field. On drift detection, a `park_tangent` action creates a BrainDump item with `parked: true` — it's visually distinct from normal brain dumps (they came from drift, not volition). The framing text "The idea is safe. You can let it go. Return to current task." is a calming script specifically designed for ADHD rumination — port verbatim.

**Adaptation notes:**
- Urgency enum: `[:blocking, :high, :medium, :low]` — use `Ecto.Enum` or string column.
- Category enum: `[:feature, :refactor, :research, :bugfix, :tech_debt]` — same treatment.
- Parked items from the current intent should be visible as a filterable section in the UI — the `current_session` filter in `parked_list` shows exactly this.

### Pattern 6: Atomic JSON write with cross-platform file locking

**Files:**
- `mcp-server/task_anchor/storage.py:1-89` — lock primitives + `atomic_write`
- `mcp-server/task_anchor/storage.py:136-166` — `initialise_state_files`

**Snippet (verbatim from `storage.py:68-89`):**
```python
@contextmanager
def atomic_write(path: Path) -> Generator[Any, None, None]:
    """
    Context manager: yields an open file handle for writing.
    On exit, atomically replaces `path` with the completed temp file.

    Usage:
        with atomic_write(MY_FILE) as f:
            json.dump(data, f)
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        _acquire(f)
        try:
            yield f
        finally:
            _release(f)

    if os.name == "nt" and path.exists():
        path.unlink()
    tmp.rename(path)
```

**What to port to EMA:**
Less load-bearing — EMA uses SQLite/Ecto for state. But the pattern matters for any file EMA writes to the vault. `Ema.Vault.AtomicWrite.write!/2` is a trivial port.

**Adaptation notes:**
- Elixir: `File.write/2` with `:sync` flag, or write to temp + `File.rename/2`. Use `:os.type()` to guard Windows paths.

### Pattern 7: MCP tool schema pattern — single-responsibility `tools.py`

**Files:**
- `mcp-server/task_anchor/tools.py:11-241` — full tool definition list

**Meta-pattern:** `tools.py` contains ZERO handler logic. It's pure schema. `server.py` has a dict mapping tool name → handler coroutine. `handlers.py` has all the actual logic. This gives you:

1. A single file to read to understand the full external API
2. A single file to add a new tool to the dispatch
3. A single file for business logic

**What to port to EMA:**
EMA's router already follows this pattern (`lib/ema_web/router.ex` is schema-only). But for the agent tool registry specifically (`Ema.Agents.AgentWorker` currently has inline tool definitions), split:

- `lib/ema/agents/tool_schemas.ex` — schema-only module returning a list of `%Ema.Agents.Tool{}` structs
- `lib/ema/agents/tool_handlers.ex` — one function per tool (handler logic)
- `lib/ema/agents/tool_router.ex` — dispatch table

### Pattern 8: The enforcement prompt (CLAUDE.md)

**Files:**
- `.claude/CLAUDE.md` — the prompt shipped alongside the MCP server

**Snippet (verbatim from `.claude/CLAUDE.md`):**
```markdown
# TASK ANCHOR MCP PROTOCOL

You have access to the Task Anchor MCP server. These tools are MANDATORY, not optional.

...

## Absolute Rules

1. You CANNOT write, edit, or create files until `task_lock_status` returns ACTIVE
2. You MUST call `drift_detect` on every user message before responding
3. You MUST call `scope_validate_edit` before modifying any file
4. If `task_lock_status` shows NO TASK LOCK, you MUST refuse to help with code until user creates one

## Enforcement Dialogue

If user tries to skip Task Lock:
> "I cannot help with coding until we lock a task. This prevents ADHD drift. Please describe what you're building so I can call task_lock_create."

If drift_detect returns positive:
> "I've detected potential drift. I'm parking this idea for you (calling parked_add) so it's safe. Now, back to our locked task..."

## Session Protocol

- **Start:** Call `session_resume` to recover prior context. If no session found, call `task_lock_status`.
- **During:** Call `drift_detect` on every user turn. Call `parked_add` for any tangents.
- **End:** `session_checkpoint` is MANDATORY before ending any work session.
```

**What to port to EMA:**
EMA's agent system uses per-agent system prompts. Create `Ema.Agents.SystemPrompts.task_anchor_addon/0` that every agent includes by default. The "MANDATORY, not optional" framing + the 4 absolute rules are the actual enforcement mechanism — drift_detect as a tool call isn't enough without the system-prompt pressure that tells the model it MUST call it.

**Adaptation notes:**
- Ship this exact wording. The language pattern is ADHD-validated, not "good copy" — don't rewrite.
- EMA's agent system already supports per-agent prompts via `Ema.Agents.Agent.settings.system_prompt`. Add a `enforce_task_anchor: true` agent setting that prepends this block.

## Gotchas found while reading

- **Unmerged git conflict markers.** `handlers.py`, `models.py`, `config.py`, `server.py`, `storage.py`, `streak.py`, `tools.py` all have `<<<<<<<` / `=======` / `>>>>>>>` markers. The HEAD branch adds tone + flow mode; the base branch is simpler. When porting, pick one and erase the conflict. The HEAD branch is more feature-rich (adds `set_tone`, `get_tone`, `flow_mode_activate`, `flow_mode_deactivate`). The base branch is easier to understand and fully functional without them. **Recommend porting base + adding flow mode later.**
- **Signal phrase count mismatch.** Task brief says "26 weighted phrases" — the repo has 14. Possibly referring to an older tagged version, or counting `_STOP` words. Don't chase the number; the mechanism is what matters.
- **`_stem` is not a real stemmer.** It's a hand-rolled suffix stripper with a 9-suffix list. Good enough for exit-condition matching, would be fragile for full-text search. Don't reuse for other purposes without warning.
- **Absolute path normalization in `validate_scope` uses `os.path.abspath`.** On Linux this is cwd-relative resolution — if the server is started from a different dir, scope prefix matching can silently pass or fail. The fix they use is `config.py:_resolve_base` walking up from `__file__` to find the repo root — **port this pattern**, don't use relative paths.
- **`atomic_write` on Windows unlinks then renames.** On Linux, `rename` is already atomic and `unlink` is unnecessary. The branch is guarded by `os.name == "nt"`, but it's a gotcha — cross-platform atomic write is not actually atomic on Windows.
- **`completion_celebration` prints to stdout BEFORE `unlink()`**. This is intentional (rewards dict needs to be read from the lock file first). If you port this, keep the ordering.
- **`rewards` field was a later addition.** The comment in `models.py` explicitly mentions `"The rewards field is declared here to prevent the **lock_data TypeError that occurred in the original monolith."` — the original was one big file that choked on unknown keys. Port the `from_dict` filter to avoid that trap.
- **MCP server uses stdio transport only.** `server.py` calls `stdio_server()` — no HTTP/SSE. If EMA wants this as a remote tool, wrap it in an HTTP layer or use the MCP protocol directly over websockets.
- **`parked_list` current_session filter silently returns all entries if no lock.** Base branch comment: `# If no lock, current_session is meaningless — return all entries`. Port this fallback behavior or throw — don't leave it ambiguous.
- **The 14 drift signals are hand-tuned for English code conversations.** They will miss Spanish, German, technical jargon in non-English locales. The weights are not corpus-derived — they're hand-assigned. This is a known limitation, not a bug.

## Port recommendation

Concrete next steps for EMA's port:

1. **Start with `Ema.Intents.DriftGuard` module** — port `drift.py` first. Single file, ~200 lines in Elixir. Write tests against the 14-phrase signal table first (test-driven). Use `:persistent_term` to cache compiled regexes.
2. **Extend `Ema.Intents.Intent` schema** — add `building`, `done_criteria`, `scope_files`, `exit_condition`, `status`, `emotional_state`, `rewards`. Write an Ecto migration.
3. **Wire `DriftGuard.check/2` into `Ema.Agents.AgentWorker.handle_message/2`** — before dispatching to Claude, run the check against the active intent's `exit_condition`. On positive, short-circuit to `Ema.BrainDump.create_item(parked: true, ...)` and return the "idea is safe" message.
4. **Add `Ema.Intents.Intent.validate_scope/2`** — port the prefix-match logic. Wire into `Ema.Agents.ToolHandlers.edit_file/1` as a pre-check.
5. **Add `score_completion/2`** to `Ema.Text.Overlap` or similar. Use it to gate execution completion in `Ema.Executions.complete/2`.
6. **Port `handle_session_checkpoint`** to EMA's `ClaudeSessions` context. Trigger it from the `ema session end` CLI command.
7. **Ship the CLAUDE.md protocol text verbatim** as `Ema.Agents.SystemPrompts.task_anchor_addon/0`. Make it opt-in per agent via `agent.settings.enforce_task_anchor`.
8. **Test with real ADHD sessions** — the 0.5 completion threshold and 4.0 drift threshold are human-calibrated. Do not retune without ADHD user feedback.

**Risks:**
- Over-enforcement: a naive port will frustrate users mid-flow. Flow mode (HEAD branch's `flow.py`) is the answer — port it as a Phase 2.
- False positive on "actually" (weight 2) — it's legitimately in-flow language. Only fires on compound drift. Keep the weight low.
- Scope matching on `scope_files = ["src/"]` will allow `src/foo.rs` but not `./src/foo.rs` unless absolutized correctly. Test both.
- Stop-word set is English-only. If EMA gets i18n, make this configurable.

## Related extractions

- `[[research/_extractions/snarktank-ralph]]` — sibling self-building loop, complements Task-Anchor's single-task enforcement
- `[[research/_extractions/aden-hive-hive]]` — worker/judge/queen 3-tier, orthogonal solution to the same drift problem
- `[[research/_extractions/ravila4-claude-adhd-skills]]` — adds the UserPromptSubmit hook pattern for injecting drift_detect automatically

## Connections

- `[[research/life-os-adhd/Kodaxadev-Task-Anchor-MCP]]` — original research node
- `[[research/_clones/INDEX]]`

#extraction #life-os-adhd #task-anchor #drift-detection #mcp #adhd #priority
