# Workspace & Executive Planes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix schema mismatches, fill functional gaps, and add tests so the actor/workspace/executive-plane system is fully operational end-to-end.

**Architecture:** Most infrastructure already exists — actors, phase_transitions, entity_data, container_config, actor_commands tables + schemas + contexts + controllers + routes + Elixir CLI commands. This plan fixes broken pieces and adds what's missing.

**Tech Stack:** Elixir/Phoenix, Ecto/SQLite, ExUnit, Python 3 (CLI)

**Spec:** `docs/superpowers/specs/2026-04-06-workspace-executive-planes-design.md`

---

### Task 1: Fix Tag Schema Mismatch

Migration `20260412000008` dropped the old `tags` + `entity_tags` tables and rebuilt `tags` as a flat table with `(entity_type, entity_id, tag, actor_id, namespace)`. But `Ema.Actors.Tag` still has `(name, slug, color)` fields and the context still references `EntityTag`. This is broken — any tag operation will fail at runtime.

**Files:**
- Modify: `daemon/lib/ema/actors/tag.ex`
- Delete: `daemon/lib/ema/actors/entity_tag.ex` (if it exists)
- Modify: `daemon/lib/ema/actors/actors.ex:91-161` (tag functions)
- Modify: `daemon/lib/ema/actors/actor.ex` (has_many :tags association)
- Test: `daemon/test/ema/actors/tags_test.exs`

- [ ] **Step 1: Check if EntityTag schema file exists**

Run: `ls daemon/lib/ema/actors/entity_tag.ex 2>/dev/null && echo EXISTS || echo MISSING`

If it exists, delete it. If not, just remove the alias from actors.ex.

- [ ] **Step 2: Rewrite Tag schema to match DB**

Replace the contents of `daemon/lib/ema/actors/tag.ex`:

```elixir
defmodule Ema.Actors.Tag do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}
  @timestamps_opts [type: :utc_datetime]

  schema "tags" do
    field :entity_type, :string
    field :entity_id, :string
    field :tag, :string
    field :namespace, :string, default: "default"

    belongs_to :actor, Ema.Actors.Actor, type: :string

    timestamps()
  end

  @valid_entity_types ~w(space project task execution proposal goal brain_dump)
  @valid_namespaces ~w(default priority domain phase status custom)

  def changeset(tag, attrs) do
    tag
    |> cast(attrs, [:id, :entity_type, :entity_id, :tag, :actor_id, :namespace])
    |> validate_required([:id, :entity_type, :entity_id, :tag, :actor_id])
    |> validate_inclusion(:entity_type, @valid_entity_types)
    |> validate_inclusion(:namespace, @valid_namespaces)
    |> unique_constraint([:entity_type, :entity_id, :tag, :actor_id])
  end
end
```

- [ ] **Step 3: Remove EntityTag alias from actors.ex**

In `daemon/lib/ema/actors/actors.ex` line 11, change:

```elixir
alias Ema.Actors.{Actor, Tag, EntityTag, EntityData, ContainerConfig, PhaseTransition, ActorCommand}
```

to:

```elixir
alias Ema.Actors.{Actor, Tag, EntityData, ContainerConfig, PhaseTransition, ActorCommand}
```

- [ ] **Step 4: Rewrite tag functions in Actors context**

Replace lines 91-161 of `daemon/lib/ema/actors/actors.ex`:

```elixir
  # ── Tags ──

  def list_tags(opts \\ []) do
    Tag
    |> maybe_filter_tag_field(:entity_type, opts[:entity_type])
    |> maybe_filter_tag_field(:entity_id, opts[:entity_id])
    |> maybe_filter_tag_field(:actor_id, opts[:actor_id])
    |> maybe_filter_tag_field(:namespace, opts[:namespace])
    |> order_by([t], desc: t.inserted_at)
    |> Repo.all()
  end

  def get_tag(id), do: Repo.get(Tag, id)

  def tag_entity(entity_type, entity_id, tag_name, actor_id \\ "human", namespace \\ "default") do
    attrs = %{
      entity_type: entity_type,
      entity_id: entity_id,
      tag: tag_name,
      actor_id: actor_id,
      namespace: namespace
    }

    %Tag{id: generate_id()}
    |> Tag.changeset(attrs)
    |> Repo.insert(on_conflict: :nothing, conflict_target: [:entity_type, :entity_id, :tag, :actor_id])
  end

  def untag_entity(entity_type, entity_id, tag_name, actor_id \\ "human") do
    Tag
    |> where([t], t.entity_type == ^entity_type and t.entity_id == ^entity_id and t.tag == ^tag_name and t.actor_id == ^actor_id)
    |> Repo.delete_all()
  end

  def tags_for_entity(entity_type, entity_id) do
    Tag
    |> where([t], t.entity_type == ^entity_type and t.entity_id == ^entity_id)
    |> order_by([t], asc: t.tag)
    |> Repo.all()
  end

  defp maybe_filter_tag_field(query, _field, nil), do: query
  defp maybe_filter_tag_field(query, :entity_type, val), do: where(query, [t], t.entity_type == ^val)
  defp maybe_filter_tag_field(query, :entity_id, val), do: where(query, [t], t.entity_id == ^val)
  defp maybe_filter_tag_field(query, :actor_id, val), do: where(query, [t], t.actor_id == ^val)
  defp maybe_filter_tag_field(query, :namespace, val), do: where(query, [t], t.namespace == ^val)
```

- [ ] **Step 5: Update Actor schema has_many :tags**

In `daemon/lib/ema/actors/actor.ex`, the `has_many :tags` line should stay as-is (it references `Ema.Actors.Tag` via `:actor_id` FK, which still works).

- [ ] **Step 6: Write tag tests**

Create `daemon/test/ema/actors/tags_test.exs`:

```elixir
defmodule Ema.Actors.TagsTest do
  use Ema.DataCase, async: false
  alias Ema.Actors

  setup do
    {:ok, actor} = Actors.create_actor(%{name: "Test", slug: "test-human", actor_type: "human"})
    {:ok, actor: actor}
  end

  describe "tag_entity/5" do
    test "creates a tag on an entity", %{actor: actor} do
      assert {:ok, tag} = Actors.tag_entity("task", "task_1", "urgent", actor.id)
      assert tag.entity_type == "task"
      assert tag.entity_id == "task_1"
      assert tag.tag == "urgent"
    end

    test "is idempotent", %{actor: actor} do
      assert {:ok, _} = Actors.tag_entity("task", "task_1", "urgent", actor.id)
      assert {:ok, _} = Actors.tag_entity("task", "task_1", "urgent", actor.id)
      assert length(Actors.tags_for_entity("task", "task_1")) == 1
    end

    test "different actors can tag same entity", %{actor: actor} do
      {:ok, agent} = Actors.create_actor(%{name: "Agent", slug: "agent-a", actor_type: "agent"})
      assert {:ok, _} = Actors.tag_entity("task", "task_1", "urgent", actor.id)
      assert {:ok, _} = Actors.tag_entity("task", "task_1", "phase:execute", agent.id)
      assert length(Actors.tags_for_entity("task", "task_1")) == 2
    end
  end

  describe "untag_entity/4" do
    test "removes a tag", %{actor: actor} do
      {:ok, _} = Actors.tag_entity("task", "task_1", "urgent", actor.id)
      assert {1, _} = Actors.untag_entity("task", "task_1", "urgent", actor.id)
      assert Actors.tags_for_entity("task", "task_1") == []
    end
  end

  describe "list_tags/1" do
    test "filters by entity_type", %{actor: actor} do
      {:ok, _} = Actors.tag_entity("task", "t1", "a", actor.id)
      {:ok, _} = Actors.tag_entity("project", "p1", "b", actor.id)
      tags = Actors.list_tags(entity_type: "task")
      assert length(tags) == 1
      assert hd(tags).entity_type == "task"
    end
  end
end
```

- [ ] **Step 7: Run tests to verify**

Run: `cd daemon && mix test test/ema/actors/tags_test.exs -v`
Expected: All 4 tests pass.

- [ ] **Step 8: Commit**

```bash
cd ~/Projects/ema && git add daemon/lib/ema/actors/tag.ex daemon/lib/ema/actors/actors.ex daemon/test/ema/actors/tags_test.exs
git commit -m "fix: align Tag schema with DB, remove dead EntityTag references"
```

---

### Task 2: Fix Space Schema

`Space.changeset` requires `:org_id` (line 39) but DB allows NULL. Missing `:portable` field.

**Files:**
- Modify: `daemon/lib/ema/spaces/space.ex`
- Test: `daemon/test/ema/spaces/space_test.exs`

- [ ] **Step 1: Update Space schema**

In `daemon/lib/ema/spaces/space.ex`:

Add `portable` field after `archived_at`:

```elixir
    field :portable, :boolean, default: false
```

Change `validate_required` on line 39 from:

```elixir
    |> validate_required([:org_id, :name])
```

to:

```elixir
    |> validate_required([:name])
```

Add `:portable` to the cast list on line 28-37.

- [ ] **Step 2: Write test**

Create `daemon/test/ema/spaces/space_test.exs`:

```elixir
defmodule Ema.Spaces.SpaceTest do
  use Ema.DataCase, async: false
  alias Ema.Spaces.Space

  describe "changeset/2" do
    test "valid personal space without org_id" do
      changeset = Space.changeset(%Space{}, %{id: "sp_test", name: "Personal", space_type: "personal"})
      assert changeset.valid?
    end

    test "valid org space with org_id" do
      changeset = Space.changeset(%Space{}, %{id: "sp_test", name: "Work", org_id: "org_1", space_type: "team"})
      assert changeset.valid?
    end

    test "requires name" do
      changeset = Space.changeset(%Space{}, %{id: "sp_test"})
      refute changeset.valid?
      assert %{name: ["can't be blank"]} = errors_on(changeset)
    end

    test "accepts portable flag" do
      changeset = Space.changeset(%Space{}, %{id: "sp_test", name: "Portable", portable: true})
      assert changeset.valid?
      assert Ecto.Changeset.get_change(changeset, :portable) == true
    end
  end
end
```

- [ ] **Step 3: Run test**

Run: `cd daemon && mix test test/ema/spaces/space_test.exs -v`
Expected: All 4 pass.

- [ ] **Step 4: Commit**

```bash
cd ~/Projects/ema && git add daemon/lib/ema/spaces/space.ex daemon/test/ema/spaces/space_test.exs
git commit -m "fix: Space schema — org_id optional, add portable field"
```

---

### Task 3: Add tasks.space_id

Task schema is missing `space_id`. Every other major entity has it.

**Files:**
- Create: `daemon/priv/repo/migrations/20260413000001_add_space_id_to_tasks.exs`
- Modify: `daemon/lib/ema/tasks/task.ex`
- Test: `daemon/test/ema/tasks/tasks_space_test.exs`

- [ ] **Step 1: Create migration**

Create `daemon/priv/repo/migrations/20260413000001_add_space_id_to_tasks.exs`:

```elixir
defmodule Ema.Repo.Migrations.AddSpaceIdToTasks do
  use Ecto.Migration

  def change do
    alter table(:tasks) do
      add :space_id, references(:spaces, type: :string, on_delete: :nilify_all)
    end

    create index(:tasks, [:space_id])
  end
end
```

- [ ] **Step 2: Add space_id to Task schema**

In `daemon/lib/ema/tasks/task.ex`, add after the `belongs_to :project` line:

```elixir
    belongs_to :space, Ema.Spaces.Space, type: :string
```

Add `:space_id` to the `cast/3` field list in the `changeset/2` function.

- [ ] **Step 3: Run migration**

Run: `cd daemon && mix ecto.migrate`
Expected: Migration runs successfully.

- [ ] **Step 4: Write test**

Create `daemon/test/ema/tasks/tasks_space_test.exs`:

```elixir
defmodule Ema.Tasks.SpaceScopingTest do
  use Ema.DataCase, async: false
  alias Ema.Tasks

  test "task accepts space_id" do
    {:ok, task} = Tasks.create_task(%{title: "Test task", space_id: "sp_1"})
    assert task.space_id == "sp_1"
  end

  test "task works without space_id" do
    {:ok, task} = Tasks.create_task(%{title: "No space task"})
    assert task.space_id == nil
  end
end
```

- [ ] **Step 5: Run test**

Run: `cd daemon && mix test test/ema/tasks/tasks_space_test.exs -v`
Expected: Both pass.

- [ ] **Step 6: Commit**

```bash
cd ~/Projects/ema && git add daemon/priv/repo/migrations/20260413000001_add_space_id_to_tasks.exs daemon/lib/ema/tasks/task.ex daemon/test/ema/tasks/tasks_space_test.exs
git commit -m "feat: add space_id to tasks for workspace scoping"
```

---

### Task 4: Fix PhaseTransition Recording

`Actors.transition_phase/3` doesn't populate `space_id`, `project_id`, `week_number`, `summary`, or `transitioned_at`. The `PhaseTransition` schema expects `transitioned_at` but the function passes `inserted_at`.

**Files:**
- Modify: `daemon/lib/ema/actors/actors.ex:46-67` (transition_phase function)
- Test: `daemon/test/ema/actors/phase_transition_test.exs`

- [ ] **Step 1: Update transition_phase to accept full options**

Replace `transition_phase/3` in `daemon/lib/ema/actors/actors.ex`:

```elixir
  def transition_phase(%Actor{} = actor, new_phase, opts \\ []) do
    old_phase = actor.phase
    now = DateTime.utc_now() |> DateTime.truncate(:second)
    reason = opts[:reason]
    summary = opts[:summary]
    space_id = opts[:space_id] || actor.space_id
    project_id = opts[:project_id]
    week_number = opts[:week_number]

    Ecto.Multi.new()
    |> Ecto.Multi.update(:actor, Actor.changeset(actor, %{phase: new_phase, phase_started_at: now}))
    |> Ecto.Multi.insert(:transition, PhaseTransition.changeset(%PhaseTransition{id: generate_id()}, %{
      actor_id: actor.id,
      space_id: space_id,
      project_id: project_id,
      from_phase: old_phase,
      to_phase: new_phase,
      week_number: week_number,
      reason: reason,
      summary: summary,
      transitioned_at: now
    }))
    |> Repo.transaction()
    |> case do
      {:ok, %{actor: actor, transition: _}} ->
        broadcast("actors", {"actor:phase_changed", actor})
        {:ok, actor}
      {:error, _step, changeset, _changes} ->
        {:error, changeset}
    end
  end
```

Also update `record_phase_transition` to pass opts through:

```elixir
  def record_phase_transition(%{"actor_id" => actor_id, "to_phase" => to_phase} = params) do
    case get_actor(actor_id) do
      nil -> {:error, :not_found}
      actor ->
        transition_phase(actor, to_phase,
          reason: params["reason"],
          summary: params["summary"],
          space_id: params["space_id"],
          project_id: params["project_id"],
          week_number: params["week_number"] && String.to_integer("#{params["week_number"]}")
        )
    end
  end

  def record_phase_transition(%{actor_id: actor_id, to_phase: to_phase} = params) do
    case get_actor(actor_id) do
      nil -> {:error, :not_found}
      actor ->
        transition_phase(actor, to_phase,
          reason: Map.get(params, :reason),
          summary: Map.get(params, :summary),
          space_id: Map.get(params, :space_id),
          project_id: Map.get(params, :project_id),
          week_number: Map.get(params, :week_number)
        )
    end
  end
```

- [ ] **Step 2: Write test**

Create `daemon/test/ema/actors/phase_transition_test.exs`:

```elixir
defmodule Ema.Actors.PhaseTransitionTest do
  use Ema.DataCase, async: false
  alias Ema.Actors

  setup do
    {:ok, actor} = Actors.create_actor(%{
      name: "Agent Alpha",
      slug: "agent-alpha",
      actor_type: "agent",
      phase: "idle"
    })
    {:ok, actor: actor}
  end

  describe "transition_phase/3" do
    test "transitions phase and records transition", %{actor: actor} do
      {:ok, updated} = Actors.transition_phase(actor, "plan", reason: "sprint start", week_number: 1)
      assert updated.phase == "plan"
      assert updated.phase_started_at != nil

      [transition | _] = Actors.list_phase_transitions(actor.id)
      assert transition.from_phase == "idle"
      assert transition.to_phase == "plan"
      assert transition.reason == "sprint start"
      assert transition.week_number == 1
      assert transition.transitioned_at != nil
    end

    test "records summary and project_id", %{actor: actor} do
      {:ok, _} = Actors.transition_phase(actor, "execute",
        reason: "work_complete",
        summary: "Planned 5 tasks",
        project_id: "proj_ema"
      )

      [transition | _] = Actors.list_phase_transitions(actor.id)
      assert transition.summary == "Planned 5 tasks"
      assert transition.project_id == "proj_ema"
    end
  end

  describe "list_phase_transitions/1" do
    test "returns transitions ordered by newest first", %{actor: actor} do
      {:ok, a1} = Actors.transition_phase(actor, "plan")
      {:ok, _} = Actors.transition_phase(a1, "execute")

      transitions = Actors.list_phase_transitions(actor.id)
      assert length(transitions) == 2
      assert hd(transitions).to_phase == "execute"
    end
  end
end
```

- [ ] **Step 3: Run tests**

Run: `cd daemon && mix test test/ema/actors/phase_transition_test.exs -v`
Expected: All 3 pass.

- [ ] **Step 4: Commit**

```bash
cd ~/Projects/ema && git add daemon/lib/ema/actors/actors.ex daemon/test/ema/actors/phase_transition_test.exs
git commit -m "fix: phase transitions record space_id, project_id, week_number, summary"
```

---

### Task 5: Add EM CLI advance and retro Commands

`em.ex` has status/phases/velocity but is missing `advance` (trigger phase transition) and `retro` (show what happened in a week).

**Files:**
- Modify: `daemon/lib/ema/cli/commands/em.ex`
- Test: manual — run via `mix run -e 'Ema.CLI.Commands.Em.handle([:advance], ...)'`

- [ ] **Step 1: Add advance handler**

Add to `daemon/lib/ema/cli/commands/em.ex` before the catch-all `handle/4`:

```elixir
  def handle([:advance], parsed, transport, opts) do
    with {:ok, actor} <- resolve_actor(parsed.args.actor, transport) do
      phase = Map.get(parsed.args, :phase) || next_phase(actor)
      reason = parsed.options[:reason] || "manual"
      week = parsed.options[:week]

      case transport do
        Ema.CLI.Transport.Direct ->
          case transport.call(Ema.Actors, :transition_phase, [actor, phase, [reason: reason, week_number: week]]) do
            {:ok, updated} ->
              Output.success("#{actor_name(actor)} advanced to #{phase}")
              if opts[:json], do: Output.json(%{phase: Map.get(updated, :phase)})
            {:error, reason} ->
              Output.error(inspect(reason))
          end

        Ema.CLI.Transport.Http ->
          body = Helpers.compact_map(%{
            "actor_id" => Map.get(actor, :id) || actor["id"],
            "to_phase" => phase,
            "reason" => reason,
            "week_number" => week
          })

          case transport.post("/actors/#{Map.get(actor, :id) || actor["id"]}/transition", body) do
            {:ok, body} ->
              Output.success("Advanced to #{phase}")
              if opts[:json], do: Output.json(body)
            {:error, reason} ->
              Output.error(inspect(reason))
          end
      end
    else
      {:error, reason} -> Output.error(reason)
    end
  end

  def handle([:retro], parsed, transport, opts) do
    with {:ok, actor} <- resolve_actor(parsed.args.actor, transport),
         {:ok, transitions} <- list_phases(Map.get(actor, :id) || actor["id"], transport) do
      week = parsed.options[:week]

      filtered =
        if week do
          Enum.filter(transitions, fn t ->
            wn = Map.get(t, :week_number) || Map.get(t, "week_number")
            wn != nil and to_string(wn) == to_string(week)
          end)
        else
          transitions
        end

      if filtered == [] do
        Output.error("No transitions#{if week, do: " for week #{week}", else: ""}")
      else
        Output.render(filtered, @phase_columns, json: opts[:json])
      end
    else
      {:error, reason} -> Output.error(reason)
    end
  end
```

- [ ] **Step 2: Add helper functions**

Add private helpers at the bottom of the module:

```elixir
  @phase_order ~w(idle plan execute review retro)

  defp next_phase(actor) do
    current = Map.get(actor, :phase) || Map.get(actor, "phase") || "idle"
    idx = Enum.find_index(@phase_order, &(&1 == current)) || 0
    Enum.at(@phase_order, rem(idx + 1, length(@phase_order)))
  end

  defp actor_name(actor) do
    Map.get(actor, :name) || Map.get(actor, "name") || Map.get(actor, :id) || actor["id"]
  end
```

- [ ] **Step 3: Compile and verify**

Run: `cd daemon && mix compile --warnings-as-errors`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
cd ~/Projects/ema && git add daemon/lib/ema/cli/commands/em.ex
git commit -m "feat: add ema em advance and ema em retro CLI commands"
```

---

### Task 6: Data Backfill — Default Personal Space

Existing projects, tasks, goals, executions, and proposals need a default space. Also create the default human actor.

**Files:**
- Create: `daemon/priv/repo/migrations/20260413000002_backfill_default_space.exs`

- [ ] **Step 1: Create migration**

Create `daemon/priv/repo/migrations/20260413000002_backfill_default_space.exs`:

```elixir
defmodule Ema.Repo.Migrations.BackfillDefaultSpace do
  use Ecto.Migration

  def up do
    now = DateTime.utc_now() |> DateTime.truncate(:second) |> DateTime.to_iso8601()

    # Create default personal space
    execute("""
    INSERT OR IGNORE INTO spaces (id, name, space_type, ai_privacy, portable, settings, inserted_at, updated_at)
    VALUES ('sp_default', 'Personal', 'personal', 'isolated', 0, '{}', '#{now}', '#{now}')
    """)

    # Create default human actor
    execute("""
    INSERT OR IGNORE INTO actors (id, space_id, type, name, slug, capabilities, config, phase, status, inserted_at, updated_at)
    VALUES ('human', 'sp_default', 'human', 'Trajan', 'trajan', '[]', '{}', 'idle', 'active', '#{now}', '#{now}')
    """)

    # Backfill space_id on entities that don't have one
    execute("UPDATE projects SET space_id = 'sp_default' WHERE space_id IS NULL")
    execute("UPDATE tasks SET space_id = 'sp_default' WHERE space_id IS NULL")
    execute("UPDATE goals SET space_id = 'sp_default' WHERE space_id IS NULL")
    execute("UPDATE executions SET space_id = 'sp_default' WHERE space_id IS NULL")
    execute("UPDATE proposals SET space_id = 'sp_default' WHERE space_id IS NULL")

    # Backfill actor_id
    execute("UPDATE tasks SET actor_id = 'human' WHERE actor_id IS NULL")
    execute("UPDATE executions SET actor_id = 'human' WHERE actor_id IS NULL")

    # Backfill brain dump containers
    execute("""
    UPDATE inbox_items SET container_type = 'project', container_id = project_id
    WHERE project_id IS NOT NULL AND container_type IS NULL
    """)
    execute("""
    UPDATE inbox_items SET container_type = 'space', container_id = 'sp_default'
    WHERE container_type IS NULL
    """)
  end

  def down do
    execute("UPDATE projects SET space_id = NULL WHERE space_id = 'sp_default'")
    execute("UPDATE tasks SET space_id = NULL WHERE space_id = 'sp_default'")
    execute("UPDATE goals SET space_id = NULL WHERE space_id = 'sp_default'")
    execute("UPDATE executions SET space_id = NULL WHERE space_id = 'sp_default'")
    execute("UPDATE proposals SET space_id = NULL WHERE space_id = 'sp_default'")
    execute("DELETE FROM actors WHERE id = 'human'")
    execute("DELETE FROM spaces WHERE id = 'sp_default'")
  end
end
```

- [ ] **Step 2: Run migration**

Run: `cd daemon && mix ecto.migrate`
Expected: Migration runs, backfills existing data.

- [ ] **Step 3: Verify backfill**

Run: `cd daemon && mix run -e 'IO.inspect(Ema.Repo.one(from p in "projects", select: count(p.id), where: is_nil(p.space_id)), label: "projects without space_id")'`
Expected: `projects without space_id: 0`

- [ ] **Step 4: Commit**

```bash
cd ~/Projects/ema && git add daemon/priv/repo/migrations/20260413000002_backfill_default_space.exs
git commit -m "feat: backfill default personal space and human actor for existing data"
```

---

### Task 7: EntityData and ContainerConfig Context Tests

These contexts exist but have no tests. They delegate to `Ema.Actors` functions.

**Files:**
- Test: `daemon/test/ema/actors/entity_data_test.exs`
- Test: `daemon/test/ema/actors/container_config_test.exs`

- [ ] **Step 1: Write entity_data tests**

Create `daemon/test/ema/actors/entity_data_test.exs`:

```elixir
defmodule Ema.Actors.EntityDataTest do
  use Ema.DataCase, async: false
  alias Ema.Actors

  setup do
    {:ok, actor} = Actors.create_actor(%{name: "Test", slug: "ed-test", actor_type: "human"})
    {:ok, actor: actor}
  end

  describe "set_data/5" do
    test "creates entity data", %{actor: actor} do
      assert {:ok, data} = Actors.set_data(actor.id, "task", "task_1", "priority", "high")
      assert data.key == "priority"
    end

    test "upserts on conflict", %{actor: actor} do
      {:ok, _} = Actors.set_data(actor.id, "task", "task_1", "priority", "low")
      {:ok, updated} = Actors.set_data(actor.id, "task", "task_1", "priority", "high")
      assert updated.value == "high"
      assert length(Actors.list_data(actor.id, "task", "task_1")) == 1
    end
  end

  describe "get_data/4" do
    test "returns nil when not found", %{actor: actor} do
      assert Actors.get_data(actor.id, "task", "task_1", "missing") == nil
    end

    test "returns data when found", %{actor: actor} do
      {:ok, _} = Actors.set_data(actor.id, "task", "task_1", "cost", "5")
      result = Actors.get_data(actor.id, "task", "task_1", "cost")
      assert result.value == "5"
    end
  end

  describe "delete_data/4" do
    test "removes entity data", %{actor: actor} do
      {:ok, _} = Actors.set_data(actor.id, "project", "p1", "phase", "execute")
      assert {1, _} = Actors.delete_data(actor.id, "project", "p1", "phase")
      assert Actors.get_data(actor.id, "project", "p1", "phase") == nil
    end
  end
end
```

- [ ] **Step 2: Write container_config tests**

Create `daemon/test/ema/actors/container_config_test.exs`:

```elixir
defmodule Ema.Actors.ContainerConfigTest do
  use Ema.DataCase, async: false
  alias Ema.Actors

  describe "set_config/4" do
    test "creates config entry" do
      assert {:ok, config} = Actors.set_config("project", "proj_1", "default_tags", "[\"elixir\"]")
      assert config.key == "default_tags"
    end

    test "upserts on conflict" do
      {:ok, _} = Actors.set_config("project", "proj_1", "auto_agent", "alpha")
      {:ok, updated} = Actors.set_config("project", "proj_1", "auto_agent", "beta")
      assert updated.value == "beta"
      assert length(Actors.list_config("project", "proj_1")) == 1
    end
  end

  describe "get_config/3" do
    test "returns nil when not found" do
      assert Actors.get_config("space", "sp_1", "missing") == nil
    end

    test "returns config when found" do
      {:ok, _} = Actors.set_config("task", "t1", "criteria", "passes tests")
      result = Actors.get_config("task", "t1", "criteria")
      assert result.value == "passes tests"
    end
  end

  describe "list_config/2" do
    test "returns all config for container" do
      {:ok, _} = Actors.set_config("project", "proj_2", "key_a", "val_a")
      {:ok, _} = Actors.set_config("project", "proj_2", "key_b", "val_b")
      configs = Actors.list_config("project", "proj_2")
      assert length(configs) == 2
    end
  end
end
```

- [ ] **Step 3: Run both test files**

Run: `cd daemon && mix test test/ema/actors/entity_data_test.exs test/ema/actors/container_config_test.exs -v`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
cd ~/Projects/ema && git add daemon/test/ema/actors/entity_data_test.exs daemon/test/ema/actors/container_config_test.exs
git commit -m "test: add EntityData and ContainerConfig context tests"
```

---

### Task 8: Actor CRUD and Executive Status Tests

**Files:**
- Test: `daemon/test/ema/actors/actors_test.exs`

- [ ] **Step 1: Write actor CRUD tests**

Create `daemon/test/ema/actors/actors_test.exs`:

```elixir
defmodule Ema.ActorsTest do
  use Ema.DataCase, async: false
  alias Ema.Actors

  describe "create_actor/1" do
    test "creates a human actor" do
      {:ok, actor} = Actors.create_actor(%{name: "Trajan", slug: "trajan-test", actor_type: "human"})
      assert actor.actor_type == "human"
      assert actor.status == "active"
      assert actor.phase == "idle"
    end

    test "creates an agent actor" do
      {:ok, actor} = Actors.create_actor(%{name: "Alpha", slug: "alpha-test", actor_type: "agent"})
      assert actor.actor_type == "agent"
    end
  end

  describe "list_actors/1" do
    test "filters by type" do
      {:ok, _} = Actors.create_actor(%{name: "H", slug: "list-h", actor_type: "human"})
      {:ok, _} = Actors.create_actor(%{name: "A", slug: "list-a", actor_type: "agent"})
      humans = Actors.list_actors(type: "human")
      assert Enum.all?(humans, &(&1.actor_type == "human"))
    end
  end

  describe "update_actor/2" do
    test "updates config" do
      {:ok, actor} = Actors.create_actor(%{name: "Cfg", slug: "cfg-test", actor_type: "agent"})
      {:ok, updated} = Actors.update_actor(actor, %{config: %{"phases" => ["plan", "execute"]}})
      assert updated.config == %{"phases" => ["plan", "execute"]}
    end
  end

  describe "ensure_default_human_actor/0" do
    test "creates trajan actor if not exists" do
      {:ok, actor} = Actors.ensure_default_human_actor()
      assert actor.slug == "trajan"
      assert actor.actor_type == "human"
    end

    test "returns existing on second call" do
      {:ok, first} = Actors.ensure_default_human_actor()
      {:ok, second} = Actors.ensure_default_human_actor()
      assert first.id == second.id
    end
  end
end
```

- [ ] **Step 2: Run tests**

Run: `cd daemon && mix test test/ema/actors/actors_test.exs -v`
Expected: All pass.

- [ ] **Step 3: Commit**

```bash
cd ~/Projects/ema && git add daemon/test/ema/actors/actors_test.exs
git commit -m "test: add Actor CRUD and bootstrap tests"
```

---

### Task 9: Python CLI — Add EM and Actor Commands

The Python CLI at `scripts/ema` doesn't have the new command groups. Add `em`, `actor`, `tag`, `data`, `config` subcommands.

**Files:**
- Modify: `daemon/scripts/ema` (Python CLI, ~1969 lines)

- [ ] **Step 1: Read current CLI dispatch pattern**

Read the `main()` function and argparse setup in `scripts/ema` to understand how subcommands are wired. The pattern is: argparse subparsers → each calls `client.request()` with the right HTTP method/path.

- [ ] **Step 2: Add `em` subcommand group**

Add after existing subparser definitions:

```python
# ── Executive Management ──
em_parser = subparsers.add_parser("em", help="Executive management")
em_sub = em_parser.add_subparsers(dest="em_cmd")

em_status = em_sub.add_parser("status", help="Actor executive status")
em_status.add_argument("actor", nargs="?", help="Actor ID or slug")

em_phases = em_sub.add_parser("phases", help="Phase transition log")
em_phases.add_argument("actor", help="Actor ID or slug")

em_velocity = em_sub.add_parser("velocity", help="Sprint velocity")
em_velocity.add_argument("actor", help="Actor ID or slug")

em_advance = em_sub.add_parser("advance", help="Advance actor phase")
em_advance.add_argument("actor", help="Actor ID or slug")
em_advance.add_argument("--phase", help="Target phase (default: next in sequence)")
em_advance.add_argument("--reason", default="manual", help="Transition reason")
em_advance.add_argument("--week", type=int, help="Week number")

em_retro = em_sub.add_parser("retro", help="Retrospective for a week")
em_retro.add_argument("actor", help="Actor ID or slug")
em_retro.add_argument("--week", type=int, help="Filter by week number")
```

- [ ] **Step 3: Add em command handler**

```python
def cmd_em(client, args, opts):
    if args.em_cmd == "status":
        if args.actor:
            data = client.request("GET", f"/api/actors/{args.actor}")
            phases = client.request("GET", f"/api/actors/{args.actor}/phases")
            data["transitions"] = phases.get("phase_transitions", [])
            out_json(data) if opts.json else print_detail(data)
        else:
            data = client.request("GET", "/api/actors")
            actors = data.get("actors", data.get("data", []))
            table(actors, ["id", "name", "type", "phase", "status"])

    elif args.em_cmd == "phases":
        data = client.request("GET", f"/api/actors/{args.actor}/phases")
        rows = data.get("phase_transitions", data.get("data", []))
        table(rows, ["transitioned_at", "from_phase", "to_phase", "week_number", "reason"])

    elif args.em_cmd == "velocity":
        data = client.request("GET", f"/api/actors/{args.actor}/phases")
        rows = data.get("phase_transitions", [])
        weeks = set(r.get("week_number") for r in rows if r.get("week_number"))
        print(f"Weeks completed: {len(weeks)}")
        print(f"Total transitions: {len(rows)}")
        if weeks:
            print(f"Avg transitions/week: {len(rows) / len(weeks):.1f}")

    elif args.em_cmd == "advance":
        body = {"to_phase": args.phase or "next", "reason": args.reason}
        if args.week:
            body["week_number"] = args.week
        data = client.request("POST", f"/api/actors/{args.actor}/transition", body)
        print(f"Advanced to {data.get('phase', data.get('to_phase', '?'))}")

    elif args.em_cmd == "retro":
        data = client.request("GET", f"/api/actors/{args.actor}/phases")
        rows = data.get("phase_transitions", [])
        if args.week:
            rows = [r for r in rows if r.get("week_number") == args.week]
        table(rows, ["transitioned_at", "from_phase", "to_phase", "reason", "summary"])

    else:
        em_parser.print_help()
```

- [ ] **Step 4: Wire em command in main dispatch**

Add to the main dispatch block:

```python
elif args.command == "em":
    cmd_em(client, args, opts)
```

- [ ] **Step 5: Add actor, tag, data subcommands**

Follow the same pattern for:
- `actor list`, `actor create`, `actor get` → GET/POST `/api/actors`
- `tag add <entity_ref> <tag>`, `tag list <entity_ref>`, `tag remove` → GET/POST/DELETE entity-data style
- `data get <entity_ref> <key>`, `data set <entity_ref> <key> <value>`, `data list <entity_ref>` → GET/POST/DELETE `/api/entity-data`

(These follow the exact same patterns as existing commands like `task` and `proposal`.)

- [ ] **Step 6: Test manually**

Run: `scripts/ema em status`
Expected: Lists actors with phase and status.

Run: `scripts/ema em phases trajan`
Expected: Phase transition history (may be empty).

- [ ] **Step 7: Commit**

```bash
cd ~/Projects/ema && git add scripts/ema
git commit -m "feat: add em, actor, tag, data commands to Python CLI"
```

---

### Task 10: Controller Tests

Verify the existing controllers work end-to-end.

**Files:**
- Test: `daemon/test/ema_web/controllers/actor_controller_test.exs`

- [ ] **Step 1: Write controller tests**

Create `daemon/test/ema_web/controllers/actor_controller_test.exs`:

```elixir
defmodule EmaWeb.ActorControllerTest do
  use EmaWeb.ConnCase, async: false
  alias Ema.Actors

  setup %{conn: conn} do
    {:ok, actor} = Actors.create_actor(%{name: "Test Agent", slug: "ctrl-test", actor_type: "agent"})
    {:ok, conn: put_req_header(conn, "accept", "application/json"), actor: actor}
  end

  describe "GET /api/actors" do
    test "lists actors", %{conn: conn} do
      conn = get(conn, "/api/actors")
      assert %{"actors" => actors} = json_response(conn, 200)
      assert is_list(actors)
    end
  end

  describe "GET /api/actors/:id" do
    test "returns an actor", %{conn: conn, actor: actor} do
      conn = get(conn, "/api/actors/#{actor.id}")
      body = json_response(conn, 200)
      assert body["id"] == actor.id || body["actor"]["id"] == actor.id
    end
  end

  describe "POST /api/actors/:id/transition" do
    test "transitions phase", %{conn: conn, actor: actor} do
      conn = post(conn, "/api/actors/#{actor.id}/transition", %{to_phase: "plan", reason: "test"})
      assert json_response(conn, 200)
    end
  end

  describe "GET /api/actors/:id/phases" do
    test "returns phase transitions", %{conn: conn, actor: actor} do
      Actors.transition_phase(actor, "plan", reason: "setup")
      conn = get(conn, "/api/actors/#{actor.id}/phases")
      body = json_response(conn, 200)
      transitions = body["phase_transitions"] || body["data"] || []
      assert length(transitions) >= 1
    end
  end
end
```

- [ ] **Step 2: Run tests**

Run: `cd daemon && mix test test/ema_web/controllers/actor_controller_test.exs -v`
Expected: All pass.

- [ ] **Step 3: Commit**

```bash
cd ~/Projects/ema && git add daemon/test/ema_web/controllers/actor_controller_test.exs
git commit -m "test: add ActorController endpoint tests"
```

---

## Summary

| Task | What | Status |
|------|------|--------|
| 1 | Fix Tag schema mismatch (broken) | Critical fix |
| 2 | Fix Space schema (org_id optional + portable) | Critical fix |
| 3 | Add tasks.space_id | Migration |
| 4 | Fix PhaseTransition recording | Bug fix |
| 5 | Add EM CLI advance/retro | Feature |
| 6 | Data backfill (default space) | Migration |
| 7 | EntityData + ContainerConfig tests | Tests |
| 8 | Actor CRUD tests | Tests |
| 9 | Python CLI commands | Feature |
| 10 | Controller tests | Tests |

**Execution order:** Tasks 1-2 first (critical fixes), then 3-4 (schema + bug fix), then 6 (backfill depends on task 3), then 5 and 7-10 (features + tests, parallelizable).

**Dependencies:**
- Task 3 must run before Task 6 (backfill needs space_id column)
- Task 1 must run before Task 7 (tag tests need working schema)
- Task 4 must run before Task 8 (phase transition tests)
