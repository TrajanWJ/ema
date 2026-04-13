defmodule Ema.Claude.CostTracker do
  @moduledoc """
  Tracks token usage and cost for Claude Code sessions.

  Two data sources:
  1. Real-time: cost data from stream-json result events
  2. Post-hoc: parsing ~/.claude/projects/*/sessions/*.jsonl for detailed breakdowns

  Stores records to SQLite via Ecto and broadcasts updates via PubSub.
  """

  use GenServer
  require Logger

  alias Ema.Repo

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc """
  Record usage data from a completed session.
  Called by Bridge when a session ends.
  """
  def record(session_id, model, result) do
    GenServer.cast(__MODULE__, {:record, session_id, model, result})
  end

  @doc """
  Get cumulative usage stats.
  """
  def stats do
    GenServer.call(__MODULE__, :stats)
  end

  @doc """
  Get usage for a specific campaign.
  """
  def campaign_usage(campaign_slug) do
    GenServer.call(__MODULE__, {:campaign_usage, campaign_slug})
  end

  # ── GenServer Callbacks ────────────────────────────────────────────────────

  @impl true
  def init(_opts) do
    state = %{
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_cost: 0.0,
      session_count: 0
    }

    {:ok, state}
  end

  @impl true
  def handle_cast({:record, session_id, model, result}, state) do
    input_tokens = result[:input_tokens] || 0
    output_tokens = result[:output_tokens] || 0
    cost = result[:cost] || estimate_cost(model, input_tokens, output_tokens)

    # Store to database
    attrs = %{
      session_id: session_id,
      model: model,
      input_tokens: input_tokens,
      output_tokens: output_tokens,
      cost_usd: cost,
      campaign_slug: result[:campaign_slug],
      project_id: result[:project_id]
    }

    case insert_usage_record(attrs) do
      {:ok, _record} ->
        Logger.info(
          "[CostTracker] Session #{String.slice(session_id, 0..7)}: " <>
            "#{input_tokens + output_tokens} tokens, $#{Float.round(cost || 0.0, 4)}"
        )

      {:error, reason} ->
        Logger.warning("[CostTracker] Failed to store usage record: #{inspect(reason)}")
    end

    # Broadcast update
    Phoenix.PubSub.broadcast(
      Ema.PubSub,
      "claude:events",
      {:cost_update,
       %{
         session_id: session_id,
         input_tokens: input_tokens,
         output_tokens: output_tokens,
         cost: cost,
         cumulative_cost: state.total_cost + (cost || 0.0)
       }}
    )

    new_state = %{
      state
      | total_input_tokens: state.total_input_tokens + input_tokens,
        total_output_tokens: state.total_output_tokens + output_tokens,
        total_cost: state.total_cost + (cost || 0.0),
        session_count: state.session_count + 1
    }

    {:noreply, new_state}
  end

  @impl true
  def handle_call(:stats, _from, state) do
    {:reply, state, state}
  end

  @impl true
  def handle_call({:campaign_usage, campaign_slug}, _from, state) do
    # Query from database
    import Ecto.Query

    result =
      from(u in "claude_usage_records",
        where: u.campaign_slug == ^campaign_slug,
        select: %{
          total_input: sum(u.input_tokens),
          total_output: sum(u.output_tokens),
          total_cost: sum(u.cost_usd),
          session_count: count(u.id)
        }
      )
      |> Repo.one()

    {:reply, result, state}
  rescue
    _ -> {:reply, nil, state}
  end

  # ── Private ────────────────────────────────────────────────────────────────

  defp insert_usage_record(attrs) do
    now = NaiveDateTime.utc_now() |> NaiveDateTime.truncate(:second)

    Repo.insert_all(
      "claude_usage_records",
      [
        Map.merge(attrs, %{inserted_at: now, updated_at: now})
      ],
      returning: true
    )
    |> case do
      {1, [record | _]} -> {:ok, record}
      {0, _} -> {:error, :insert_failed}
      other -> {:ok, other}
    end
  rescue
    e -> {:error, e}
  end

  # Rough cost estimation for Max plan (usage-based tracking)
  defp estimate_cost(_model, input_tokens, output_tokens) do
    # On Max plan, cost is flat rate. Track tokens for usage awareness.
    # These prices are for API reference only.
    input_tokens * 0.000015 + output_tokens * 0.000075
  end
end
