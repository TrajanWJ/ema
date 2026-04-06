defmodule Ema.Intents.Populator do
  @moduledoc """
  Subscribes to PubSub events and auto-creates intents from domain events.

  Listens to:
  - brain_dump:item_created → level 4-5 task intent
  - executions:completed → updates linked intent phase/status
  - goals:created → level 1 goal intent
  """

  use GenServer
  require Logger

  alias Ema.Intents

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    Phoenix.PubSub.subscribe(Ema.PubSub, "brain_dump")
    Phoenix.PubSub.subscribe(Ema.PubSub, "executions")
    Phoenix.PubSub.subscribe(Ema.PubSub, "goals")
    {:ok, %{}}
  end

  # ── Brain Dump → Intent ──────────────────────────────────────────

  @impl true
  def handle_info({:brain_dump, :item_created, item}, state) do
    handle_brain_dump(item)
    {:noreply, state}
  end

  # ── Execution Completed → Update Intent ──────────────────────────

  def handle_info({:executions, :completed, execution}, state) do
    handle_execution_completed(execution)
    {:noreply, state}
  end

  # ── Goal Created → Intent ────────────────────────────────────────

  def handle_info({:goals, :created, goal}, state) do
    handle_goal_created(goal)
    {:noreply, state}
  end

  # Catch-all for other messages on subscribed topics
  def handle_info(_msg, state), do: {:noreply, state}

  # ── Handlers ─────────────────────────────────────────────────────

  defp handle_brain_dump(item) do
    title = String.slice(item.content || "", 0, 120)

    attrs = %{
      title: title,
      level: 4,
      kind: "task",
      source_type: "brain_dump",
      provenance_class: "medium",
      status: "planned",
      project_id: item.project_id
    }

    case Intents.create_intent(attrs) do
      {:ok, intent} ->
        Intents.link_intent(intent.id, "brain_dump", item.id,
          role: "origin",
          provenance: "execution"
        )

        Logger.debug("[Populator] Created intent #{intent.id} from brain_dump #{item.id}")

      {:error, reason} ->
        Logger.warning("[Populator] Failed to create intent from brain_dump: #{inspect(reason)}")
    end
  end

  defp handle_execution_completed(execution) do
    case find_intent_for_execution(execution.id) do
      nil ->
        Logger.debug("[Populator] No intent linked to execution #{execution.id}")

      intent ->
        new_phase = min(intent.phase + 1, 5)
        new_status = if execution.status == "completed", do: "active", else: intent.status

        case Intents.update_intent(intent, %{phase: new_phase, status: new_status}) do
          {:ok, _updated} ->
            Logger.debug("[Populator] Updated intent #{intent.id} from execution #{execution.id}")

          {:error, reason} ->
            Logger.warning("[Populator] Failed to update intent: #{inspect(reason)}")
        end
    end
  end

  defp handle_goal_created(goal) do
    attrs = %{
      title: goal.title,
      level: 1,
      kind: "goal",
      source_type: "goal",
      provenance_class: "high",
      status: "planned",
      project_id: goal.project_id
    }

    case Intents.create_intent(attrs) do
      {:ok, intent} ->
        Intents.link_intent(intent.id, "goal", goal.id,
          role: "origin",
          provenance: "execution"
        )

        Logger.debug("[Populator] Created intent #{intent.id} from goal #{goal.id}")

      {:error, reason} ->
        Logger.warning("[Populator] Failed to create intent from goal: #{inspect(reason)}")
    end
  end

  defp find_intent_for_execution(execution_id) do
    import Ecto.Query

    case Ema.Repo.one(
           from l in Ema.Intents.IntentLink,
             where: l.linkable_type == "execution" and l.linkable_id == ^execution_id,
             select: l.intent_id,
             limit: 1
         ) do
      nil -> nil
      intent_id -> Intents.get_intent(intent_id)
    end
  end
end
