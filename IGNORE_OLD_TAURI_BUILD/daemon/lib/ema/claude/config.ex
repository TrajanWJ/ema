defmodule Ema.Claude.Config do
  @moduledoc """
  Configuration schema and validation for the EMA Claude multi-backend system.

  Defines the canonical structure for all provider, account, routing, and
  distribution configuration. Provides helpers for reading config at runtime
  and validating it at startup.

  ## config/config.exs Example

      config :ema, Ema.Claude,
        default_strategy: :balanced,
        providers: [
          %{
            id: "claude-personal",
            type: :claude_cli,
            accounts: [
              %{name: "personal", auth: {:oauth, "~/.claude/credentials.json"}},
              %{name: "work", auth: {:oauth, "~/.claude-work/credentials.json"}}
            ],
            models: ["opus", "sonnet", "haiku"],
            cost_profile: %{opus: 0.015, sonnet: 0.003, haiku: 0.00025}
          },
          %{
            id: "codex",
            type: :codex_cli,
            accounts: [%{name: "default", auth: :system}],
            models: ["gpt-5.2-codex"],
            cost_profile: %{default: 0.0}
          },
          %{
            id: "ollama-local",
            type: :ollama,
            url: "http://localhost:11434",
            models: ["llama3.3", "codestral", "deepseek-coder-v2"],
            cost_profile: %{default: 0.0}
          },
          %{
            id: "openrouter",
            type: :openrouter,
            accounts: [%{name: "default", auth: {:api_key, {:env, "OPENROUTER_API_KEY"}}}],
            models: :dynamic
          }
        ],
        distribution: [
          enabled: false,
          cluster_strategy: :tailscale,
          tailscale_network: "mynet.ts.net",
          nodes: []
        ]

  ## Runtime Config Access

      config = Ema.Claude.Config.get()
      strategy = Ema.Claude.Config.get(:default_strategy, :balanced)
      :ok = Ema.Claude.Config.validate!()
  """

  require Logger

  @valid_strategies [:balanced, :cheapest, :fastest, :best, :round_robin, :failover]
  @valid_provider_types [:claude_cli, :codex_cli, :openrouter, :ollama, :openclaw, :custom]
  @valid_cluster_strategies [:tailscale, :dns, :kubernetes, :epmd, :gossip]

  # ── Public API ─────────────────────────────────────────────────────────────

  @doc """
  Get the full EMA Claude configuration as a map.
  """
  @spec get() :: map()
  def get do
    raw = Application.get_env(:ema, Ema.Claude, [])

    %{
      default_strategy: Keyword.get(raw, :default_strategy, :balanced),
      providers: Keyword.get(raw, :providers, []),
      distribution: Keyword.get(raw, :distribution, enabled: false)
    }
  end

  @doc """
  Get a specific config key with a default value.
  """
  @spec get(atom(), term()) :: term()
  def get(key, default \\ nil) do
    raw = Application.get_env(:ema, Ema.Claude, [])
    Keyword.get(raw, key, default)
  end

  @doc """
  Get bridge-specific config (claude_cmd, default_model, plugin_dir, etc.).
  """
  @spec bridge_config() :: keyword()
  def bridge_config do
    Application.get_env(:ema, Ema.Claude.Bridge, [])
  end

  @doc """
  Get backend config (gateway_url, agent_id).
  """
  @spec backend_config() :: keyword()
  def backend_config do
    Application.get_env(:ema, Ema.Claude.Backend, [])
  end

  @doc """
  Get the list of configured provider configs.
  """
  @spec providers() :: [map()]
  def providers do
    get(:providers, [])
  end

  @doc """
  Get config for a specific provider by ID.
  """
  @spec provider(String.t()) :: map() | nil
  def provider(provider_id) do
    Enum.find(providers(), fn p ->
      Map.get(p, :id) == provider_id || Map.get(p, "id") == provider_id
    end)
  end

  @doc """
  Get distribution config.
  """
  @spec distribution() :: keyword()
  def distribution do
    get(:distribution, enabled: false)
  end

  @doc """
  Check if distributed mode is enabled.
  """
  @spec distributed?() :: boolean()
  def distributed? do
    distribution() |> Keyword.get(:enabled, false)
  end

  @doc """
  Get default routing strategy.
  """
  @spec default_strategy() :: atom()
  def default_strategy do
    get(:default_strategy, :balanced)
  end

  # ── Validation ─────────────────────────────────────────────────────────────

  @doc """
  Validate the entire configuration at startup.
  Logs warnings for non-critical issues, raises on critical errors.
  """
  @spec validate!() :: :ok
  def validate! do
    config = get()

    validate_strategy!(config.default_strategy)
    validate_providers!(config.providers)
    validate_distribution!(config.distribution)

    Logger.info("[Config] Configuration validated (#{length(config.providers)} provider(s))")
    :ok
  end

  @doc """
  Validate configuration without raising. Returns `{:ok, warnings}` or `{:error, errors}`.
  """
  @spec validate() :: {:ok, [String.t()]} | {:error, [String.t()]}
  def validate do
    try do
      validate!()
      {:ok, []}
    rescue
      e in ArgumentError -> {:error, [Exception.message(e)]}
    end
  end

  # ── Private validation helpers ─────────────────────────────────────────────

  defp validate_strategy!(strategy) do
    unless strategy in @valid_strategies do
      raise ArgumentError,
            "Invalid default_strategy: #{inspect(strategy)}. Must be one of: #{inspect(@valid_strategies)}"
    end
  end

  defp validate_providers!(providers) when is_list(providers) do
    # Check for duplicate IDs
    ids =
      providers
      |> Enum.map(&(Map.get(&1, :id) || Map.get(&1, "id")))
      |> Enum.reject(&is_nil/1)

    duplicate_ids = ids -- Enum.uniq(ids)

    unless Enum.empty?(duplicate_ids) do
      raise ArgumentError, "Duplicate provider IDs: #{inspect(duplicate_ids)}"
    end

    # Validate each provider
    Enum.with_index(providers)
    |> Enum.each(fn {provider, index} ->
      validate_single_provider!(provider, index)
    end)
  end

  defp validate_providers!(_), do: raise(ArgumentError, "providers must be a list")

  defp validate_single_provider!(provider, index) do
    id = Map.get(provider, :id) || Map.get(provider, "id")
    type = Map.get(provider, :type) || Map.get(provider, "type")

    if is_nil(id) do
      raise ArgumentError, "Provider at index #{index} missing :id"
    end

    if is_nil(type) do
      raise ArgumentError, "Provider #{id} missing :type"
    end

    unless type in @valid_provider_types do
      raise ArgumentError,
            "Provider #{id} has invalid type: #{inspect(type)}. Must be one of: #{inspect(@valid_provider_types)}"
    end

    # Validate accounts if present
    accounts = Map.get(provider, :accounts, [])

    Enum.each(accounts, fn account ->
      validate_account!(id, account)
    end)

    # Validate models
    models = Map.get(provider, :models, [])

    unless is_list(models) or models == :dynamic do
      raise ArgumentError, "Provider #{id} :models must be a list or :dynamic"
    end

    # Type-specific validation
    case type do
      :ollama ->
        url = Map.get(provider, :url)

        if url do
          unless String.starts_with?(url, "http") do
            Logger.warning("[Config] Provider #{id} has non-HTTP URL: #{url}")
          end
        end

      :openrouter ->
        if Enum.empty?(accounts) do
          Logger.warning(
            "[Config] Provider #{id} (openrouter) has no accounts — will need OPENROUTER_API_KEY env"
          )
        end

      _ ->
        :ok
    end
  end

  defp validate_account!(provider_id, account) do
    name = Map.get(account, :name) || Map.get(account, "name")
    auth = Map.get(account, :auth) || Map.get(account, "auth")

    if is_nil(name) do
      raise ArgumentError, "Account in provider #{provider_id} missing :name"
    end

    if is_nil(auth) do
      raise ArgumentError, "Account '#{name}' in provider #{provider_id} missing :auth"
    end

    validate_auth_spec!(provider_id, name, auth)
  end

  defp validate_auth_spec!(_pid, _name, :system), do: :ok
  defp validate_auth_spec!(_pid, _name, {:oauth, path}) when is_binary(path), do: :ok
  defp validate_auth_spec!(_pid, _name, {:api_key, key}) when is_binary(key), do: :ok
  defp validate_auth_spec!(_pid, _name, {:api_key, {:env, var}}) when is_binary(var), do: :ok

  defp validate_auth_spec!(provider_id, name, auth) do
    raise ArgumentError,
          "Account '#{name}' in provider #{provider_id} has invalid :auth: #{inspect(auth)}. " <>
            "Must be :system, {:oauth, path}, {:api_key, key}, or {:api_key, {:env, \"VAR\"}}"
  end

  defp validate_distribution!(dist) when is_list(dist) do
    enabled = Keyword.get(dist, :enabled, false)

    if enabled do
      strategy = Keyword.get(dist, :cluster_strategy)

      if strategy && strategy not in @valid_cluster_strategies do
        raise ArgumentError,
              "Invalid cluster_strategy: #{inspect(strategy)}. Must be one of: #{inspect(@valid_cluster_strategies)}"
      end

      if strategy == :tailscale do
        network = Keyword.get(dist, :tailscale_network)

        unless network do
          Logger.warning(
            "[Config] Tailscale cluster strategy enabled but no :tailscale_network configured"
          )
        end
      end
    end
  end

  defp validate_distribution!(_), do: :ok

  # ── Config Builder Helpers ─────────────────────────────────────────────────

  @doc """
  Build a provider config map with sensible defaults.
  Useful for runtime provider addition via ProviderRegistry.
  """
  @spec build_provider(keyword()) :: map()
  def build_provider(opts) do
    id = Keyword.fetch!(opts, :id)
    type = Keyword.fetch!(opts, :type)

    %{
      id: id,
      type: type,
      name: Keyword.get(opts, :name, id),
      accounts: Keyword.get(opts, :accounts, [%{name: "default", auth: :system}]),
      models: Keyword.get(opts, :models, default_models(type)),
      url: Keyword.get(opts, :url),
      cost_profile: Keyword.get(opts, :cost_profile, default_cost_profile(type)),
      capabilities: Keyword.get(opts, :capabilities, %{})
    }
  end

  @doc """
  Build an account config map.
  """
  @spec build_account(keyword()) :: map()
  def build_account(opts) do
    %{
      id: Keyword.get_lazy(opts, :id, &Ecto.UUID.generate/0),
      name: Keyword.fetch!(opts, :name),
      auth: Keyword.fetch!(opts, :auth),
      priority: Keyword.get(opts, :priority, 10)
    }
  end

  defp default_models(:claude_cli), do: ["opus", "sonnet", "haiku"]
  defp default_models(:codex_cli), do: ["gpt-5.2-codex"]
  defp default_models(:openrouter), do: :dynamic
  defp default_models(:ollama), do: ["llama3.3"]
  defp default_models(_), do: []

  defp default_cost_profile(:claude_cli) do
    %{opus: 0.015, sonnet: 0.003, haiku: 0.00025}
  end

  defp default_cost_profile(:codex_cli), do: %{default: 0.0}
  defp default_cost_profile(:ollama), do: %{default: 0.0}

  defp default_cost_profile(:openrouter) do
    %{input_per_1k: 0.003, output_per_1k: 0.009}
  end

  defp default_cost_profile(_), do: %{}
end
