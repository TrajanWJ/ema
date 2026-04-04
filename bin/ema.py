#!/usr/bin/env python3
"""
EMA CLI — Terminal client for the EMA daemon at localhost:4488
Version: 1.0.0 (Week 7 MVP)
"""

import sys
import os
import json
import argparse
import urllib.request
import urllib.error
import urllib.parse
import time
from datetime import datetime
from pathlib import Path

# ─── Config ──────────────────────────────────────────────────────────────────

CONFIG_PATH = Path.home() / ".ema" / "config.json"
DEFAULT_HOST = "localhost:4488"

def load_config():
    if CONFIG_PATH.exists():
        try:
            return json.loads(CONFIG_PATH.read_text())
        except Exception:
            pass
    return {}

def save_config(cfg):
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(cfg, indent=2))

CONFIG = load_config()

# ─── HTTP client ─────────────────────────────────────────────────────────────

class EMAClient:
    def __init__(self, host, verbose=False):
        self.base = f"http://{host}"
        self.verbose = verbose

    def request(self, method, path, data=None, params=None):
        url = self.base + path
        if params:
            url += "?" + urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})

        body = json.dumps(data).encode() if data is not None else None
        headers = {"Content-Type": "application/json", "Accept": "application/json"}

        if self.verbose:
            print(f"  → {method} {url}", file=sys.stderr)
            if data:
                print(f"  → body: {json.dumps(data)}", file=sys.stderr)

        try:
            req = urllib.request.Request(url, data=body, headers=headers, method=method)
            with urllib.request.urlopen(req, timeout=15) as resp:
                raw = resp.read().decode()
                if self.verbose:
                    print(f"  ← {resp.status} {raw[:200]}", file=sys.stderr)
                if raw:
                    return json.loads(raw)
                return {}
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            # Try to parse error JSON
            try:
                err = json.loads(body)
                errors = err.get("errors", err)
                die(f"API error {e.code}: {json.dumps(errors)}", exit_code=1)
            except Exception:
                if "<html" in body.lower():
                    die(f"API error {e.code}: endpoint not found or server error", exit_code=1)
                die(f"API error {e.code}: {body[:200]}", exit_code=1)
        except urllib.error.URLError as e:
            die(
                f"Cannot reach EMA daemon at {self.base.replace('http://', '')}\n"
                f"  → Try: cd ~/Projects/ema/daemon && mix phx.server\n"
                f"  → Or:  ema status",
                exit_code=2
            )
        except Exception as e:
            die(f"Request failed: {e}", exit_code=1)

    def get(self, path, params=None):
        return self.request("GET", path, params=params)

    def post(self, path, data=None):
        return self.request("POST", path, data=data or {})

    def put(self, path, data=None):
        return self.request("PUT", path, data=data or {})

    def patch(self, path, data=None):
        return self.request("PATCH", path, data=data or {})

    def delete(self, path):
        return self.request("DELETE", path)

# ─── Output helpers ───────────────────────────────────────────────────────────

USE_JSON = False
QUIET = False

def out_json(data):
    print(json.dumps(data, indent=2, default=str))

def out(msg):
    if not QUIET:
        print(msg)

def err(msg):
    print(f"Error: {msg}", file=sys.stderr)

def die(msg, exit_code=1):
    print(f"Error: {msg}", file=sys.stderr)
    sys.exit(exit_code)

def fmt_time(iso):
    if not iso:
        return "—"
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        now = datetime.now(dt.tzinfo)
        delta = now - dt
        secs = int(delta.total_seconds())
        if secs < 60:
            return f"{secs}s ago"
        elif secs < 3600:
            return f"{secs//60}m ago"
        elif secs < 86400:
            return f"{secs//3600}h ago"
        else:
            return f"{secs//86400}d ago"
    except Exception:
        return iso[:10]

def fmt_priority(p):
    if p is None:
        return "—"
    mapping = {1: "critical", 2: "high", 3: "medium", 4: "low", 5: "minimal"}
    return mapping.get(int(p), str(p))

def table(rows, headers, widths=None):
    """Print a table. rows = list of dicts or tuples, headers = list of strings."""
    if not rows:
        out("(no results)")
        return
    if widths is None:
        widths = [max(len(h), max(len(str(r[i] if isinstance(r, (list,tuple)) else r.get(h.lower().replace(" ","_"), ""))) for r in rows)) for i, h in enumerate(headers)]
    fmt = "  ".join(f"{{:<{w}}}" for w in widths)
    out(fmt.format(*headers))
    out("  ".join("─" * w for w in widths))
    for r in rows:
        if isinstance(r, (list, tuple)):
            out(fmt.format(*[str(v)[:w] for v, w in zip(r, widths)]))
        else:
            out(fmt.format(*[str(r.get(h.lower().replace(" ","_"), ""))[:w] for h, w in zip(headers, widths)]))

# ─── Command implementations ──────────────────────────────────────────────────

# ── task ──────────────────────────────────────────────────────────────────────

def cmd_task_create(client, args):
    payload = {"task": {"title": args.title}}
    if args.project:
        payload["task"]["project_id"] = args.project
    if args.priority:
        payload["task"]["priority"] = args.priority
    if args.due:
        payload["task"]["due_date"] = args.due
    if args.description:
        payload["task"]["description"] = args.description
    if args.status:
        payload["task"]["status"] = args.status

    result = client.post("/api/tasks", payload)
    task = result.get("task", result)

    if USE_JSON:
        out_json(task)
        return

    tid = task.get("id", "?")
    title = task.get("title", "?")
    status = task.get("status", "todo")
    proj = task.get("project_id") or "—"

    # Structural keyword detection
    structural = ["refactor", "restructure", "rewrite", "migrate", "redesign", "rearchitect"]
    warnings = [kw for kw in structural if kw in title.lower()]
    if warnings:
        out(f"[WARN] Structural keyword detected: '{warnings[0]}'. Consider: ema proposal create instead.")

    out(f"{tid} | {title} | project: {proj} | status: {status}")


def cmd_task_list(client, args):
    params = {}
    if args.project:
        params["project_id"] = args.project
    if args.status:
        params["status"] = args.status
    if args.limit:
        params["limit"] = args.limit

    result = client.get("/api/tasks", params=params if params else None)
    tasks = result.get("tasks", result) if isinstance(result, dict) else result

    if args.overdue:
        now = datetime.utcnow().isoformat()
        tasks = [t for t in tasks if t.get("due_date") and t["due_date"] < now]

    if USE_JSON:
        out_json(tasks)
        return

    if not tasks:
        out("No tasks found.")
        return

    rows = []
    for t in tasks:
        rows.append([
            t.get("id", "?")[:20],
            (t.get("title") or "")[:35],
            (t.get("project_id") or "—")[:12],
            t.get("status", "?")[:10],
            fmt_priority(t.get("priority")),
            fmt_time(t.get("due_date")) if t.get("due_date") else "—",
        ])
    table(rows, ["ID", "TITLE", "PROJECT", "STATUS", "PRIORITY", "DUE"],
          [22, 36, 14, 11, 9, 12])


def cmd_task_get(client, args):
    result = client.get(f"/api/tasks/{args.task_id}")
    task = result.get("task", result)

    if USE_JSON:
        out_json(result)
        return

    out(f"\nTask: {task.get('id')}")
    out(f"  Title:    {task.get('title')}")
    out(f"  Status:   {task.get('status', '?')}")
    out(f"  Priority: {fmt_priority(task.get('priority'))}")
    out(f"  Project:  {task.get('project_id') or '—'}")
    out(f"  Due:      {task.get('due_date') or '—'}")
    out(f"  Created:  {fmt_time(task.get('created_at'))}")
    if task.get("description"):
        out(f"  Desc:     {task['description']}")

    subtasks = result.get("subtasks", [])
    if subtasks:
        out(f"\n  Subtasks ({len(subtasks)}):")
        for s in subtasks:
            out(f"    [{s.get('status','?')}] {s.get('title')}")


def cmd_task_dispatch(client, args):
    """Dispatch a task — routes through OpenClaw via /api/openclaw/dispatch."""
    # First get the task to build context
    task_result = client.get(f"/api/tasks/{args.task_id}")
    task = task_result.get("task", task_result)

    if args.dry_run:
        agent = args.agent or "auto"
        out(f"[DRY RUN] Would dispatch task {args.task_id} to agent: {agent}")
        out(f"  Title: {task.get('title')}")
        if args.scope:
            out(f"  Scope: {args.scope}")
        return

    payload = {
        "task_id": args.task_id,
        "objective": task.get("title", ""),
        "mode": "implement",
    }
    if args.agent:
        payload["agent"] = args.agent
    if args.scope:
        payload["objective"] += f"\n\nScope constraint: {args.scope}"
    if args.context:
        payload["objective"] += f"\n\nContext: {args.context}"

    # Try openclaw dispatch first
    try:
        result = client.post("/api/openclaw/dispatch", payload)
        if USE_JSON:
            out_json(result)
            return
        exec_id = result.get("execution_id") or result.get("id") or "?"
        agent = result.get("agent") or args.agent or "auto"
        out(f"Dispatched {args.task_id} → agent: {agent} | execution: {exec_id}")
    except SystemExit:
        # Fallback: create execution directly
        exec_payload = {
            "execution": {
                "objective": task.get("title", ""),
                "mode": "implement",
                "task_id": args.task_id,
                "title": task.get("title", ""),
            }
        }
        result = client.post("/api/executions", exec_payload)
        if USE_JSON:
            out_json(result)
            return
        exec_id = result.get("id") or result.get("execution", {}).get("id") or "?"
        out(f"Dispatched {args.task_id} → execution: {exec_id}")


def cmd_task_status(client, args):
    result = client.get(f"/api/tasks/{args.task_id}")
    task = result.get("task", result)

    if USE_JSON:
        out_json(task)
        return

    status = task.get("status", "?")
    created = task.get("created_at")
    elapsed = ""
    if created:
        try:
            dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
            delta = datetime.now(dt.tzinfo) - dt
            m, s = divmod(int(delta.total_seconds()), 60)
            elapsed = f" | age: {m}m{s}s"
        except Exception:
            pass

    out(f"{args.task_id} | {status}{elapsed} | {task.get('title', '?')}")


# ── project ───────────────────────────────────────────────────────────────────

def cmd_project_create(client, args):
    payload = {"project": {"name": args.name}}
    if args.slug:
        payload["project"]["slug"] = args.slug
    if args.description:
        payload["project"]["description"] = args.description
    if args.path:
        payload["project"]["local_path"] = args.path
    if args.repo:
        payload["project"]["repo_url"] = args.repo
    if args.client_name:
        payload["project"]["client_name"] = args.client_name

    result = client.post("/api/projects", payload)
    proj = result.get("project", result)

    if USE_JSON:
        out_json(proj)
        return

    out(f"{proj.get('id','?')} | {proj.get('name','?')} | slug: {proj.get('slug','?')}")


def cmd_project_list(client, args):
    result = client.get("/api/projects")
    projects = result.get("projects", result) if isinstance(result, dict) else result

    if USE_JSON:
        out_json(projects)
        return

    if not projects:
        out("No projects found.")
        return

    rows = []
    for p in projects:
        rows.append([
            p.get("slug") or p.get("id","?"),
            (p.get("name") or "?")[:20],
            p.get("status","active")[:8],
            fmt_time(p.get("updated_at")),
        ])
    table(rows, ["SLUG", "NAME", "STATUS", "LAST ACTIVE"], [18, 22, 10, 14])


def cmd_project_view(client, args):
    result = client.get(f"/api/projects/{args.slug}")
    proj = result.get("project", result)

    if USE_JSON:
        out_json(result)
        return

    out(f"\nProject: {proj.get('id')}")
    out(f"  Name:    {proj.get('name')}")
    out(f"  Slug:    {proj.get('slug')}")
    out(f"  Status:  {proj.get('status','active')}")
    if proj.get("description"):
        out(f"  Desc:    {proj['description'][:80]}")
    if proj.get("local_path") or proj.get("path"):
        out(f"  Path:    {proj.get('local_path') or proj.get('path')}")
    if proj.get("repo_url"):
        out(f"  Repo:    {proj['repo_url']}")
    out(f"  Created: {fmt_time(proj.get('created_at'))}")


def cmd_project_context(client, args):
    result = client.get(f"/api/projects/{args.slug}/context")

    if USE_JSON:
        out_json(result)
        return

    if args.inject_to:
        Path(args.inject_to).write_text(json.dumps(result, indent=2))
        out(f"Context bundle written to {args.inject_to}")
        return

    out(json.dumps(result, indent=2, default=str))


def cmd_project_deps(client, args):
    # Projects endpoint — show project relationships via tasks
    result = client.get(f"/api/projects/{args.slug}")
    proj = result.get("project", result)

    if USE_JSON:
        out_json(proj)
        return

    out(f"Project: {proj.get('name', args.slug)}")
    # Dependencies not yet in API — show what we can
    tasks_result = client.get(f"/api/projects/{args.slug}/tasks")
    tasks = tasks_result.get("tasks", []) if isinstance(tasks_result, dict) else tasks_result
    out(f"  Tasks: {len(tasks)}")
    if tasks:
        for t in tasks[:5]:
            out(f"    [{t.get('status','?')}] {t.get('title','?')[:50]}")
        if len(tasks) > 5:
            out(f"    ... and {len(tasks)-5} more")
    out("  (Full dependency graph: Phase 2)")


# ── proposal ──────────────────────────────────────────────────────────────────

def cmd_proposal_view(client, args):
    result = client.get(f"/api/proposals/{args.proposal_id}")
    prop = result if not isinstance(result, dict) or "id" in result else result.get("proposal", result)

    if USE_JSON:
        out_json(prop)
        return

    out(f"\nProposal: {prop.get('id')}")
    out(f"  Title:   {prop.get('title')}")
    out(f"  Status:  {prop.get('status')}")
    if prop.get("body"):
        out(f"  Body:\n    {prop['body'][:300]}")
    if prop.get("summary"):
        out(f"  Summary: {prop['summary'][:200]}")
    out(f"  Created: {fmt_time(prop.get('created_at'))}")


def cmd_proposal_list(client, args):
    result = client.get("/api/proposals")
    proposals = result.get("proposals", result) if isinstance(result, dict) else result

    if args.status:
        proposals = [p for p in proposals if p.get("status") == args.status]

    if USE_JSON:
        out_json(proposals)
        return

    if not proposals:
        out("No proposals found.")
        return

    rows = []
    for p in proposals:
        rows.append([
            p.get("id","?")[:20],
            (p.get("title") or "?")[:40],
            (p.get("project_id") or "—")[:12],
            p.get("status","?")[:10],
            fmt_time(p.get("created_at")),
        ])
    table(rows, ["ID", "TITLE", "PROJECT", "STATUS", "CREATED"],
          [22, 42, 14, 11, 12])


def cmd_proposal_dispatch(client, args):
    """Dispatch a proposal — approve then send to OpenClaw."""
    # First approve it
    approve_result = client.post(f"/api/proposals/{args.proposal_id}/approve", {})
    prop = approve_result if "id" in approve_result else approve_result.get("proposal", approve_result)

    if USE_JSON:
        out_json({"approved": prop, "dispatch": None})
        return

    out(f"Approved {args.proposal_id} | {prop.get('title','?')}")

    # Then dispatch via openclaw
    payload = {
        "proposal_id": args.proposal_id,
        "objective": prop.get("body") or prop.get("title", ""),
        "mode": "implement",
        "title": prop.get("title", ""),
    }
    if args.agent:
        payload["agent"] = args.agent

    try:
        result = client.post("/api/openclaw/dispatch", payload)
        exec_id = result.get("execution_id") or result.get("id") or "?"
        out(f"→ Dispatched to OpenClaw | execution: {exec_id}")
    except SystemExit:
        # Fallback: create execution directly
        exec_payload = {
            "execution": {
                "objective": prop.get("body") or prop.get("title", ""),
                "proposal_id": args.proposal_id,
                "mode": "implement",
                "title": prop.get("title", ""),
            }
        }
        result = client.post("/api/executions", exec_payload)
        exec_id = result.get("id") or result.get("execution", {}).get("id") or "?"
        out(f"→ Created execution: {exec_id}")


# ── vault ─────────────────────────────────────────────────────────────────────

def cmd_vault_search(client, args):
    params = {"q": args.query}
    if args.mode:
        params["mode"] = args.mode
    if args.type:
        params["type"] = args.type
    if args.limit:
        params["limit"] = args.limit
    if args.after:
        params["after"] = args.after

    result = client.get("/api/vault/search", params=params)
    notes = result.get("notes", result) if isinstance(result, dict) else result

    if USE_JSON:
        out_json(notes)
        return

    if not notes:
        out("No results found.")
        return

    for n in notes:
        score = n.get("score") or n.get("relevance") or ""
        score_str = f"[{score:.2f}] " if isinstance(score, float) else ""
        path = n.get("path") or n.get("title") or "?"
        excerpt = (n.get("excerpt") or n.get("body") or n.get("content") or "")[:120]
        out(f"{score_str}{path}")
        if excerpt:
            out(f"       {excerpt.strip()}")
        out("")


# ── status ────────────────────────────────────────────────────────────────────

def cmd_status(client, args):
    # Check daemon
    daemon_ok = False
    try:
        health = client.get("/api/health")
        daemon_ok = True
        daemon_info = "✓ localhost:4488"
    except SystemExit:
        daemon_info = "✗ unreachable"

    if USE_JSON:
        out_json({"daemon": daemon_ok, "host": "localhost:4488"})
        return

    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    out(f"╔═══════════════════════════════════════╗")
    out(f"║  EMA Status — {now}  ║")
    out(f"╠═══════════════════════════════════════╣")
    out(f"║  Daemon      {daemon_info:<26} ║")

    # OpenClaw
    try:
        oc = client.get("/api/openclaw/status")
        oc_status = "✓ connected"
    except SystemExit:
        oc_status = "— not checked"
    out(f"║  OpenClaw    {oc_status:<26} ║")

    out(f"╠═══════════════════════════════════════╣")

    if daemon_ok:
        try:
            tasks_r = client.get("/api/tasks")
            tasks = tasks_r.get("tasks", [])
            pending = len([t for t in tasks if t.get("status") in ("todo","pending","created")])
            running = len([t for t in tasks if t.get("status") == "running"])
            out(f"║  Pending tasks: {pending:<22} ║")
            out(f"║  Running tasks: {running:<22} ║")
        except Exception:
            pass

        try:
            props_r = client.get("/api/proposals")
            props = props_r.get("proposals", [])
            open_props = len([p for p in props if p.get("status") in ("queued","pending","generating")])
            out(f"║  Open proposals: {open_props:<21} ║")
        except Exception:
            pass

        try:
            proj_r = client.get("/api/projects")
            projs = proj_r.get("projects", [])
            out(f"║  Active projects: {len(projs):<20} ║")
        except Exception:
            pass

    out(f"╚═══════════════════════════════════════╝")


# ── dispatch ──────────────────────────────────────────────────────────────────

def cmd_dispatch_status(client, args):
    result = client.get("/api/executions")
    executions = result.get("executions", result) if isinstance(result, dict) else result

    if USE_JSON:
        out_json(executions)
        return

    if not executions:
        out("No executions found.")
        return

    rows = []
    for e in executions[:args.limit or 20]:
        rows.append([
            e.get("id","?")[:12],
            (e.get("mode") or "?")[:10],
            (e.get("project_slug") or "—")[:12],
            (e.get("title") or e.get("objective","?"))[:35],
            e.get("status","?")[:10],
            fmt_time(e.get("inserted_at")),
        ])
    table(rows, ["EXEC_ID", "MODE", "PROJECT", "TASK", "STATUS", "ELAPSED"],
          [14, 11, 14, 37, 11, 12])


def cmd_dispatch_logs(client, args):
    result = client.get(f"/api/executions/{args.execution_id}")
    if USE_JSON:
        out_json(result)
        return
    exec_obj = result if "id" in result else result.get("execution", result)
    out(f"Execution: {exec_obj.get('id')}")
    out(f"Status: {exec_obj.get('status')}")
    out(f"Mode: {exec_obj.get('mode')}")
    if exec_obj.get("objective"):
        out(f"Objective: {exec_obj['objective'][:200]}")
    meta = exec_obj.get("metadata") or {}
    if meta.get("result_summary"):
        out(f"\nResult summary:\n{meta['result_summary'][:500]}")
    if exec_obj.get("result_path"):
        out(f"\nResult path: {exec_obj['result_path']}")


# ── sync ──────────────────────────────────────────────────────────────────────

def cmd_sync_openclaw(client, args):
    result = client.get("/api/openclaw/status")
    if USE_JSON:
        out_json(result)
        return
    status = result.get("status", "unknown")
    out(f"OpenClaw: {status}")
    if result.get("agents"):
        out(f"Agents: {', '.join(result['agents'])}")


# ─── Arg parsing ──────────────────────────────────────────────────────────────

def build_parser():
    p = argparse.ArgumentParser(
        prog="ema",
        description="EMA CLI — terminal client for the EMA daemon",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Commands:
  ema task create|list|get|dispatch|status
  ema project create|list|view|context|deps
  ema proposal list|view|dispatch
  ema vault search
  ema dispatch status|logs
  ema sync openclaw
  ema status

Examples:
  ema task create "Fix auth module" --project proslync
  ema task list --status running
  ema task dispatch task_abc123 --scope "auth/ only"
  ema proposal list --status pending
  ema proposal dispatch prop_abc123
  ema vault search "auth architecture"
  ema status
        """
    )

    # Global flags
    p.add_argument("--host", "-H", default=None, help="Daemon URL (default: localhost:4488)")
    p.add_argument("--json", "-j", action="store_true", help="Output raw JSON")
    p.add_argument("--quiet", "-q", action="store_true", help="Suppress non-error output")
    p.add_argument("--verbose", "-v", action="store_true", help="Show request details")
    p.add_argument("--version", action="version", version="ema 1.0.0 (Week 7 MVP)")

    sub = p.add_subparsers(dest="group", metavar="COMMAND")

    # ── task ──
    task_p = sub.add_parser("task", help="Task management")
    task_sub = task_p.add_subparsers(dest="action", metavar="ACTION")

    tc = task_sub.add_parser("create", help="Create a task")
    tc.add_argument("title", help="Task title")
    tc.add_argument("--project", "-p", help="Project id or slug")
    tc.add_argument("--priority", type=int, choices=[1,2,3,4,5], help="Priority 1=critical 5=minimal")
    tc.add_argument("--due", help="Due date (ISO8601)")
    tc.add_argument("--description", help="Task description")
    tc.add_argument("--status", default="todo", help="Initial status (default: todo)")

    tl = task_sub.add_parser("list", help="List tasks")
    tl.add_argument("--project", "-p", help="Filter by project")
    tl.add_argument("--status", "-s", help="Filter by status")
    tl.add_argument("--overdue", action="store_true", help="Only overdue tasks")
    tl.add_argument("--limit", "-n", type=int, help="Max results")

    tg = task_sub.add_parser("get", help="Get task details")
    tg.add_argument("task_id", help="Task ID")

    td = task_sub.add_parser("dispatch", help="Dispatch a task to an agent")
    td.add_argument("task_id", help="Task ID")
    td.add_argument("--agent", "-a", help="Override agent")
    td.add_argument("--scope", help="Scope constraint")
    td.add_argument("--context", "-c", help="Additional context")
    td.add_argument("--dry-run", action="store_true", help="Show what would run")

    ts = task_sub.add_parser("status", help="Get task status")
    ts.add_argument("task_id", help="Task ID")

    # ── project ──
    proj_p = sub.add_parser("project", help="Project management")
    proj_sub = proj_p.add_subparsers(dest="action", metavar="ACTION")

    pc = proj_sub.add_parser("create", help="Create a project")
    pc.add_argument("name", help="Project name")
    pc.add_argument("--slug", help="URL-safe slug")
    pc.add_argument("--description", help="Description")
    pc.add_argument("--path", help="Local filesystem path")
    pc.add_argument("--repo", help="GitHub repo URL")
    pc.add_argument("--client", dest="client_name", help="Client name")

    proj_sub.add_parser("list", help="List projects")

    pv = proj_sub.add_parser("view", help="View project details")
    pv.add_argument("slug", help="Project slug or ID")

    pctx = proj_sub.add_parser("context", help="Get project context bundle")
    pctx.add_argument("slug", help="Project slug or ID")
    pctx.add_argument("--inject-to", help="Write context to file")

    pdeps = proj_sub.add_parser("dependencies", help="Show project dependencies")
    pdeps.add_argument("slug", help="Project slug or ID")

    # ── proposal ──
    prop_p = sub.add_parser("proposal", help="Proposal lifecycle")
    prop_sub = prop_p.add_subparsers(dest="action", metavar="ACTION")

    prop_list = prop_sub.add_parser("list", help="List proposals")
    prop_list.add_argument("--status", "-s", help="Filter by status")
    prop_list.add_argument("--project", "-p", help="Filter by project")
    prop_list.add_argument("--limit", "-n", type=int, help="Max results")

    prop_view = prop_sub.add_parser("view", help="View a proposal")
    prop_view.add_argument("proposal_id", help="Proposal ID")

    prop_dispatch = prop_sub.add_parser("dispatch", help="Approve and dispatch proposal")
    prop_dispatch.add_argument("proposal_id", help="Proposal ID")
    prop_dispatch.add_argument("--agent", "-a", help="Target agent")

    # ── vault ──
    vault_p = sub.add_parser("vault", help="Vault search and context")
    vault_sub = vault_p.add_subparsers(dest="action", metavar="ACTION")

    vs = vault_sub.add_parser("search", help="Search the vault")
    vs.add_argument("query", help="Search query")
    vs.add_argument("--mode", choices=["keyword","semantic","hybrid"], help="Search mode")
    vs.add_argument("--type", help="Filter by type")
    vs.add_argument("--after", help="Only after date (ISO8601)")
    vs.add_argument("--limit", "-n", type=int, help="Max results")

    # ── dispatch ──
    disp_p = sub.add_parser("dispatch", help="Execution visibility")
    disp_sub = disp_p.add_subparsers(dest="action", metavar="ACTION")

    disp_status = disp_sub.add_parser("status", help="Show execution status")
    disp_status.add_argument("--limit", "-n", type=int, help="Max results")

    disp_logs = disp_sub.add_parser("logs", help="Show execution logs")
    disp_logs.add_argument("execution_id", help="Execution ID")

    # ── sync ──
    sync_p = sub.add_parser("sync", help="External service sync")
    sync_sub = sync_p.add_subparsers(dest="action", metavar="ACTION")
    sync_sub.add_parser("openclaw", help="Check OpenClaw sync status")

    # ── status ──
    sub.add_parser("status", help="System health overview")

    return p


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    global USE_JSON, QUIET

    parser = build_parser()
    args = parser.parse_args()

    USE_JSON = args.json if hasattr(args, "json") else False
    QUIET = args.quiet if hasattr(args, "quiet") else False

    # Resolve host
    host = (args.host if hasattr(args, "host") and args.host
            else CONFIG.get("host")
            or os.environ.get("EMA_HOST")
            or DEFAULT_HOST)

    verbose = args.verbose if hasattr(args, "verbose") else False
    client = EMAClient(host, verbose=verbose)

    if not args.group:
        parser.print_help()
        sys.exit(0)

    # ── Route ──
    if args.group == "status":
        cmd_status(client, args)

    elif args.group == "task":
        if not args.action:
            parser.parse_args(["task", "--help"])
        elif args.action == "create":
            cmd_task_create(client, args)
        elif args.action == "list":
            cmd_task_list(client, args)
        elif args.action == "get":
            cmd_task_get(client, args)
        elif args.action == "dispatch":
            cmd_task_dispatch(client, args)
        elif args.action == "status":
            cmd_task_status(client, args)

    elif args.group == "project":
        if not args.action:
            parser.parse_args(["project", "--help"])
        elif args.action == "create":
            cmd_project_create(client, args)
        elif args.action == "list":
            cmd_project_list(client, args)
        elif args.action == "view":
            cmd_project_view(client, args)
        elif args.action == "context":
            cmd_project_context(client, args)
        elif args.action == "dependencies":
            cmd_project_deps(client, args)

    elif args.group == "proposal":
        if not args.action:
            parser.parse_args(["proposal", "--help"])
        elif args.action == "list":
            cmd_proposal_list(client, args)
        elif args.action == "view":
            cmd_proposal_view(client, args)
        elif args.action == "dispatch":
            cmd_proposal_dispatch(client, args)

    elif args.group == "vault":
        if not args.action:
            parser.parse_args(["vault", "--help"])
        elif args.action == "search":
            cmd_vault_search(client, args)

    elif args.group == "dispatch":
        if not args.action:
            parser.parse_args(["dispatch", "--help"])
        elif args.action == "status":
            cmd_dispatch_status(client, args)
        elif args.action == "logs":
            cmd_dispatch_logs(client, args)

    elif args.group == "sync":
        if not args.action:
            parser.parse_args(["sync", "--help"])
        elif args.action == "openclaw":
            cmd_sync_openclaw(client, args)


if __name__ == "__main__":
    main()
