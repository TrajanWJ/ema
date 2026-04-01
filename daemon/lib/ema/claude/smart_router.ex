defmodule Ema.Claude.SmartRouter do
  @moduledoc """
  Routes AI tasks to the best provider + account + model combination.

  Implements multiple routing strategies and task classification.
  Acts as the single entry point for executing AI work — callers
  don't need to know which backend runs their request.

  ## Routing Strategies

  - `:cheapest`     — minimize cost (Ollama > Haiku > Sonnet > Opus)
  - `:fastest`      — minimize latency (prefer lowest measured latency)
  - `:best`         — highest capability match for the task type
  - `:balanced`     — weighted score of cost + speed + quality (default)
  - `:round_robin`  — distribute evenly across available providers
  - `:failover`     — try primary, fall through to secondaries

  ## Task Types

  - `:code_generation` — prefer Codex or Claude with code tools
  - `:code_review`     — prefer Claude (reasoning)
  - `:summarization`   — Haiku or Ollama (cheap, fast)
  - `:research`        — Claude (web tools) or Perplexity
  - `:creative`        — Opus (quality matters)
  - `:bulk`            — cheapest available
  - `:general`         — balanced selection (default)

  ## Usage

      # Route and get the best target
      {:ok, target} = SmartRouter.route("explain this code", :code_review)
      # => %{provider_id: "claude-personal", account_id: "...", model: "sonnet"}

      # Route + execute in one call (preferred)
      {:ok, result} = SmartRouter.execute("summarize this doc", :summarization)

      # Estimate cost before running
      {:ok, estimates} = SmartRouter.estimate_cost("write a function", :code_generation)
  """

  use GenServer
  require Logger

  alias Ema.Claude.{ProviderRegistry, AccountManager}

  @default_strategy :balanced
  @round_robin_key :smart_router_rr_counter

  # Weights for balanced scoring (lower score = better)
  @balanced_weights %{cost: 0.35, latency: 0.35, quality: 0.30}

  # Model quality tiers — higher = better quality
  @quality_tiers %{
    "opus" => 1.0,
    "claude-opus-4" => 1.0,
    "claude-opus-4-5" => 1.0,
    "claude-opus-3" => 0.95,
    "gpt-5.2-codex" => 0.9,
    "codex" => 0.9,
    "sonnet" => 0.8,
    "claude-sonnet-4" => 0.8,
    "claude-sonnet-3-5" => 0.75,
    "haiku" => 0.6,
    "claude-haiku-3-5" => 0.6,
    "llama3.3" => 0.5,
    "codestral" => 0.55,
    "deepseek-coder-v2" => 0.6,
    "default" => 0.5
  }

  defmodule RouteTarget do
    @moduledoc "The resolved destination for an AI task."
    @enforce_keys [:provider_id, :account_id, :model, :adapter_module]
    defstruct [
      :provider_id,
      :account_id,
      :model,
      :adapter_module,
      :strategy,
      :task_type,
      :estimated_cost_usd,
      :estimated_latency_ms,
      :quality_score,
      :routing_reason
    ]
  end

  # ── Client API ─────────────────────────────────────────────────────────────

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc """
  Route a prompt to the best provider + account + model.

  Returns a `RouteTarget` with everything needed to execute the call.

  ## Options
    - `:strategy`  — override default routing strategy
    - `:task_type` — override auto-detected task type
    - `:model`     — force a specific model (skips model selection)
    - `:provider_id` — force a specific provider
    - `:exclude_providers` — list of provider IDs to skip
  """
  @spec route(String.t(), atom(), keyword()) ::
          {:ok, RouteTarget.t()} | {:error, term()}
  def route(prompt, task_type \\ :general, opts \\ []) do
    GenServer.call(__MODULE__, {:route, prompt, task_type, opts})
  end

  @doc """
  Route + execute in one call.

  Equivalent to `route/3` followed by adapter execution.
  Handles failover automatically if primary route fails.

  ## Options
    Same as `route/3`, plus:
    - `:on_event`  — event callback for streaming
    - `:timeout`   — execution timeout in ms
  """
  @spec execute(String.t(), atom(), keyword()) ::
          {:ok, map()} | {:error, term()}
  def execute(prompt, task_type \\ :general, opts \\ []) do
    GenServer.call(
      __MODULE__,
      {:execute, prompt, task_type, opts},
      Keyword.get(opts, :timeout, 300_000)
    )
  end

  @doc """
  Classify a prompt's task type automatically.

  Uses keyword matching and heuristics. Returns one of:
  `:code_generation`, `:code_review`, `:summarization`,
  `:research`, `:creative`, `:bulk`, `:general`
  """
  @spec classify_task(String.t()) :: atom()
  def classify_task(prompt) do
    classify_task_type(prompt)
  end

  @doc """
  Estimate cost for a prompt across all available providers.

  Returns a list of `{provider_id, model, estimated_usd}` sorted cheapest first.
  Estimates are based on ~1.3x prompt token count heuristic for output.
  """
  @spec estimate_cost(String.t(), atom()) :: {:ok, [map()]} | {:error, term()}
  def estimate_cost(prompt, task_type \\ :general) do
    GenServer.call(__MODULE__, {:estimate_cost, prompt, task_type})
  end

  @doc """
  Get current routing statistics.
  """
  @spec stats() :: map()
  def stats do
    GenServer.call(__MODULE__, :stats)
  end

  # ── GenServer callbacks ────────────────────────────────────────────────────

  @impl true
  def init(opts) do
    strategy =
      Keyword.get(opts, :default_strategy) ||
        Application.get_env(:ema, Ema.Claude, [])
        |> Keyword.get(:default_strategy, @default_strategy)

    {:ok,
     %{
       default_strategy: strategy,
       stats: %{
         total_routes: 0,
         successful_routes: 0,
         failed_routes: 0,
         failovers: 0,
         routes_by_strategy: %{},
         routes_by_task_type: %{}
       },
       round_robin_counters: %{}
     }}
  end

  @impl true
  def handle_call({:route, prompt, task_type, opts}, _from, state) do
    strategy = Keyword.get(opts, :strategy, state.default_strategy)
    effective_task_type = Keyword.get(opts, :task_type, task_type)

    result = do_route(prompt, effective_task_type, strategy, opts)

    state = update_route_stats(state, strategy, effective_task_type, result)
    {:reply, result, state}
  end

  @impl true
  def handle_call({:execute, prompt, task_type, opts}, _from, state) do
    strategy = Keyword.get(opts, :strategy, state.default_strategy)
    effective_task_type = Keyword.get(opts, :task_type, task_type)
    max_failovers = Keyword.get(opts, :max_failovers, 2)

    result =
      do_execute_with_failover(
        prompt,
        effective_task_type,
        strategy,
        opts,
        max_failovers,
        [],
        state
      )

    state = update_route_stats(state, strategy, effective_task_type, result)
    {:reply, result, state}
  end

  @impl true
  def handle_call({:estimate_cost, prompt, task_type}, _from, state) do
    estimates = build_cost_estimates(prompt, task_type)
    {:reply, {:ok, estimates}, state}
  end

  @impl true
  def handle_call(:stats, _from, state) do
    {:reply, state.stats, state}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  # ── Routing logic ──────────────────────────────────────────────────────────

  defp do_route(prompt, task_type, strategy, opts) do
    exclude = Keyword.get(opts, :exclude_providers, [])
    forced_provider = Keyword.get(opts, :provider_id)
    forced_model = Keyword.get(opts, :model)

    # Get candidate providers
    candidates = get_candidates(task_type, forced_provider, exclude)

    case candidates do
      [] ->
        {:error, :no_providers_available}

      providers ->
        case select_by_strategy(providers, strategy, task_type, opts) do
          {:ok, provider} ->
            case AccountManager.get_best_account(provider.id) do
              {:ok, account} ->
                model = forced_model || select_model(provider, task_type)
                adapter = provider.adapter_module || ProviderRegistry.adapter_for(provider.type)

                target = %RouteTarget{
                  provider_id: provider.id,
                  account_id: account.id,
                  model: model,
                  adapter_module: adapter,
                  strategy: strategy,
                  task_type: task_type,
                  estimated_cost_usd: estimate_single_cost(prompt, provider, model),
                  estimated_latency_ms: get_provider_latency(provider),
                  quality_score: get_model_quality(model),
                  routing_reason: build_routing_reason(strategy, task_type, provider, model)
                }

                Logger.debug(
                  "[SmartRouter] Routed #{task_type} → #{provider.id}/#{model} via #{strategy}"
                )

                {:ok, target}

              {:error, reason} ->
                {:error, {:no_account, provider.id, reason}}
            end

          {:error, reason} ->
            {:error, reason}
        end
    end
  end

  defp do_execute_with_failover(prompt, task_type, strategy, opts, max_failovers, excluded, state) do
    exclude = Keyword.get(opts, :exclude_providers, []) ++ excluded
    route_opts = Keyword.put(opts, :exclude_providers, exclude)

    case do_route(prompt, task_type, strategy, route_opts) do
      {:ok, target} ->
        case execute_via_adapter(prompt, target, opts) do
          {:ok, result} ->
            AccountManager.record_success(target.account_id)
            AccountManager.record_usage(target.account_id, extract_usage(result))
            {:ok, Map.put(result, :route, target)}

          {:error, {:rate_limited, reset_at}} ->
            AccountManager.rotate_on_limit(target.account_id, reset_at: reset_at)

            if max_failovers > 0 do
              Logger.warning("[SmartRouter] Rate limited on #{target.provider_id}, failing over")
              # suppress unused warning
              _ = state

              do_execute_with_failover(
                prompt,
                task_type,
                strategy,
                opts,
                max_failovers - 1,
                [target.provider_id | excluded],
                state
              )
            else
              {:error, :all_providers_rate_limited}
            end

          {:error, reason} ->
            AccountManager.record_error(target.account_id, reason)

            if max_failovers > 0 do
              Logger.warning(
                "[SmartRouter] Execution failed on #{target.provider_id}: #{inspect(reason)}, failing over"
              )

              do_execute_with_failover(
                prompt,
                task_type,
                strategy,
                opts,
                max_failovers - 1,
                [target.provider_id | excluded],
                state
              )
            else
              {:error, reason}
            end
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp execute_via_adapter(_prompt, %RouteTarget{adapter_module: nil}, _opts) do
    {:error, :no_adapter}
  end

  defp execute_via_adapter(prompt, target, opts) do
    session_id = Ecto.UUID.generate()
    on_event = Keyword.get(opts, :on_event)
    timeout = Keyword.get(opts, :timeout, 300_000)

    try do
      with {:ok, session} <-
             target.adapter_module.start_session(
               prompt,
               session_id,
               target.model,
               Keyword.merge(opts, account_id: target.account_id)
             ),
           {:ok, result} <- wait_for_completion(session, target, on_event, timeout) do
        {:ok, result}
      end
    rescue
      e -> {:error, Exception.message(e)}
    end
  end

  defp wait_for_completion(session, target, on_event, timeout) do
    # Poll session for completion — adapter-specific
    # Adapters should send messages back via the calling process
    ref = make_ref()
    pid = self()

    Task.start(fn ->
      result =
        do_wait_loop(session, target.adapter_module, on_event, %{
          text: "",
          tool_calls: [],
          input_tokens: 0,
          output_tokens: 0
        })

      send(pid, {:session_done, ref, result})
    end)

    receive do
      {:session_done, ^ref, result} -> result
    after
      timeout -> {:error, :execution_timeout}
    end
  end

  defp do_wait_loop(session, adapter, on_event, acc) do
    receive do
      {:adapter_event, event} ->
        if on_event, do: on_event.(event)

        acc =
          case event do
            %{type: "text", content: text} ->
              %{acc | text: acc.text <> text}

            %{type: "tool_use", name: name, input: input} ->
              %{acc | tool_calls: acc.tool_calls ++ [%{name: name, input: input}]}

            %{type: "usage", input_tokens: it, output_tokens: ot} ->
              %{acc | input_tokens: it || 0, output_tokens: ot || 0}

            _ ->
              acc
          end

        do_wait_loop(session, adapter, on_event, acc)

      {:adapter_done, result} ->
        {:ok, Map.merge(acc, %{exit_code: Map.get(result, :exit_code, 0)})}

      {:adapter_error, reason} ->
        {:error, reason}
    after
      300_000 -> {:error, :wait_timeout}
    end
  end

  # ── Strategy selection ─────────────────────────────────────────────────────

  defp get_candidates(task_type, forced_provider, exclude) do
    providers =
      if forced_provider do
        case ProviderRegistry.get(forced_provider) do
          {:ok, p} -> [p]
          _ -> []
        end
      else
        ProviderRegistry.list_available()
      end

    providers
    |> Enum.reject(&(&1.id in exclude))
    |> filter_by_task_requirements(task_type)
  end

  defp filter_by_task_requirements(providers, task_type) do
    case task_requirements(task_type) do
      [] ->
        providers

      requirements ->
        Enum.filter(providers, fn p ->
          Enum.all?(requirements, fn req ->
            Map.get(p.capabilities, req, false)
          end)
        end)
        |> case do
          # Fall back to all if no capable provider
          [] -> providers
          filtered -> filtered
        end
    end
  end

  defp task_requirements(:code_generation), do: [:code_execution]
  defp task_requirements(:code_review), do: []
  defp task_requirements(:research), do: []
  defp task_requirements(_), do: []

  defp select_by_strategy(providers, :cheapest, task_type, _opts) do
    sorted =
      Enum.sort_by(providers, fn p ->
        model = select_model(p, task_type)
        cost_for_model(p, model)
      end)

    {:ok, hd(sorted)}
  end

  defp select_by_strategy(providers, :fastest, _task_type, _opts) do
    sorted =
      Enum.sort_by(providers, fn p ->
        p.health[:latency_ms] || 9999
      end)

    {:ok, hd(sorted)}
  end

  defp select_by_strategy(providers, :best, task_type, _opts) do
    sorted =
      Enum.sort_by(providers, fn p ->
        model = select_model(p, task_type)
        # Higher quality = lower sort score (we want best first)
        -(get_model_quality(model) * task_quality_weight(task_type, p.type))
      end)

    {:ok, hd(sorted)}
  end

  defp select_by_strategy(providers, :balanced, task_type, _opts) do
    scored =
      Enum.map(providers, fn p ->
        model = select_model(p, task_type)
        {p, balanced_score(p, model, task_type)}
      end)

    {best, _score} = Enum.min_by(scored, &elem(&1, 1))
    {:ok, best}
  end

  defp select_by_strategy(providers, :round_robin, _task_type, _opts) do
    # Use process dictionary for simple counter (GenServer state would be better but this avoids a second call)
    counter = Process.get(@round_robin_key, 0)
    Process.put(@round_robin_key, counter + 1)
    provider = Enum.at(providers, rem(counter, length(providers)))
    {:ok, provider}
  end

  defp select_by_strategy(providers, :failover, _task_type, _opts) do
    # Primary = highest priority (lowest priority number)
    sorted =
      Enum.sort_by(providers, fn p ->
        p.health[:error_rate] || 0.0
      end)

    {:ok, hd(sorted)}
  end

  defp select_by_strategy(providers, _unknown, task_type, opts) do
    select_by_strategy(providers, :balanced, task_type, opts)
  end

  # ── Model selection ────────────────────────────────────────────────────────

  defp select_model(%{type: type, capabilities: caps}, task_type) do
    models = Map.get(caps, :models, [])

    preferred = task_preferred_models(task_type, type)

    # Find first model from preferred list that's available
    case Enum.find(preferred, fn m -> m in models end) do
      nil -> List.first(models) || "default"
      model -> model
    end
  end

  defp task_preferred_models(:code_generation, :claude_cli),
    do: ["opus", "claude-opus-4", "sonnet", "claude-sonnet-4"]

  defp task_preferred_models(:code_generation, :codex_cli),
    do: ["gpt-5.2-codex", "codex"]

  defp task_preferred_models(:code_generation, :ollama),
    do: ["codestral", "deepseek-coder-v2", "llama3.3"]

  defp task_preferred_models(:code_generation, _),
    do: ["opus", "sonnet", "codex"]

  defp task_preferred_models(:code_review, _),
    do: ["opus", "claude-opus-4", "sonnet", "claude-sonnet-4"]

  defp task_preferred_models(:summarization, :ollama),
    do: ["llama3.3", "codestral"]

  defp task_preferred_models(:summarization, _),
    do: ["haiku", "claude-haiku-3-5", "sonnet"]

  defp task_preferred_models(:research, :openclaw),
    do: ["sonnet", "opus"]

  defp task_preferred_models(:research, _),
    do: ["opus", "claude-opus-4", "sonnet"]

  defp task_preferred_models(:creative, _),
    do: ["opus", "claude-opus-4"]

  defp task_preferred_models(:bulk, :ollama),
    do: ["llama3.3", "codestral"]

  defp task_preferred_models(:bulk, _),
    do: ["haiku", "claude-haiku-3-5", "sonnet"]

  defp task_preferred_models(_, _),
    do: ["sonnet", "claude-sonnet-4", "haiku"]

  # ── Task classification ────────────────────────────────────────────────────

  defp classify_task_type(prompt) do
    lower = String.downcase(prompt)

    cond do
      matches_any?(lower, [
        "write code",
        "implement",
        "create function",
        "build a",
        "generate a class",
        "write a test",
        "fix this bug",
        "debug",
        "refactor"
      ]) ->
        :code_generation

      matches_any?(lower, [
        "review this code",
        "analyze this code",
        "what does this code",
        "explain this function",
        "code review",
        "is this correct"
      ]) ->
        :code_review

      matches_any?(lower, ["summarize", "summary of", "tldr", "condense", "brief overview"]) ->
        :summarization

      matches_any?(lower, [
        "research",
        "find information about",
        "what is",
        "explain",
        "look up",
        "search for"
      ]) ->
        :research

      matches_any?(lower, [
        "write a story",
        "creative",
        "poem",
        "essay",
        "brainstorm",
        "come up with ideas"
      ]) ->
        :creative

      matches_any?(lower, ["process all", "batch", "for each", "bulk"]) ->
        :bulk

      true ->
        :general
    end
  end

  defp matches_any?(text, patterns) do
    Enum.any?(patterns, &String.contains?(text, &1))
  end

  # ── Scoring helpers ────────────────────────────────────────────────────────

  defp balanced_score(provider, model, task_type) do
    cost = normalize_cost(cost_for_model(provider, model))
    latency = normalize_latency(provider.health[:latency_ms] || 500)
    quality = 1.0 - get_model_quality(model) * task_quality_weight(task_type, provider.type)

    @balanced_weights.cost * cost +
      @balanced_weights.latency * latency +
      @balanced_weights.quality * quality
  end

  defp cost_for_model(provider, model) do
    profile = provider.cost_profile || %{}

    cond do
      Map.has_key?(profile, String.to_atom(model)) ->
        Map.get(profile, String.to_atom(model))

      Map.has_key?(profile, :default) ->
        Map.get(profile, :default)

      true ->
        # default sonnet pricing
        Map.get(profile, :input_per_1k, 0.003)
    end
  end

  defp normalize_cost(cost) when cost == 0.0, do: 0.0

  defp normalize_cost(cost) do
    # Normalize against Opus pricing (0.015 per 1k) as max
    min(cost / 0.015, 1.0)
  end

  defp normalize_latency(nil), do: 0.5

  defp normalize_latency(ms) do
    # Normalize against 5000ms as "slow"
    min(ms / 5000, 1.0)
  end

  defp get_model_quality(model) do
    # Check exact match first, then partial match
    case Map.get(@quality_tiers, model) do
      nil ->
        match =
          Enum.find_value(@quality_tiers, fn {k, v} ->
            if String.contains?(String.downcase(model || ""), k), do: v
          end)

        match || 0.5

      quality ->
        quality
    end
  end

  defp task_quality_weight(:creative, _), do: 1.2
  defp task_quality_weight(:code_generation, :codex_cli), do: 1.3
  defp task_quality_weight(:code_review, _), do: 1.1
  defp task_quality_weight(:bulk, _), do: 0.5
  defp task_quality_weight(:summarization, _), do: 0.7
  defp task_quality_weight(_, _), do: 1.0

  defp get_provider_latency(%{health: %{latency_ms: ms}}) when is_integer(ms), do: ms
  defp get_provider_latency(_), do: nil

  # ── Cost estimation ────────────────────────────────────────────────────────

  defp build_cost_estimates(prompt, task_type) do
    input_tokens = estimate_tokens(prompt)
    # rough estimate
    output_tokens = round(input_tokens * 1.3)

    ProviderRegistry.list_available()
    |> Enum.flat_map(fn provider ->
      models = provider.capabilities[:models] || []
      preferred = [select_model(provider, task_type)]
      all_models = Enum.uniq(preferred ++ Enum.take(models, 3))

      Enum.map(all_models, fn model ->
        input_cost = cost_for_model(provider, model) * input_tokens / 1000

        output_cost =
          (provider.cost_profile[:output_per_1k] ||
             cost_for_model(provider, model) * 3) * output_tokens / 1000

        %{
          provider_id: provider.id,
          provider_type: provider.type,
          model: model,
          estimated_input_tokens: input_tokens,
          estimated_output_tokens: output_tokens,
          estimated_input_cost_usd: Float.round(input_cost, 6),
          estimated_output_cost_usd: Float.round(output_cost, 6),
          estimated_total_cost_usd: Float.round(input_cost + output_cost, 6)
        }
      end)
    end)
    |> Enum.sort_by(& &1.estimated_total_cost_usd)
  end

  defp estimate_single_cost(prompt, provider, model) do
    input_tokens = estimate_tokens(prompt)
    output_tokens = round(input_tokens * 1.3)
    input_cost = cost_for_model(provider, model) * input_tokens / 1000

    output_cost =
      (provider.cost_profile[:output_per_1k] ||
         cost_for_model(provider, model) * 3) * output_tokens / 1000

    Float.round(input_cost + output_cost, 6)
  end

  defp estimate_tokens(text) when is_binary(text) do
    # Rough approximation: ~4 chars per token
    div(byte_size(text), 4)
  end

  defp estimate_tokens(_), do: 100

  defp extract_usage(%{input_tokens: it, output_tokens: ot, cost: cost}) do
    %{
      input_tokens: it || 0,
      output_tokens: ot || 0,
      cost_usd: cost || 0.0
    }
  end

  defp extract_usage(_), do: %{input_tokens: 0, output_tokens: 0, cost_usd: 0.0}

  defp build_routing_reason(strategy, task_type, provider, model) do
    "#{strategy} routing for #{task_type} → #{provider.type}/#{model}"
  end

  defp update_route_stats(state, strategy, task_type, result) do
    stats = state.stats
    strategy_key = to_string(strategy)
    task_key = to_string(task_type)

    stats = %{
      stats
      | total_routes: stats.total_routes + 1,
        successful_routes: stats.successful_routes + if(match?({:ok, _}, result), do: 1, else: 0),
        failed_routes: stats.failed_routes + if(match?({:error, _}, result), do: 1, else: 0),
        routes_by_strategy: Map.update(stats.routes_by_strategy, strategy_key, 1, &(&1 + 1)),
        routes_by_task_type: Map.update(stats.routes_by_task_type, task_key, 1, &(&1 + 1))
    }

    %{state | stats: stats}
  end
end
