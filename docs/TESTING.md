# EMA — Testing Guide

## Philosophy

- **Unit tests** live in `daemon/test/ema/` — test one context module in isolation
- **Controller tests** live in `daemon/test/ema_web/controllers/` — test HTTP layer
- **Channel tests** (add to `daemon/test/ema_web/channels/`) — test WebSocket events
- **No test** should talk to external services (Claude, OpenClaw, etc.) — mock them

---

## Running Tests

```bash
cd daemon

# All tests
mix test

# Single file
mix test test/ema/brain_dump_test.exs

# Single test by name (partial match)
mix test test/ema/tasks_test.exs --only "creates a task"

# Watch mode (rerun on file save)
mix test.watch   # requires mix_test_watch dep

# With verbose output
mix test --trace

# Full pre-commit suite (compile + lint + format + test)
mix precommit
```

---

## Test Structure

### DataCase — for context/business logic tests

```elixir
defmodule Ema.SomeContextTest do
  use Ema.DataCase, async: false   # async: false required for SQLite

  alias Ema.SomeContext

  describe "create_thing/1" do
    test "creates with valid attrs" do
      assert {:ok, thing} = SomeContext.create_thing(%{name: "Test"})
      assert thing.name == "Test"
    end

    test "fails without required fields" do
      assert {:error, changeset} = SomeContext.create_thing(%{})
      assert %{name: ["can't be blank"]} = errors_on(changeset)
    end
  end
end
```

### ConnCase — for HTTP controller tests

```elixir
defmodule EmaWeb.SomeControllerTest do
  use EmaWeb.ConnCase, async: false

  describe "GET /api/things" do
    test "returns empty list", %{conn: conn} do
      conn = get(conn, ~p"/api/things")
      assert %{"data" => []} = json_response(conn, 200)
    end

    test "returns created thing", %{conn: conn} do
      {:ok, thing} = Ema.SomeContext.create_thing(%{name: "Test"})
      conn = get(conn, ~p"/api/things")
      assert %{"data" => [%{"id" => id}]} = json_response(conn, 200)
      assert id == thing.id
    end
  end

  describe "POST /api/things" do
    test "creates a thing", %{conn: conn} do
      conn = post(conn, ~p"/api/things", %{name: "New"})
      assert %{"data" => %{"id" => id}} = json_response(conn, 201)
      assert String.starts_with?(id, "th_")
    end

    test "returns 422 on invalid data", %{conn: conn} do
      conn = post(conn, ~p"/api/things", %{})
      assert %{"errors" => _} = json_response(conn, 422)
    end
  end
end
```

---

## Factories & Fixtures

Common factory helpers belong in `test/support/data_case.ex` (extend `Ema.DataCase`) or a dedicated `test/support/factory.ex`:

```elixir
# test/support/factory.ex
defmodule Ema.Factory do
  alias Ema.Repo

  def build(:task, attrs \\ %{}) do
    %{
      title: "Test task #{System.unique_integer([:positive])}",
      status: "inbox",
      priority: "medium"
    }
    |> Map.merge(attrs)
  end

  def insert!(schema, attrs \\ %{}) do
    schema
    |> build(attrs)
    |> then(&apply(schema_context(schema), :create!, [&1]))
  end

  def task(attrs \\ %{}), do: build(:task, attrs)
  def project(attrs \\ %{}), do: build(:project, attrs)
  def habit(attrs \\ %{}), do: build(:habit, attrs)
end
```

Usage:
```elixir
import Ema.Factory

test "lists only active tasks" do
  task_a = Repo.insert!(Ema.Tasks.Task.changeset(%Ema.Tasks.Task{}, task(%{status: "active"})))
  _done  = Repo.insert!(Ema.Tasks.Task.changeset(%Ema.Tasks.Task{}, task(%{status: "done"})))

  assert [%{id: id}] = Ema.Tasks.list_active()
  assert id == task_a.id
end
```

---

## Mocking External Services

### Claude / AI Runners

The `Ema.Claude.Runner` accepts a `cmd_fn` option for test injection:

```elixir
test "run/2 returns parsed result" do
  mock_fn = fn "claude", _args, _opts ->
    {~s({"result":"Hello","is_error":false}), 0}
  end

  assert {:ok, "Hello"} = Ema.Claude.Runner.run("Hello prompt", cmd_fn: mock_fn)
end
```

### OTP Workers

Most background workers are disabled in test via `config/test.exs`:

```elixir
config :ema, pipes_workers: false
config :ema, evolution_engine: false
config :ema, start_canvas: false
# etc.
```

For tests that need them, start manually:

```elixir
setup do
  start_supervised!(Ema.SomeWorker)
  :ok
end
```

---

## What to Test for Each Feature

When adding a new context `Ema.NewFeature`:

| Layer | What to test |
|---|---|
| `create_*/1` | Valid attrs succeed, invalid attrs fail with correct errors |
| `list_*/0` | Returns correct subset, respects filters |
| `update_*/2` | Changes persisted, invalid changesets rejected |
| `delete_*/1` | Removes record, returns error for missing |
| Business logic | State machine transitions, derived values, side effects |
| Controller | Happy path 200/201, validation 422, not-found 404 |

---

## Coverage Goals

| Area | Target |
|---|---|
| Context modules | 80%+ line coverage |
| Controllers | All happy + error paths covered |
| Critical paths (Claude runs, Pipes) | 90%+ |
| Frontend stores | Not currently tested (future: Vitest) |

---

## Frontend Testing (Planned)

Frontend tests are not yet set up. When adding Vitest:

```bash
cd app
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom jsdom
```

Add to `package.json`:
```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
}
```

Store tests go in `src/stores/__tests__/`. Component tests go alongside their component.

---

## CI

Tests run automatically on push/PR via GitHub Actions. See `.github/workflows/ci.yml`.

Locally, `mix precommit` runs the same checks:
```
mix compile --warnings-as-errors
mix deps.unlock --unused
mix format --check-formatted
mix test
```

Run this before every push.
