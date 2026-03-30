defmodule Ema.Pipes.Loader do
  @moduledoc """
  On first boot (no pipes in DB), seeds all default/system pipes from the spec.
  Watches for pipe changes and notifies the Executor to reconfigure.
  """

  use GenServer
  require Logger

  alias Ema.Pipes

  # --- Client API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  # --- Server ---

  @impl true
  def init(_opts) do
    send(self(), :seed_if_empty)
    {:ok, %{}}
  end

  @impl true
  def handle_info(:seed_if_empty, state) do
    if Pipes.pipe_count() == 0 do
      Logger.info("Pipes Loader: no pipes found, seeding stock pipes")
      seed_stock_pipes()
    else
      Logger.info("Pipes Loader: #{Pipes.pipe_count()} pipes already in DB, skipping seed")
    end

    {:noreply, state}
  end

  def handle_info(_msg, state) do
    {:noreply, state}
  end

  # --- Stock Pipe Definitions ---

  defp seed_stock_pipes do
    stock_pipes()
    |> Enum.each(fn pipe_def ->
      case create_pipe_with_children(pipe_def) do
        {:ok, pipe} ->
          Logger.debug("Seeded pipe: #{pipe.name}")

        {:error, reason} ->
          Logger.warning("Failed to seed pipe #{pipe_def.name}: #{inspect(reason)}")
      end
    end)

    # Notify executor to reload
    Phoenix.PubSub.broadcast(Ema.PubSub, "pipes:config", :pipes_changed)
  end

  defp create_pipe_with_children(pipe_def) do
    Ema.Repo.transaction(fn ->
      {:ok, pipe} =
        Pipes.create_pipe(%{
          name: pipe_def.name,
          system: true,
          active: Map.get(pipe_def, :active, true),
          trigger_pattern: pipe_def.trigger_pattern,
          description: Map.get(pipe_def, :description),
          metadata: Map.get(pipe_def, :metadata, %{})
        })

      pipe_def
      |> Map.get(:actions, [])
      |> Enum.with_index()
      |> Enum.each(fn {action, idx} ->
        {:ok, _} =
          Pipes.add_action(pipe, %{
            action_id: action.action_id,
            config: Map.get(action, :config, %{}),
            sort_order: idx
          })
      end)

      pipe_def
      |> Map.get(:transforms, [])
      |> Enum.with_index()
      |> Enum.each(fn {transform, idx} ->
        {:ok, _} =
          Pipes.add_transform(pipe, %{
            transform_type: transform.type,
            config: Map.get(transform, :config, %{}),
            sort_order: idx
          })
      end)

      pipe
    end)
  end

  defp stock_pipes do
    [
      # --- Approval Consequences ---
      %{
        name: "Approved Proposal -> Task",
        trigger_pattern: "proposals:approved",
        description: "When a proposal is approved, create a task and a spec note",
        actions: [
          %{action_id: "tasks:create", config: %{"from_proposal" => true}},
          %{action_id: "vault:create_note", config: %{"space" => "projects", "type" => "spec"}}
        ]
      },

      # --- Responsibility Task Generation ---
      %{
        name: "Responsibility Task Generation",
        trigger_pattern: "system:daily",
        description: "Generate tasks from due responsibilities each day",
        actions: [
          %{action_id: "responsibilities:generate_due_tasks"}
        ]
      },

      # --- New Project Bootstrap ---
      %{
        name: "New Project -> Bootstrap Vault Space",
        trigger_pattern: "projects:created",
        description: "Create vault directory structure for a new project",
        actions: [
          %{action_id: "vault:create_project_space"}
        ]
      },

      # --- Habit Streak ---
      %{
        name: "Habit Streak Celebration",
        trigger_pattern: "habits:streak_milestone",
        description: "Notify and log when a habit streak milestone is hit",
        actions: [
          %{action_id: "notify:desktop", config: %{"template" => "streak"}},
          %{action_id: "vault:create_note", config: %{"space" => "system", "type" => "milestone"}}
        ]
      },

      # --- Project Context Auto-Rebuild ---
      %{
        name: "Project Context Auto-Rebuild",
        trigger_pattern: "tasks:status_changed",
        description: "Rebuild project context after task status changes (debounced)",
        transforms: [
          %{type: "delay", config: %{"ms" => 5000}}
        ],
        actions: [
          %{action_id: "projects:rebuild_context"}
        ]
      },

      # --- Brain Dump Pattern Harvesting ---
      %{
        name: "Brain Dump -> Harvest Patterns",
        trigger_pattern: "brain_dump:item_created",
        description: "After accumulating brain dump items, create seed from cluster",
        transforms: [
          %{type: "filter", config: %{"accumulate" => 5}}
        ],
        actions: [
          %{action_id: "proposals:create_seed", config: %{"type" => "brain_dump_cluster"}}
        ]
      },

      # --- Daily Digest ---
      %{
        name: "Daily Digest Generation",
        trigger_pattern: "system:daily",
        description: "Generate daily vault digest",
        actions: [
          %{action_id: "vault:create_note", config: %{"space" => "system", "type" => "digest"}}
        ]
      }
    ]
  end
end
