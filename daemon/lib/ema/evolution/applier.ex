defmodule Ema.Evolution.Applier do
  @moduledoc """
  Applies approved evolution proposals to versioned config.
  Handles activation of rules, versioning with diffs, and rollback support.
  Subscribes to proposal approval events to auto-activate evolution rules.
  """

  use GenServer

  require Logger

  alias Ema.Evolution

  # --- Client API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc """
  Manually apply a rule by ID — sets it to active and creates a new version
  if there was a previous active rule with the same source.
  """
  def apply_rule(rule_id) do
    GenServer.call(__MODULE__, {:apply_rule, rule_id})
  end

  @doc """
  Roll back a rule by ID — deactivates it and reactivates the previous version.
  """
  def rollback_rule(rule_id) do
    GenServer.call(__MODULE__, {:rollback_rule, rule_id})
  end

  @doc """
  Apply a rule with a new version, linking it to the previous active rule.
  """
  def apply_rule_version(rule_id, new_content) do
    GenServer.call(__MODULE__, {:apply_version, rule_id, new_content})
  end

  # --- Server ---

  @impl true
  def init(_opts) do
    Phoenix.PubSub.subscribe(Ema.PubSub, "proposals:events")
    {:ok, %{total_applied: 0, total_rolled_back: 0}}
  end

  @impl true
  def handle_call({:apply_rule, rule_id}, _from, state) do
    result = do_apply_rule(rule_id)

    state =
      case result do
        {:ok, _} -> %{state | total_applied: state.total_applied + 1}
        _ -> state
      end

    {:reply, result, state}
  end

  @impl true
  def handle_call({:rollback_rule, rule_id}, _from, state) do
    result = Evolution.rollback_rule(rule_id)

    state =
      case result do
        {:ok, _} -> %{state | total_rolled_back: state.total_rolled_back + 1}
        _ -> state
      end

    {:reply, result, state}
  end

  @impl true
  def handle_call({:apply_version, rule_id, new_content}, _from, state) do
    result = do_apply_version(rule_id, new_content)

    state =
      case result do
        {:ok, _} -> %{state | total_applied: state.total_applied + 1}
        _ -> state
      end

    {:reply, result, state}
  end

  # Auto-activate evolution rules when their proposal is approved
  @impl true
  def handle_info({"proposal_approved", proposal}, state) do
    # Check if this proposal has a linked evolution rule
    rules =
      Evolution.list_rules(status: "proposed")
      |> Enum.filter(&(&1.proposal_id == proposal.id))

    state =
      Enum.reduce(rules, state, fn rule, acc ->
        case do_apply_rule(rule.id) do
          {:ok, _} ->
            Logger.info("Applier: auto-activated rule #{rule.id} from approved proposal #{proposal.id}")
            %{acc | total_applied: acc.total_applied + 1}

          {:error, reason} ->
            Logger.warning("Applier: failed to auto-activate rule #{rule.id}: #{inspect(reason)}")
            acc
        end
      end)

    {:noreply, state}
  end

  def handle_info(_msg, state), do: {:noreply, state}

  # --- Private ---

  defp do_apply_rule(rule_id) do
    case Evolution.get_rule(rule_id) do
      nil ->
        {:error, :not_found}

      rule ->
        # Deactivate any existing active rule from the same source
        Evolution.list_rules(status: "active", source: rule.source)
        |> Enum.each(fn active_rule ->
          if active_rule.id != rule.id do
            Evolution.update_rule(active_rule, %{status: "rolled_back"})
          end
        end)

        Evolution.update_rule(rule, %{status: "active"})
    end
  end

  defp do_apply_version(rule_id, new_content) do
    case Evolution.get_rule(rule_id) do
      nil ->
        {:error, :not_found}

      current_rule ->
        diff = compute_diff(current_rule.content, new_content)

        # Mark current as rolled back
        Evolution.update_rule(current_rule, %{status: "rolled_back"})

        # Create new version
        Evolution.create_rule(%{
          source: current_rule.source,
          content: new_content,
          status: "active",
          version: current_rule.version + 1,
          diff: diff,
          previous_rule_id: current_rule.id,
          signal_metadata: current_rule.signal_metadata
        })
    end
  end

  defp compute_diff(old_content, new_content) do
    old_lines = String.split(old_content, "\n")
    new_lines = String.split(new_content, "\n")

    removed =
      (old_lines -- new_lines)
      |> Enum.map(&"- #{&1}")

    added =
      (new_lines -- old_lines)
      |> Enum.map(&"+ #{&1}")

    Enum.join(removed ++ added, "\n")
  end
end
