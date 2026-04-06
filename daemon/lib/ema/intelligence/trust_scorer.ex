defmodule Ema.Intelligence.TrustScorer do
  @moduledoc """
  GenServer that calculates trust scores for OpenClaw agents.
  Scores are based on task completion rate, response latency, error rate,
  session count, and days active. Updated daily.
  """

  use GenServer
  require Logger

  import Ecto.Query

  alias Ema.Repo
  alias Ema.Agents
  alias Ema.Intelligence.TrustScore

  @recalc_interval :timer.hours(24)

  # --- Public API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc "Force recalculation of all agent trust scores."
  def recalculate_all do
    GenServer.cast(__MODULE__, :recalculate)
  end

  @doc "Get the latest trust score for an agent."
  def get_score(agent_id) do
    TrustScore
    |> where([s], s.agent_id == ^agent_id)
    |> order_by([s], desc: s.calculated_at)
    |> limit(1)
    |> Repo.one()
  end

  @doc "Get latest trust scores for all agents as a map of agent_id => score_record."
  def all_scores do
    # Subquery to get the latest score per agent
    latest =
      TrustScore
      |> group_by([s], s.agent_id)
      |> select([s], %{agent_id: s.agent_id, max_at: max(s.calculated_at)})

    TrustScore
    |> join(:inner, [s], l in subquery(latest),
      on: s.agent_id == l.agent_id and s.calculated_at == l.max_at
    )
    |> Repo.all()
    |> Map.new(fn s -> {s.agent_id, s} end)
  end

  @doc "Returns the trust badge label and color for a given score."
  def badge(score) when is_integer(score) do
    cond do
      score >= 90 -> %{label: "Excellent", color: "emerald"}
      score >= 70 -> %{label: "Good", color: "teal"}
      score >= 50 -> %{label: "Fair", color: "amber"}
      true -> %{label: "Unreliable", color: "red"}
    end
  end

  def badge(_), do: %{label: "Unknown", color: "gray"}

  # --- Callbacks ---

  @impl true
  def init(_opts) do
    # Run initial calculation after a short delay
    Process.send_after(self(), :recalculate, :timer.seconds(10))
    {:ok, %{}}
  end

  @impl true
  def handle_info(:recalculate, state) do
    do_recalculate()
    schedule_recalc()
    {:noreply, state}
  end

  @impl true
  def handle_cast(:recalculate, state) do
    do_recalculate()
    {:noreply, state}
  end

  # --- Internal ---

  defp schedule_recalc do
    Process.send_after(self(), :recalculate, @recalc_interval)
  end

  defp do_recalculate do
    agents = Agents.list_agents()

    Enum.each(agents, fn agent ->
      score_data = calculate_for_agent(agent)

      attrs = %{
        id: Ecto.UUID.generate(),
        agent_id: agent.id,
        score: score_data.score,
        completion_rate: score_data.completion_rate,
        avg_latency_ms: score_data.avg_latency_ms,
        error_count: score_data.error_count,
        session_count: score_data.session_count,
        days_active: score_data.days_active,
        calculated_at: DateTime.utc_now() |> DateTime.truncate(:second)
      }

      case %TrustScore{} |> TrustScore.changeset(attrs) |> Repo.insert() do
        {:ok, _} ->
          :ok

        {:error, reason} ->
          Logger.warning("TrustScorer: failed for #{agent.slug}: #{inspect(reason)}")
      end
    end)

    broadcast(:trust_scores_updated)
    Logger.info("TrustScorer: recalculated scores for #{length(agents)} agents")
  end

  defp calculate_for_agent(agent) do
    runs = get_agent_runs(agent.id)
    conversations = get_agent_conversations(agent.id)

    total_runs = length(runs)
    completed_runs = Enum.count(runs, fn r -> r.status == "completed" end)
    error_runs = Enum.count(runs, fn r -> r.status == "error" end)

    completion_rate = if total_runs > 0, do: completed_runs / total_runs, else: 0.0

    avg_latency =
      runs
      |> Enum.filter(fn r -> r.duration_ms != nil and r.duration_ms > 0 end)
      |> case do
        [] ->
          0

        with_latency ->
          Enum.sum(Enum.map(with_latency, & &1.duration_ms)) |> div(length(with_latency))
      end

    session_count = length(conversations)

    days_active =
      if agent.inserted_at do
        DateTime.diff(DateTime.utc_now(), agent.inserted_at, :day)
      else
        0
      end

    # Score calculation (0-100):
    # - completion_rate: 0-40 points
    # - latency: 0-20 points (lower is better, <5s = max)
    # - error_rate: 0-20 points (lower is better)
    # - activity: 0-20 points (more sessions + days = better)
    completion_score = round(completion_rate * 40)

    latency_score =
      cond do
        avg_latency == 0 -> 10
        avg_latency < 2000 -> 20
        avg_latency < 5000 -> 15
        avg_latency < 10000 -> 10
        avg_latency < 30000 -> 5
        true -> 0
      end

    error_rate = if total_runs > 0, do: error_runs / total_runs, else: 0.0
    error_score = round((1.0 - error_rate) * 20)

    activity_score =
      min(20, round(min(session_count, 50) / 50 * 10 + min(days_active, 30) / 30 * 10))

    score = min(100, max(0, completion_score + latency_score + error_score + activity_score))

    %{
      score: score,
      completion_rate: Float.round(completion_rate * 1.0, 3),
      avg_latency_ms: avg_latency,
      error_count: error_runs,
      session_count: session_count,
      days_active: days_active
    }
  end

  defp get_agent_runs(agent_id) do
    Ema.Agents.Run
    |> where([r], r.agent_id == ^agent_id)
    |> Repo.all()
  rescue
    _ -> []
  end

  defp get_agent_conversations(agent_id) do
    Ema.Agents.Conversation
    |> where([c], c.agent_id == ^agent_id)
    |> Repo.all()
  rescue
    _ -> []
  end

  defp broadcast(event) do
    Phoenix.PubSub.broadcast(Ema.PubSub, "intelligence:trust", {event, %{}})
  end
end
