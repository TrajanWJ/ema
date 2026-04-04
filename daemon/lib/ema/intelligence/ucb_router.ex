defmodule Ema.Intelligence.UCBRouter do
  @moduledoc """
  UCB1-based agent selection using ETS-backed win/trial counters.

  UCB1 score = avg_reward + sqrt(2 * ln(N) / n_i)
  Where N = total dispatches for task_type, n_i = dispatches to agent i.

  Unvisited agents get :infinity score (forced exploration first).
  After warmup (all agents visited), exploitation begins.

  Use select_agent/2 at dispatch time.
  Use record_outcome/3 from SignalProcessor after task completion.
  """

  use GenServer
  require Logger

  @table :ema_ucb_router

  def start_link(opts \\ []), do: GenServer.start_link(__MODULE__, opts, name: __MODULE__)

  @impl true
  def init(_opts) do
    :ets.new(@table, [:named_table, :set, :public, read_concurrency: true])
    {:ok, %{}}
  end

  @doc """
  Select the best agent from candidates for a given task_type.
  Returns the agent atom with highest UCB1 score.
  """
  def select_agent(candidate_agents, task_type)
      when is_list(candidate_agents) and length(candidate_agents) > 0 do
    total = get_total(task_type)

    scored =
      Enum.map(candidate_agents, fn agent ->
        stats = get_stats(agent, task_type)
        score = ucb1_score(stats, total)
        {agent, score}
      end)

    {best_agent, _score} =
      Enum.max_by(scored, fn {_a, s} ->
        case s do
          :infinity -> 1.0e308
          n -> n
        end
      end)

    best_agent
  end

  def select_agent([single | _], _task_type), do: single
  def select_agent([], _task_type), do: nil

  @doc """
  Record an outcome for an agent dispatch.
  outcome: :win | :loss | :success | :failure
  """
  def record_outcome(agent, task_type, outcome) do
    is_win = outcome in [:win, :success]

    key = stats_key(agent, task_type)
    stats = get_stats(agent, task_type)

    updated = %{
      stats
      | trials: stats.trials + 1,
        wins: if(is_win, do: stats.wins + 1, else: stats.wins)
    }

    :ets.insert(@table, {key, updated})

    # Increment total counter
    total_key = total_key(task_type)

    case :ets.lookup(@table, total_key) do
      [] -> :ets.insert(@table, {total_key, 1})
      [{^total_key, n}] -> :ets.insert(@table, {total_key, n + 1})
    end

    :ok
  end

  @doc "Get stats for a specific agent+task_type."
  def get_stats(agent, task_type) do
    key = stats_key(agent, task_type)

    case :ets.lookup(@table, key) do
      [{^key, stats}] -> stats
      [] -> %{agent: agent, task_type: task_type, wins: 0, trials: 0}
    end
  end

  @doc "Get all recorded agent stats."
  def all_stats do
    :ets.tab2list(@table)
    |> Enum.filter(fn {k, _} -> is_tuple(k) and tuple_size(k) == 2 and elem(k, 0) != :total end)
    |> Enum.map(fn {_k, v} -> v end)
  end

  @impl true
  def handle_call(:stats, _from, state) do
    {:reply, all_stats(), state}
  end

  # --- Private ---

  defp ucb1_score(%{trials: 0}, _total), do: :infinity

  defp ucb1_score(%{wins: wins, trials: trials}, total) when total > 0 do
    avg_reward = wins / trials
    exploration = :math.sqrt(2 * :math.log(total) / trials)
    avg_reward + exploration
  end

  defp ucb1_score(%{wins: wins, trials: trials}, _total) do
    if trials > 0, do: wins / trials, else: :infinity
  end

  defp stats_key(agent, task_type), do: {agent, task_type}
  defp total_key(task_type), do: {:total, task_type}

  defp get_total(task_type) do
    key = total_key(task_type)

    case :ets.lookup(@table, key) do
      [{^key, n}] -> n
      [] -> 0
    end
  end
end
