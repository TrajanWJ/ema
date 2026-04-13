defmodule Ema.Claude.AccountManager do
  @moduledoc """
  GenServer for managing multiple AI provider accounts.

  Tracks per-account rate limit state, daily usage, and priority.
  Supports account rotation when rate limits are hit.

  State: `%{account_id => %Account{}}` where each Account has:
  - `:id` — unique identifier
  - `:provider_id` — which provider this account belongs to
  - `:name` — human-readable name
  - `:auth` — auth credentials (API key, token, etc.) — stored as map
  - `:rate_limit_state` — :ok | {:limited, reset_at}
  - `:usage_today` — %{tokens_in: int, tokens_out: int, cost_usd: float, requests: int}
  - `:priority` — integer, lower = higher priority (1 = highest)
  - `:status` — :active | :disabled | :rate_limited

  Daily usage resets at midnight UTC via scheduled message.

  Load initial accounts from Application env:

      config :ema, :accounts, [
        %{id: :openrouter_main, provider_id: :openrouter, name: "Main Key", auth: %{api_key: "sk-..."}, priority: 1}
      ]
  """

  use GenServer

  require Logger

  defmodule Account do
    @moduledoc false
    defstruct [
      :id,
      :provider_id,
      :name,
      :auth,
      rate_limit_state: :ok,
      usage_today: %{tokens_in: 0, tokens_out: 0, cost_usd: 0.0, requests: 0},
      priority: 10,
      status: :active
    ]
  end

  # Client API

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc "Add a new account."
  def add_account(account_config) do
    GenServer.call(__MODULE__, {:add_account, account_config})
  end

  @doc "Remove an account by ID."
  def remove_account(account_id) do
    GenServer.call(__MODULE__, {:remove_account, account_id})
  end

  @doc """
  Get the best available account for a provider.
  Picks by: status == :active, rate_limit_state == :ok, then lowest priority number.
  Returns `{:ok, account}` or `{:error, :no_accounts_available}`.
  """
  def get_best_account(provider_id) do
    GenServer.call(__MODULE__, {:get_best_account, provider_id})
  end

  @doc "Mark an account as rate limited, with optional reset timestamp."
  def mark_rate_limited(account_id, reset_at \\ nil) do
    GenServer.cast(__MODULE__, {:mark_rate_limited, account_id, reset_at})
  end

  @doc "Record usage for an account. Accepts a map or individual args."
  def record_usage(account_id, %{} = usage) do
    record_usage(
      account_id,
      Map.get(usage, :input_tokens, 0),
      Map.get(usage, :output_tokens, 0),
      Map.get(usage, :cost_usd, 0.0)
    )
  end

  def record_usage(account_id, tokens_in, tokens_out, cost \\ 0.0) do
    GenServer.cast(__MODULE__, {:record_usage, account_id, tokens_in, tokens_out, cost})
  end

  @doc "Record a successful request for an account."
  def record_success(_account_id), do: :ok

  @doc "Record an error for an account."
  def record_error(account_id, _reason) do
    GenServer.cast(__MODULE__, {:record_error, account_id})
  end

  @doc "Rotate away from a rate-limited account."
  def rotate_on_limit(account_id, opts \\ []) do
    reset_at = Keyword.get(opts, :reset_at)
    mark_rate_limited(account_id, reset_at)
  end

  @doc """
  Get usage report. Period can be :today or a date string.
  Returns aggregated stats per provider and per account.
  """
  def usage_report(period \\ :today) do
    GenServer.call(__MODULE__, {:usage_report, period})
  end

  @doc "Reset daily usage counters for all accounts."
  def reset_daily_usage do
    GenServer.cast(__MODULE__, :reset_daily_usage)
  end

  @doc "List all accounts, optionally filtered by provider_id."
  def list(provider_id \\ nil) do
    GenServer.call(__MODULE__, {:list, provider_id})
  end

  # GenServer callbacks

  @impl true
  def init(_opts) do
    accounts = load_from_config()
    schedule_midnight_reset()
    {:ok, accounts}
  end

  @impl true
  def handle_call({:add_account, config}, _from, state) do
    case build_account(config) do
      {:ok, account} ->
        new_state = Map.put(state, account.id, account)

        Logger.info(
          "AccountManager: added account #{inspect(account.id)} for provider #{inspect(account.provider_id)}"
        )

        {:reply, {:ok, account}, new_state}

      {:error, _reason} = err ->
        {:reply, err, state}
    end
  end

  @impl true
  def handle_call({:remove_account, account_id}, _from, state) do
    case Map.fetch(state, account_id) do
      {:ok, _} ->
        new_state = Map.delete(state, account_id)
        Logger.info("AccountManager: removed account #{inspect(account_id)}")
        {:reply, :ok, new_state}

      :error ->
        {:reply, {:error, :not_found}, state}
    end
  end

  @impl true
  def handle_call({:get_best_account, provider_id}, _from, state) do
    result =
      state
      |> Map.values()
      |> Enum.filter(fn a ->
        a.provider_id == provider_id and
          a.status == :active and
          rate_limit_ok?(a)
      end)
      |> Enum.sort_by(& &1.priority)
      |> List.first()

    case result do
      nil -> {:reply, {:error, :no_accounts_available}, state}
      account -> {:reply, {:ok, account}, state}
    end
  end

  @impl true
  def handle_call({:list, nil}, _from, state) do
    {:reply, Map.values(state), state}
  end

  @impl true
  def handle_call({:list, provider_id}, _from, state) do
    accounts = state |> Map.values() |> Enum.filter(&(&1.provider_id == provider_id))
    {:reply, accounts, state}
  end

  @impl true
  def handle_call({:usage_report, _period}, _from, state) do
    by_provider =
      state
      |> Map.values()
      |> Enum.group_by(& &1.provider_id)
      |> Map.new(fn {prov_id, accounts} ->
        {prov_id,
         Enum.reduce(accounts, %{tokens_in: 0, tokens_out: 0, cost_usd: 0.0, requests: 0}, fn a,
                                                                                              acc ->
           %{
             tokens_in: acc.tokens_in + a.usage_today.tokens_in,
             tokens_out: acc.tokens_out + a.usage_today.tokens_out,
             cost_usd: acc.cost_usd + a.usage_today.cost_usd,
             requests: acc.requests + a.usage_today.requests
           }
         end)}
      end)

    by_account =
      Map.new(state, fn {id, a} -> {id, a.usage_today} end)

    {:reply, %{by_provider: by_provider, by_account: by_account}, state}
  end

  @impl true
  def handle_cast({:mark_rate_limited, account_id, reset_at}, state) do
    new_state =
      Map.update(state, account_id, nil, fn account ->
        %{account | rate_limit_state: {:limited, reset_at}, status: :rate_limited}
      end)

    Logger.warning(
      "AccountManager: account #{inspect(account_id)} rate limited, reset: #{inspect(reset_at)}"
    )

    # Schedule auto-recovery if reset_at is provided
    if reset_at do
      delay_ms = max(0, DateTime.diff(reset_at, DateTime.utc_now(), :millisecond))
      Process.send_after(self(), {:recover_account, account_id}, delay_ms)
    end

    {:noreply, new_state}
  end

  @impl true
  def handle_cast({:record_usage, account_id, tokens_in, tokens_out, cost}, state) do
    new_state =
      Map.update(state, account_id, nil, fn account ->
        usage = account.usage_today

        updated = %{
          tokens_in: usage.tokens_in + tokens_in,
          tokens_out: usage.tokens_out + tokens_out,
          cost_usd: usage.cost_usd + cost,
          requests: usage.requests + 1
        }

        %{account | usage_today: updated}
      end)

    {:noreply, new_state}
  end

  @impl true
  def handle_cast({:record_error, account_id}, state) do
    new_state =
      Map.update(state, account_id, nil, fn
        nil -> nil
        account -> account
      end)

    {:noreply, new_state}
  end

  @impl true
  def handle_cast(:reset_daily_usage, state) do
    new_state =
      Map.new(state, fn {id, account} ->
        {id, %{account | usage_today: %{tokens_in: 0, tokens_out: 0, cost_usd: 0.0, requests: 0}}}
      end)

    Logger.info("AccountManager: daily usage reset")
    schedule_midnight_reset()
    {:noreply, new_state}
  end

  @impl true
  def handle_info({:recover_account, account_id}, state) do
    new_state =
      Map.update(state, account_id, nil, fn account ->
        %{account | rate_limit_state: :ok, status: :active}
      end)

    Logger.info("AccountManager: account #{inspect(account_id)} recovered from rate limit")
    {:noreply, new_state}
  end

  @impl true
  def handle_info(:reset_daily_usage, state) do
    handle_cast(:reset_daily_usage, state)
  end

  # Private helpers

  defp load_from_config do
    :ema
    |> Application.get_env(:accounts, [])
    |> Enum.reduce(%{}, fn config, acc ->
      case build_account(config) do
        {:ok, account} ->
          Map.put(acc, account.id, account)

        {:error, reason} ->
          Logger.warning("AccountManager: skipping invalid account config: #{inspect(reason)}")
          acc
      end
    end)
  end

  defp build_account(config) do
    id = Map.get(config, :id) || Map.get(config, "id")
    provider_id = Map.get(config, :provider_id) || Map.get(config, "provider_id")
    name = Map.get(config, :name) || Map.get(config, "name") || to_string(id)
    auth = Map.get(config, :auth) || Map.get(config, "auth") || %{}
    priority = Map.get(config, :priority) || Map.get(config, "priority") || 10

    if id && provider_id do
      account = %Account{
        id: id,
        provider_id: provider_id,
        name: name,
        auth: auth,
        priority: priority,
        status: :active
      }

      {:ok, account}
    else
      {:error, :missing_required_fields}
    end
  end

  defp rate_limit_ok?(%Account{rate_limit_state: :ok}), do: true

  defp rate_limit_ok?(%Account{rate_limit_state: {:limited, nil}}), do: false

  defp rate_limit_ok?(%Account{rate_limit_state: {:limited, reset_at}}) do
    DateTime.compare(DateTime.utc_now(), reset_at) == :gt
  end

  defp schedule_midnight_reset do
    now = DateTime.utc_now()
    midnight = %{now | hour: 0, minute: 0, second: 0, microsecond: {0, 0}}
    next_midnight = DateTime.add(midnight, 1, :day)
    delay_ms = max(0, DateTime.diff(next_midnight, now, :millisecond))
    Process.send_after(self(), :reset_daily_usage, delay_ms)
  end
end
