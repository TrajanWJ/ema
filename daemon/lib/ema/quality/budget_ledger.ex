defmodule Ema.Quality.BudgetLedger do
  @moduledoc """
  Tracks daily token usage and API costs with configurable limits.
  Broadcasts warnings when approaching budget thresholds.
  """

  use GenServer
  require Logger

  @daily_token_limit 500_000
  @daily_cost_limit_cents 500
  @reset_check_interval :timer.minutes(5)

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc "Record a usage event: provider, model, token_count, cost_cents."
  def record_usage(provider, model, token_count, cost_cents) do
    GenServer.cast(__MODULE__, {:record, provider, model, token_count, cost_cents})
  end

  def get_ledger do
    GenServer.call(__MODULE__, :get_ledger)
  end

  def daily_summary do
    GenServer.call(__MODULE__, :daily_summary)
  end

  def check_budget do
    GenServer.call(__MODULE__, :check_budget)
  end

  @impl true
  def init(_opts) do
    schedule_reset_check()

    {:ok,
     %{
       date: Date.utc_today(),
       total_tokens: 0,
       total_cost_cents: 0,
       entries: [],
       warning_sent: false
     }}
  end

  @impl true
  def handle_cast({:record, provider, model, token_count, cost_cents}, state) do
    state = maybe_reset(state)

    entry = %{
      provider: provider,
      model: model,
      tokens: token_count,
      cost_cents: cost_cents,
      recorded_at: DateTime.utc_now()
    }

    new_state = %{
      state
      | total_tokens: state.total_tokens + token_count,
        total_cost_cents: state.total_cost_cents + cost_cents,
        entries: [entry | state.entries]
    }

    new_state = maybe_warn(new_state)
    {:noreply, new_state}
  end

  @impl true
  def handle_call(:get_ledger, _from, state) do
    {:reply, state, state}
  end

  @impl true
  def handle_call(:daily_summary, _from, state) do
    state = maybe_reset(state)

    summary = %{
      date: state.date,
      total_tokens: state.total_tokens,
      total_cost_cents: state.total_cost_cents,
      token_limit: @daily_token_limit,
      cost_limit_cents: @daily_cost_limit_cents,
      token_pct: Float.round(state.total_tokens / @daily_token_limit * 100, 1),
      cost_pct: Float.round(state.total_cost_cents / @daily_cost_limit_cents * 100, 1),
      entry_count: length(state.entries)
    }

    {:reply, summary, state}
  end

  @impl true
  def handle_call(:check_budget, _from, state) do
    state = maybe_reset(state)
    token_ok = state.total_tokens < @daily_token_limit
    cost_ok = state.total_cost_cents < @daily_cost_limit_cents

    result = %{
      within_budget: token_ok and cost_ok,
      tokens_remaining: max(@daily_token_limit - state.total_tokens, 0),
      cost_remaining_cents: max(@daily_cost_limit_cents - state.total_cost_cents, 0)
    }

    {:reply, result, state}
  end

  @impl true
  def handle_info(:reset_check, state) do
    state = maybe_reset(state)
    schedule_reset_check()
    {:noreply, state}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  defp maybe_reset(state) do
    today = Date.utc_today()

    if state.date != today do
      %{state | date: today, total_tokens: 0, total_cost_cents: 0, entries: [], warning_sent: false}
    else
      state
    end
  end

  defp maybe_warn(state) do
    token_pct = state.total_tokens / @daily_token_limit * 100
    cost_pct = state.total_cost_cents / @daily_cost_limit_cents * 100

    if (token_pct > 80 or cost_pct > 80) and not state.warning_sent do
      Phoenix.PubSub.broadcast(Ema.PubSub, "quality:budget", {:budget_warning, %{
        token_pct: Float.round(token_pct, 1),
        cost_pct: Float.round(cost_pct, 1)
      }})

      %{state | warning_sent: true}
    else
      state
    end
  end

  defp schedule_reset_check do
    Process.send_after(self(), :reset_check, @reset_check_interval)
  end
end
