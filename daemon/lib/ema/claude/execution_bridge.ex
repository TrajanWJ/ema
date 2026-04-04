defmodule Ema.Claude.ExecutionBridge do
  @moduledoc """
  Per-execution async dispatch supervisor.

  Wraps the existing Ema.Claude.Bridge with an async pattern:
    1. dispatch_async/2 — spawns a Bridge GenServer per execution (max 10 concurrent)
    2. run_sync/2 — backward-compat wrapper: dispatches async, waits for completion

  Each execution gets its own supervised Bridge process so one blocked
  execution cannot starve others. The DynamicSupervisor caps concurrency
  to 10 running at once.

  PubSub event flow:
    - dispatch_async broadcasts "execution_started" to "executions:{id}"
    - Bridge process broadcasts stream events to "executions:{id}:stream"
    - On completion, "execution_done" is broadcast to "executions:{id}"
  """

  require Logger

  alias Ema.Intelligence.ReflexionInjector
  alias Ema.Intelligence.SupermanRuntime
  alias Ema.Superman

  @max_concurrent 10
  @supervisor Ema.Claude.ExecutionSupervisor

  # ---------------------------------------------------------------------------
  # Public API
  # ---------------------------------------------------------------------------

  @doc """
  Dispatch a prompt asynchronously for an execution.
  Returns {:ok, execution_id} immediately. Results arrive via PubSub.

  Options:
    - :execution_id — string id for routing (generated if absent)
    - :project_path — working directory for Claude CLI
    - :model — Claude model (default: "sonnet")
    - :proposal_id — broadcasts stage updates to "proposal:<id>"
  """
  def dispatch_async(prompt, opts \\ []) when is_binary(prompt) do
    execution_id = Keyword.get(opts, :execution_id, generate_id("exec"))
    enriched_prompt = prepend_reflexion(prompt, opts)

    if at_capacity?() do
      Logger.warning(
        "[ExecutionBridge] At capacity (#{@max_concurrent} concurrent). Rejecting #{execution_id}."
      )

      {:error, :at_capacity}
    else
      bridge_opts = [
        execution_id: execution_id,
        project_path: Keyword.get(opts, :project_path, System.get_env("HOME")),
        model: Keyword.get(opts, :model, "sonnet"),
        proposal_id: Keyword.get(opts, :proposal_id),
        agent: Keyword.get(opts, :agent, "claude"),
        domain: Keyword.get(opts, :domain, "general"),
        project_slug: Keyword.get(opts, :project_slug, "default")
      ]

      case DynamicSupervisor.start_child(@supervisor, {__MODULE__.Worker, bridge_opts}) do
        {:ok, pid} ->
          Task.start(fn ->
            __MODULE__.Worker.run(pid, enriched_prompt)
          end)

          broadcast(execution_id, :execution_started, %{
            execution_id: execution_id,
            timestamp: DateTime.utc_now()
          })

          {:ok, execution_id}

        {:error, reason} ->
          Logger.error("[ExecutionBridge] Failed to start worker: #{inspect(reason)}")
          {:error, reason}
      end
    end
  end

  @doc """
  Backward-compatible synchronous wrapper.
  Dispatches async and waits for completion (up to timeout_ms).

  Replaces Ema.Claude.Runner.run/2 call sites.
  """
  def run_sync(prompt, opts \\ []) when is_binary(prompt) do
    timeout_ms = Keyword.get(opts, :timeout, 120_000)
    execution_id = Keyword.get(opts, :execution_id, generate_id("sync"))
    opts = Keyword.put(opts, :execution_id, execution_id)

    _caller = self()
    Phoenix.PubSub.subscribe(Ema.PubSub, "executions:#{execution_id}")

    case dispatch_async(prompt, opts) do
      {:ok, ^execution_id} ->
        receive do
          {:execution_event, %{type: :done, result: result}} ->
            Phoenix.PubSub.unsubscribe(Ema.PubSub, "executions:#{execution_id}")
            {:ok, result}

          {:execution_event, %{type: :error, error: reason}} ->
            Phoenix.PubSub.unsubscribe(Ema.PubSub, "executions:#{execution_id}")
            {:error, reason}
        after
          timeout_ms ->
            Phoenix.PubSub.unsubscribe(Ema.PubSub, "executions:#{execution_id}")
            {:error, %{reason: :timeout, timeout_ms: timeout_ms}}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc "Return the count of currently running execution bridges."
  def active_count do
    DynamicSupervisor.count_children(@supervisor).active
  end

  def prepend_project_intelligence(prompt, project_slug) when is_binary(prompt) do
    case Ema.Superman.KnowledgeGraph.context_for(project_slug) do
      [] ->
        prompt

      nodes ->
        intelligence =
          nodes
          |> Enum.map_join("\n\n", fn node ->
            """
            [#{node.type}] #{node.title}
            #{node.content}
            """
            |> String.trim()
          end)

        """
        Project intelligence:
        #{intelligence}

        #{prompt}
        """
        |> String.trim()
    end
  end

  def prepend_project_intelligence(prompt, _project_slug), do: prompt

  # ---------------------------------------------------------------------------
  # Private
  # ---------------------------------------------------------------------------

  defp at_capacity? do
    active_count() >= @max_concurrent
  end

  defp broadcast(execution_id, type, payload) do
    Phoenix.PubSub.broadcast(
      Ema.PubSub,
      "executions:#{execution_id}",
      {:execution_event, Map.put(payload, :type, type)}
    )
  end

  defp generate_id(prefix) do
    ts = System.system_time(:millisecond) |> Integer.to_string()
    rand = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "#{prefix}_#{ts}_#{rand}"
  end

  defp prepend_reflexion(prompt, opts) do
    prefix =
      ReflexionInjector.build_prefix(
        Keyword.get(opts, :agent, "claude"),
        Keyword.get(opts, :domain, "general"),
        Keyword.get(opts, :project_slug, "default")
      )

    prefix <> prompt
  rescue
    error ->
      Logger.warning("[ExecutionBridge] Reflexion injection failed: #{inspect(error)}")
      prompt
  end
end

defmodule Ema.Claude.ExecutionBridge.Worker do
  @moduledoc """
  A single Bridge worker for one execution.
  Spawned by ExecutionBridge.dispatch_async/2, supervised by ExecutionSupervisor.
  """

  use GenServer
  require Logger

  alias Ema.Intelligence.ReflexionStore
  alias Ema.Intelligence.SupermanRuntime

  def start_link(opts) do
    GenServer.start_link(__MODULE__, opts)
  end

  def run(pid, prompt) do
    GenServer.call(pid, {:run, prompt}, :infinity)
  end

  @impl true
  def init(opts) do
    state = %{
      execution_id: Keyword.fetch!(opts, :execution_id),
      project_path: Keyword.get(opts, :project_path, System.get_env("HOME")),
      model: Keyword.get(opts, :model, "sonnet"),
      proposal_id: Keyword.get(opts, :proposal_id),
      agent: Keyword.get(opts, :agent, "claude"),
      domain: Keyword.get(opts, :domain, "general"),
      project_slug: Keyword.get(opts, :project_slug, "default")
    }

    {:ok, state}
  end

  @impl true
  def handle_call({:run, prompt}, _from, state) do
    Logger.info("[ExecutionBridge.Worker] Running #{state.execution_id}")

    prompt = Ema.Claude.ExecutionBridge.prepend_project_intelligence(prompt, state.project_slug)
    prompt = prepend_superman_context(prompt, state.project_slug)

    result =
      Ema.Claude.Bridge.run(prompt,
        model: state.model,
        proposal_id: state.proposal_id,
        agent_id: state.agent,
        task_type: state.domain
      )

    record_reflexion(state, result)

    event_type = if match?({:ok, _}, result), do: :done, else: :error

    payload =
      case result do
        {:ok, data} -> %{type: event_type, execution_id: state.execution_id, result: data}
        {:error, reason} -> %{type: event_type, execution_id: state.execution_id, error: reason}
      end

    Phoenix.PubSub.broadcast(
      Ema.PubSub,
      "executions:#{state.execution_id}",
      {:execution_event, payload}
    )

    {:reply, result, state}
  end

  defp prepend_superman_context(prompt, project_slug) do
    case Ema.Projects.get_project_by_slug(project_slug) do
      nil ->
        prompt

      project ->
        case SupermanRuntime.context_for(project) do
          {:ok, ctx} ->
            formatted = SupermanRuntime.format_for_prompt(ctx)

            if formatted != "" do
              Logger.info("[ExecutionBridge] Superman context injected for #{project_slug}")
              formatted <> "\n\n" <> prompt
            else
              prompt
            end

          {:error, _} ->
            prompt
        end
    end
  rescue
    error ->
      Logger.warning("[ExecutionBridge] Superman context injection failed: #{inspect(error)}")
      prompt
  end

  defp record_reflexion(state, {:ok, data}) do
    summary = extract_result_summary(data)
    lesson = extract_lesson(summary)

    case ReflexionStore.record(state.agent, state.domain, state.project_slug, lesson, "success") do
      {:ok, _} ->
        :ok

      {:error, :empty_lesson} ->
        :ok

      {:error, reason} ->
        Logger.warning(
          "[ExecutionBridge.Worker] Failed to store reflexion lesson: #{inspect(reason)}"
        )
    end
  end

  defp record_reflexion(state, {:error, reason}) do
    lesson =
      case reason do
        %{message: message} when is_binary(message) -> message
        message when is_binary(message) -> message
        _ -> inspect(reason)
      end

    case ReflexionStore.record(state.agent, state.domain, state.project_slug, lesson, "failed") do
      {:ok, _} ->
        :ok

      {:error, :empty_lesson} ->
        :ok

      {:error, error} ->
        Logger.warning(
          "[ExecutionBridge.Worker] Failed to store failed reflexion lesson: #{inspect(error)}"
        )
    end
  end

  defp extract_result_summary(%{"summary" => summary}) when is_binary(summary), do: summary
  defp extract_result_summary(%{"result" => result}) when is_binary(result), do: result
  defp extract_result_summary(%{summary: summary}) when is_binary(summary), do: summary
  defp extract_result_summary(%{result: result}) when is_binary(result), do: result
  defp extract_result_summary(result) when is_binary(result), do: result
  defp extract_result_summary(result), do: inspect(result)

  defp extract_lesson(summary) do
    cleaned =
      summary
      |> String.replace(~r/```.*?```/s, "")
      |> String.split("\n")
      |> Enum.map(&String.trim/1)
      |> Enum.reject(&(&1 == ""))

    lesson_line =
      Enum.find_value(cleaned, fn line ->
        case Regex.run(~r/^(?:[-*]\s*)?(?:key\s+)?lessons?\s*(?:learned)?\s*:\s*(.+)$/i, line) do
          [_, lesson] -> normalize_line(lesson)
          _ -> nil
        end
      end) || Enum.find_value(cleaned, &normalize_line/1) || ""

    String.slice(lesson_line, 0, 2_000)
  end

  defp normalize_line(line) do
    normalized =
      line
      |> String.replace_prefix("- ", "")
      |> String.replace_prefix("* ", "")
      |> String.replace_prefix("# ", "")
      |> String.trim()

    if normalized == "", do: nil, else: normalized
  end
end
