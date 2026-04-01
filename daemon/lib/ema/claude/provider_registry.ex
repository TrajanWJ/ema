defmodule Ema.Claude.ProviderRegistry do
  @moduledoc """
  GenServer registry for all configured AI providers.

  Manages the full lifecycle of AI provider entries — startup registration,
  runtime add/remove, health monitoring, capability tracking, and status
  transitions. Acts as the single source of truth for "what providers are
  available right now and what can they do?"

  ## Provider Types

  - `:claude_cli`  — Claude Code CLI subprocess (Max plan)
  - `:codex_cli`   — Codex CLI subprocess
  - `:openclaw`    — OpenClaw gateway
  - `:openrouter`  — OpenRouter HTTP API
  - `:ollama`      — Local Ollama instance
  - `:custom`      — Any command speaking stream-json or JSONL

  ## Provider Status Transitions

      :available → :rate_limited → :available  (after reset_at)
      :available → :degraded     → :available  (health check recovers)
      :available → :offline      → :available  (manual re-enable or recovery)

  ## Usage

      {:ok, providers} = ProviderRegistry.list_available()
      {:ok, providers} = ProviderRegistry.list_by_capability(:code_execution)
      ProviderRegistry.register(provider_config)
      ProviderRegistry.set_status("claude-personal", :rate_limited)
  """

  use GenServer
  require Logger

  @health_check_interval :timer.seconds(30)

  # ── Provider struct ────────────────────────────────────────────────────────

  defmodule Provider do
    @moduledoc "Represents a registered AI provider with its full state."

    @enforce_keys [:id, :type, :name]
    defstruct [
      :id,
      :type,
      :name,
      :adapter_module,
      status: :available,
      capabilities: %{
        streaming: false,
        code_execution: false,
        tool_use: false,
        file_access: false,
        web_search: false,
        models: []
      },
      accounts: [],
      rate_limits: %{
        requests_per_min: nil,
        tokens_per_min: nil,
        current_rpm: 0,
        current_tpm: 0,
        window_start: nil
      },
      cost_profile: %{
        input_per_1k: 0.0,
        output_per_1k: 0.0,
        cache_read_per_1k: 0.0
      },
      health: %{
        last_check: nil,
        latency_ms: nil,
        error_rate: 0.0,
        consecutive_failures: 0
      },
      config: %{},
      registered_at: nil,
      updated_at: nil
    ]
  end

  # ── Client API ─────────────────────────────────────────────────────────────

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc """
  Register a new provider. Idempotent — re-registration updates the entry.
  """
  @spec register(map()) :: {:ok, Provider.t()} | {:error, term()}
  def register(config) do
    GenServer.call(__MODULE__, {:register, config})
  end

  @doc "Remove a provider by ID."
  @spec deregister(String.t()) :: :ok | {:error, :not_found}
  def deregister(provider_id) do
    GenServer.call(__MODULE__, {:deregister, provider_id})
  end

  @doc "Get a provider by ID."
  @spec get(String.t()) :: {:ok, Provider.t()} | {:error, :not_found}
  def get(provider_id) do
    GenServer.call(__MODULE__, {:get, provider_id})
  end

  @doc "List all providers regardless of status."
  @spec list() :: [Provider.t()]
  def list do
    GenServer.call(__MODULE__, :list)
  end

  @doc "List providers with status :available."
  @spec list_available() :: [Provider.t()]
  def list_available do
    GenServer.call(__MODULE__, {:list_by_status, :available})
  end

  @doc "List providers that have a specific capability."
  @spec list_by_capability(atom()) :: [Provider.t()]
  def list_by_capability(capability) do
    GenServer.call(__MODULE__, {:list_by_capability, capability})
  end

  @doc "List providers of a specific type."
  @spec list_by_type(atom()) :: [Provider.t()]
  def list_by_type(type) do
    GenServer.call(__MODULE__, {:list_by_type, type})
  end

  @doc "Update the status of a provider."
  @spec set_status(String.t(), atom()) :: :ok | {:error, :not_found}
  def set_status(provider_id, status)
      when status in [:available, :rate_limited, :offline, :degraded] do
    GenServer.call(__MODULE__, {:set_status, provider_id, status})
  end

  @doc "Update health metrics for a provider."
  @spec update_health(String.t(), map()) :: :ok | {:error, :not_found}
  def update_health(provider_id, health_update) do
    GenServer.call(__MODULE__, {:update_health, provider_id, health_update})
  end

  @doc "Update rate limit counters for a provider."
  @spec update_rate_limits(String.t(), map()) :: :ok | {:error, :not_found}
  def update_rate_limits(provider_id, rate_update) do
    GenServer.call(__MODULE__, {:update_rate_limits, provider_id, rate_update})
  end

  @doc "Get the adapter module for a provider type."
  @spec adapter_for(atom()) :: module() | nil
  def adapter_for(provider_type) do
    Map.get(adapter_modules(), provider_type)
  end

  @doc "Get the adapter module for a specific provider by ID."
  @spec get_adapter(String.t()) :: {:ok, module()} | {:error, term()}
  def get_adapter(provider_id) do
    case get(provider_id) do
      {:ok, %Provider{adapter_module: mod}} when mod != nil -> {:ok, mod}
      {:ok, %Provider{type: type}} -> {:ok, adapter_for(type)}
      error -> error
    end
  end

  # ── GenServer callbacks ────────────────────────────────────────────────────

  @impl true
  def init(opts) do
    providers = load_providers_from_config(opts)
    schedule_health_checks()

    Logger.info("[ProviderRegistry] Started with #{map_size(providers)} provider(s)")
    {:ok, %{providers: providers}}
  end

  @impl true
  def handle_call({:register, config}, _from, state) do
    now = DateTime.utc_now()
    provider_id = Map.get(config, :id) || Map.get(config, "id")

    if is_nil(provider_id) do
      {:reply, {:error, :missing_id}, state}
    else
      type = Map.get(config, :type) || Map.get(config, "type")

      provider = %Provider{
        id: provider_id,
        type: type,
        name: Map.get(config, :name, provider_id),
        adapter_module: Map.get(config, :adapter_module, adapter_for(type)),
        status: Map.get(config, :status, :available),
        capabilities:
          Map.merge(
            %{
              streaming: false,
              code_execution: false,
              tool_use: false,
              file_access: false,
              web_search: false,
              models: []
            },
            atomize_keys(Map.get(config, :capabilities, %{}))
          ),
        cost_profile: atomize_keys(Map.get(config, :cost_profile, %{})),
        rate_limits: atomize_keys(Map.get(config, :rate_limits, %{})),
        config: Map.get(config, :config, %{}),
        registered_at: Map.get(config, :registered_at, now),
        updated_at: now
      }

      Logger.info("[ProviderRegistry] Registered provider: #{provider_id} (#{type})")
      providers = Map.put(state.providers, provider_id, provider)
      {:reply, {:ok, provider}, %{state | providers: providers}}
    end
  end

  @impl true
  def handle_call({:deregister, provider_id}, _from, state) do
    case Map.pop(state.providers, provider_id) do
      {nil, _} ->
        {:reply, {:error, :not_found}, state}

      {_provider, providers} ->
        Logger.info("[ProviderRegistry] Deregistered provider: #{provider_id}")
        {:reply, :ok, %{state | providers: providers}}
    end
  end

  @impl true
  def handle_call({:get, provider_id}, _from, state) do
    case Map.get(state.providers, provider_id) do
      nil -> {:reply, {:error, :not_found}, state}
      provider -> {:reply, {:ok, provider}, state}
    end
  end

  @impl true
  def handle_call(:list, _from, state) do
    {:reply, Map.values(state.providers), state}
  end

  @impl true
  def handle_call({:list_by_status, status}, _from, state) do
    providers =
      state.providers
      |> Map.values()
      |> Enum.filter(&(&1.status == status))

    {:reply, providers, state}
  end

  @impl true
  def handle_call({:list_by_capability, capability}, _from, state) do
    providers =
      state.providers
      |> Map.values()
      |> Enum.filter(fn p ->
        p.status == :available and Map.get(p.capabilities, capability, false)
      end)

    {:reply, providers, state}
  end

  @impl true
  def handle_call({:list_by_type, type}, _from, state) do
    providers =
      state.providers
      |> Map.values()
      |> Enum.filter(&(&1.type == type))

    {:reply, providers, state}
  end

  @impl true
  def handle_call({:set_status, provider_id, status}, _from, state) do
    case Map.get(state.providers, provider_id) do
      nil ->
        {:reply, {:error, :not_found}, state}

      provider ->
        updated = %{provider | status: status, updated_at: DateTime.utc_now()}
        Logger.info("[ProviderRegistry] Provider #{provider_id} status → #{status}")
        providers = Map.put(state.providers, provider_id, updated)
        {:reply, :ok, %{state | providers: providers}}
    end
  end

  @impl true
  def handle_call({:update_health, provider_id, health_update}, _from, state) do
    case Map.get(state.providers, provider_id) do
      nil ->
        {:reply, {:error, :not_found}, state}

      provider ->
        new_health =
          Map.merge(
            provider.health,
            Map.put(atomize_keys(health_update), :last_check, DateTime.utc_now())
          )

        # Auto-transition status based on consecutive failures
        consecutive = Map.get(new_health, :consecutive_failures, 0)

        new_status =
          cond do
            consecutive >= 5 -> :offline
            consecutive >= 2 -> :degraded
            provider.status in [:degraded, :offline] and consecutive == 0 -> :available
            true -> provider.status
          end

        updated = %{
          provider
          | health: new_health,
            status: new_status,
            updated_at: DateTime.utc_now()
        }

        providers = Map.put(state.providers, provider_id, updated)
        {:reply, :ok, %{state | providers: providers}}
    end
  end

  @impl true
  def handle_call({:update_rate_limits, provider_id, rate_update}, _from, state) do
    case Map.get(state.providers, provider_id) do
      nil ->
        {:reply, {:error, :not_found}, state}

      provider ->
        new_limits = Map.merge(provider.rate_limits, atomize_keys(rate_update))
        updated = %{provider | rate_limits: new_limits, updated_at: DateTime.utc_now()}
        providers = Map.put(state.providers, provider_id, updated)
        {:reply, :ok, %{state | providers: providers}}
    end
  end

  @impl true
  def handle_info(:run_health_checks, state) do
    run_health_checks(state.providers)
    schedule_health_checks()
    {:noreply, state}
  end

  @impl true
  def handle_info({:health_result, provider_id, result}, state) do
    case Map.get(state.providers, provider_id) do
      nil ->
        {:noreply, state}

      provider ->
        {new_health, new_status} =
          case result do
            {:ok, latency_ms} ->
              health = %{
                provider.health
                | last_check: DateTime.utc_now(),
                  latency_ms: latency_ms,
                  consecutive_failures: 0
              }

              status =
                if provider.status in [:degraded, :offline], do: :available, else: provider.status

              {health, status}

            {:error, _reason} ->
              failures = (provider.health[:consecutive_failures] || 0) + 1

              health = %{
                provider.health
                | last_check: DateTime.utc_now(),
                  consecutive_failures: failures
              }

              status =
                cond do
                  failures >= 5 -> :offline
                  failures >= 2 -> :degraded
                  true -> provider.status
                end

              {health, status}
          end

        updated = %{
          provider
          | health: new_health,
            status: new_status,
            updated_at: DateTime.utc_now()
        }

        providers = Map.put(state.providers, provider_id, updated)
        {:noreply, %{state | providers: providers}}
    end
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  # ── Private helpers ────────────────────────────────────────────────────────

  defp load_providers_from_config(_opts) do
    case Application.get_env(:ema, Ema.Claude, []) do
      config when is_list(config) ->
        config
        |> Keyword.get(:providers, [])
        |> Enum.reduce(%{}, fn provider_config, acc ->
          config_map =
            if is_map(provider_config), do: provider_config, else: Map.new(provider_config)

          case register_from_config(config_map) do
            {:ok, provider} ->
              Map.put(acc, provider.id, provider)

            {:error, reason} ->
              Logger.warning("[ProviderRegistry] Failed to load provider: #{inspect(reason)}")
              acc
          end
        end)

      _ ->
        %{}
    end
  end

  defp register_from_config(config) do
    now = DateTime.utc_now()
    provider_id = Map.get(config, :id) || Map.get(config, "id")
    type = Map.get(config, :type) || Map.get(config, "type")

    if is_nil(provider_id) or is_nil(type) do
      {:error, :missing_required_fields}
    else
      provider = %Provider{
        id: provider_id,
        type: type,
        name: Map.get(config, :name, to_string(provider_id)),
        adapter_module: adapter_for(type),
        capabilities: build_capabilities(type, config),
        cost_profile: atomize_keys(Map.get(config, :cost_profile, %{})),
        config: config,
        registered_at: now,
        updated_at: now
      }

      {:ok, provider}
    end
  end

  defp build_capabilities(type, config) do
    base =
      case type do
        :claude_cli ->
          %{
            streaming: true,
            code_execution: true,
            tool_use: true,
            file_access: true,
            web_search: false,
            models: Map.get(config, :models, ["opus", "sonnet", "haiku"])
          }

        :codex_cli ->
          %{
            streaming: true,
            code_execution: true,
            tool_use: true,
            file_access: true,
            web_search: false,
            models: Map.get(config, :models, ["gpt-5.2-codex"])
          }

        :openclaw ->
          %{
            streaming: true,
            code_execution: false,
            tool_use: true,
            file_access: false,
            web_search: true,
            models: Map.get(config, :models, [])
          }

        :openrouter ->
          %{
            streaming: true,
            code_execution: false,
            tool_use: true,
            file_access: false,
            web_search: false,
            models: Map.get(config, :models, [])
          }

        :ollama ->
          %{
            streaming: true,
            code_execution: false,
            tool_use: false,
            file_access: false,
            web_search: false,
            models: Map.get(config, :models, [])
          }

        _ ->
          %{
            streaming: false,
            code_execution: false,
            tool_use: false,
            file_access: false,
            web_search: false,
            models: []
          }
      end

    Map.merge(base, atomize_keys(Map.get(config, :capabilities, %{})))
  end

  defp run_health_checks(providers) do
    me = self()

    providers
    |> Enum.filter(fn {_, p} -> p.adapter_module != nil and p.status != :offline end)
    |> Enum.each(fn {provider_id, provider} ->
      Task.start(fn ->
        start = System.monotonic_time(:millisecond)

        result =
          try do
            case provider.adapter_module.health_check() do
              :ok ->
                latency = System.monotonic_time(:millisecond) - start
                {:ok, latency}

              {:error, reason} ->
                {:error, reason}
            end
          rescue
            e -> {:error, Exception.message(e)}
          end

        send(me, {:health_result, provider_id, result})
      end)
    end)
  end

  defp schedule_health_checks do
    Process.send_after(self(), :run_health_checks, @health_check_interval)
  end

  defp adapter_modules do
    %{
      claude_cli: Ema.Claude.Adapters.ClaudeCli,
      codex_cli: Ema.Claude.Adapters.CodexCli,
      openclaw: Ema.Claude.Adapters.OpenClaw,
      openrouter: Ema.Claude.Adapters.OpenRouter,
      ollama: Ema.Claude.Adapters.Ollama
    }
  end

  defp atomize_keys(map) when is_map(map) do
    Map.new(map, fn
      {k, v} when is_binary(k) -> {String.to_atom(k), v}
      {k, v} -> {k, v}
    end)
  end

  defp atomize_keys(other), do: other
end
