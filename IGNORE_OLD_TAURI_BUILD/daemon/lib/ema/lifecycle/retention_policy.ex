defmodule Ema.Lifecycle.RetentionPolicy do
  @moduledoc """
  Retention policies for EMA entities.

  Each entity type maps to a set of status-based retention periods (in days).
  `:never` means the status is exempt from archival.
  """

  import Ecto.Query
  alias Ema.Repo

  @type days :: pos_integer()
  @type retention :: days() | :never

  @policies %{
    inbox_items: %{
      schema: Ema.BrainDump.Item,
      rules: %{
        processed: 30,
        unprocessed: :never
      },
      status_field: :processed,
      status_map: %{processed: true, unprocessed: false}
    },
    proposals: %{
      schema: Ema.Proposals.Proposal,
      rules: %{
        "killed" => 90,
        "completed" => 180,
        "approved" => 180,
        "queued" => :never,
        "generating" => :never,
        "refining" => :never,
        "debating" => :never
      },
      status_field: :status
    },
    executions: %{
      schema: Ema.Executions.Execution,
      rules: %{
        "completed" => 180,
        "failed" => 90,
        "cancelled" => 30,
        "created" => :never,
        "running" => :never,
        "pending_approval" => :never
      },
      status_field: :status
    },
    agent_messages: %{
      schema: Ema.Agents.Message,
      rules: %{all: 60},
      status_field: :all
    },
    pipe_runs: %{
      schema: Ema.Pipes.PipeRun,
      rules: %{all: 90},
      status_field: :all
    },
    phase_transitions: %{
      schema: Ema.Actors.PhaseTransition,
      rules: %{all: 365},
      status_field: :all
    },
    claude_sessions: %{
      schema: Ema.ClaudeSessions.ClaudeSession,
      rules: %{
        "completed" => 90,
        "active" => :never
      },
      status_field: :status
    }
  }

  @doc "Return the full policy map for an entity type."
  @spec policy_for(atom()) :: map() | nil
  def policy_for(entity_type), do: Map.get(@policies, entity_type)

  @doc "Return all configured entity types."
  @spec entity_types() :: [atom()]
  def entity_types, do: Map.keys(@policies)

  @doc """
  Query records eligible for archival for the given entity type.
  Returns `{:ok, records}` or `{:error, reason}`.
  """
  @spec eligible_for_archive(atom()) :: {:ok, [struct()]} | {:error, term()}
  def eligible_for_archive(entity_type) do
    case Map.get(@policies, entity_type) do
      nil ->
        {:error, :unknown_entity_type}

      policy ->
        records = query_eligible(policy)
        {:ok, records}
    end
  end

  @doc """
  Count records eligible for archival per entity type.
  Returns a map of `%{entity_type => count}`.
  """
  @spec eligible_counts() :: %{atom() => non_neg_integer()}
  def eligible_counts do
    Map.new(@policies, fn {entity_type, policy} ->
      count = policy |> query_eligible() |> length()
      {entity_type, count}
    end)
  end

  # --- Private ---

  defp query_eligible(%{status_field: :all, schema: schema, rules: %{all: days}}) do
    cutoff = DateTime.utc_now() |> DateTime.add(-days * 86_400, :second)

    schema
    |> where([r], r.inserted_at < ^cutoff)
    |> Repo.all()
  end

  defp query_eligible(%{status_field: :processed, schema: schema, rules: rules, status_map: status_map}) do
    Enum.flat_map(rules, fn
      {_status, :never} ->
        []

      {status, days} ->
        cutoff = DateTime.utc_now() |> DateTime.add(-days * 86_400, :second)
        field_val = Map.fetch!(status_map, status)

        schema
        |> where([r], r.processed == ^field_val and r.inserted_at < ^cutoff)
        |> Repo.all()
    end)
  end

  defp query_eligible(%{status_field: :status, schema: schema, rules: rules}) do
    Enum.flat_map(rules, fn
      {_status, :never} ->
        []

      {status, days} ->
        cutoff = DateTime.utc_now() |> DateTime.add(-days * 86_400, :second)

        schema
        |> where([r], r.status == ^status and r.inserted_at < ^cutoff)
        |> Repo.all()
    end)
  end
end
