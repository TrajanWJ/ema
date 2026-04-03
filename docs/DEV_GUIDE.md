# EMA — Developer Guide

How to extend EMA: add new features, modify existing ones, and keep the codebase clean.

---

## Architecture Quick Reference

```
Request lifecycle:
  Browser / Tauri → Vite proxy → Phoenix Endpoint → Router → Controller
                 ↕ WebSocket   → UserSocket → Channel → PubSub broadcast

Data flow:
  Frontend store → loadViaRest() on mount  → GET /api/xxx
                → connect() after load     → join channel "xxx:lobby"
                ← channel push on change   ← PubSub.broadcast on mutation
```

**Rule:** Every feature has exactly one Phoenix context module (`Ema.FeatureName`), one controller (`EmaWeb.FeatureNameController`), one channel (`EmaWeb.FeatureNameChannel`), one store (`app/src/stores/feature-name-store.ts`), and one component directory (`app/src/components/feature-name/`).

---

## Adding a New Feature

### 1. Generate the context + schema

```bash
cd daemon
mix phx.gen.context MyFeature Item my_feature_items \
  name:string \
  content:text \
  status:string \
  inserted_at:utc_datetime
```

This creates:
- `lib/ema/my_feature.ex` — context with CRUD functions
- `lib/ema/my_feature/item.ex` — Ecto schema
- `priv/repo/migrations/xxxxx_create_my_feature_items.exs`
- `test/ema/my_feature_test.exs`

### 2. Edit the schema

Add ID prefix, set defaults:
```elixir
defmodule Ema.MyFeature.Item do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}

  schema "my_feature_items" do
    field :name, :string
    field :content, :string
    field :status, :string, default: "active"
    timestamps(type: :utc_datetime)
  end

  def changeset(item, attrs) do
    item
    |> cast(attrs, [:name, :content, :status])
    |> validate_required([:name])
    |> put_id()
  end

  defp put_id(changeset) do
    if get_field(changeset, :id) do
      changeset
    else
      id = "mf_" <> (:crypto.strong_rand_bytes(6) |> Base.encode16(case: :lower))
      put_change(changeset, :id, id)
    end
  end
end
```

### 3. Add the HTTP controller

Create `lib/ema_web/controllers/my_feature_controller.ex`:
```elixir
defmodule EmaWeb.MyFeatureController do
  use EmaWeb, :controller
  alias Ema.MyFeature

  def index(conn, _params) do
    items = MyFeature.list_items()
    json(conn, %{data: items})
  end

  def show(conn, %{"id" => id}) do
    case MyFeature.get_item(id) do
      nil -> conn |> put_status(404) |> json(%{error: "not found"})
      item -> json(conn, %{data: item})
    end
  end

  def create(conn, params) do
    case MyFeature.create_item(params) do
      {:ok, item} -> conn |> put_status(201) |> json(%{data: item})
      {:error, cs} -> conn |> put_status(422) |> json(%{errors: errors(cs)})
    end
  end

  def update(conn, %{"id" => id} = params) do
    case MyFeature.get_item(id) do
      nil -> conn |> put_status(404) |> json(%{error: "not found"})
      item ->
        case MyFeature.update_item(item, params) do
          {:ok, updated} -> json(conn, %{data: updated})
          {:error, cs} -> conn |> put_status(422) |> json(%{errors: errors(cs)})
        end
    end
  end

  def delete(conn, %{"id" => id}) do
    case MyFeature.get_item(id) do
      nil -> conn |> put_status(404) |> json(%{error: "not found"})
      item ->
        {:ok, _} = MyFeature.delete_item(item)
        send_resp(conn, 204, "")
    end
  end

  defp errors(cs), do: Ecto.Changeset.traverse_errors(cs, &elem(&1, 0))
end
```

### 4. Wire the router

In `lib/ema_web/router.ex`, add inside the API scope:
```elixir
resources "/my_feature/items", MyFeatureController, except: [:new, :edit]
```

### 5. Add the Zustand store

Create `app/src/stores/my-feature-store.ts`:
```typescript
import { create } from 'zustand'
import { api } from '../lib/api'

export interface MyFeatureItem {
  id: string
  name: string
  content: string | null
  status: string
  inserted_at: string
}

interface MyFeatureState {
  items: MyFeatureItem[]
  loading: boolean
  error: string | null
  load: () => Promise<void>
  create: (attrs: Partial<MyFeatureItem>) => Promise<MyFeatureItem>
  update: (id: string, attrs: Partial<MyFeatureItem>) => Promise<MyFeatureItem>
  remove: (id: string) => Promise<void>
}

export const useMyFeatureStore = create<MyFeatureState>((set, get) => ({
  items: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null })
    try {
      const res = await api.get('/my_feature/items')
      set({ items: res.data, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  create: async (attrs) => {
    const res = await api.post('/my_feature/items', attrs)
    set(s => ({ items: [res.data, ...s.items] }))
    return res.data
  },

  update: async (id, attrs) => {
    const res = await api.patch(`/my_feature/items/${id}`, attrs)
    set(s => ({ items: s.items.map(i => i.id === id ? res.data : i) }))
    return res.data
  },

  remove: async (id) => {
    await api.delete(`/my_feature/items/${id}`)
    set(s => ({ items: s.items.filter(i => i.id !== id) }))
  },
}))
```

### 6. Add the test

In `daemon/test/ema/my_feature_test.exs`:
```elixir
defmodule Ema.MyFeatureTest do
  use Ema.DataCase, async: false
  alias Ema.MyFeature

  describe "create_item/1" do
    test "creates with valid attrs" do
      assert {:ok, item} = MyFeature.create_item(%{name: "Test"})
      assert item.name == "Test"
      assert String.starts_with?(item.id, "mf_")
    end

    test "fails without name" do
      assert {:error, cs} = MyFeature.create_item(%{})
      assert %{name: ["can't be blank"]} = errors_on(cs)
    end
  end
end
```

---

## Modifying an Existing Feature

1. Read the existing context module first (`lib/ema/feature_name.ex`)
2. Read the schema (`lib/ema/feature_name/schema.ex`)
3. Check the existing tests (`test/ema/feature_name_test.exs`)
4. Add migration if changing DB (never modify existing migrations)
5. Update tests to cover new behavior
6. Run `mix precommit` before committing

---

## ID Conventions

All EMA IDs use a prefix for readability:

| Context | Prefix |
|---|---|
| BrainDump.Item | `bd_` |
| Tasks.Task | `tk_` |
| Projects.Project | derived from slug |
| Proposals.Proposal | `prop_` |
| Habits.Habit | `hb_` |
| Journal.Entry | `je_` |
| Canvas.Canvas | `cv_` |
| Notes.Note | `nt_` |

When adding a new schema, pick a short prefix and document it here.

---

## WebSocket Channels

Every feature that needs real-time updates gets a Phoenix channel.

Pattern: frontend joins `"feature_name:lobby"`, daemon broadcasts on mutations.

```elixir
# In context module, after mutations:
Phoenix.PubSub.broadcast(Ema.PubSub, "my_feature:lobby", {
  :item_created,
  %{id: item.id, data: item}
})
```

```typescript
// In store, subscribe to channel:
socket.channel("my_feature:lobby").on("item_created", (msg) => {
  set(s => ({ items: [msg.data, ...s.items] }))
})
```

---

## Common Patterns

### Background jobs (GenServer)
Use `Ema.TaskSupervisor` for one-off tasks:
```elixir
Task.Supervisor.start_child(Ema.TaskSupervisor, fn ->
  # run some async work
end)
```

For recurring jobs, add a GenServer under `Ema.Application`'s supervision tree.

### Settings / Feature flags
```elixir
Ema.Settings.get("key", "default")
Ema.Settings.set("key", "value")
Ema.Settings.feature?("feature.name")  # returns boolean
```

### Querying with filters
```elixir
import Ecto.Query

def list_active_items do
  from(i in Item, where: i.status == "active", order_by: [desc: i.inserted_at])
  |> Repo.all()
end
```

---

## Style Guide

- **Elixir:** Follow `mix format`. No bare `Repo.all(Schema)` in controllers — go through context.
- **TypeScript:** Prefer `const` over `let`. No `any` except at API boundaries. One store per feature.
- **Tests:** No `describe "context module"` wrapping everything — describe the function, e.g., `describe "create_item/1"`.
- **Commits:** `feat(feature): what it does` / `fix(feature): what was wrong` / `test(feature): what's covered`

---

## Useful IEx Commands

```elixir
# Count items in any table
Ema.Repo.aggregate(Ema.BrainDump.Item, :count)

# Inspect a specific record
Ema.Repo.get(Ema.Tasks.Task, "tk_abc123")

# Run seeds again
Code.eval_file("priv/repo/seeds.exs")

# Check pubsub subscribers
Phoenix.PubSub.list_topics(Ema.PubSub)

# Inspect a GenServer state
:sys.get_state(Ema.Intelligence.TokenTracker)
```
