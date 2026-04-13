defmodule Ema.Intelligence.ContextTrace do
  @moduledoc """
  Reproducibility log for relevance-based context selection.

  Each context build emits a trace describing:
    - the focus terms used for scoring
    - the budget allocated to each section
    - the items selected per section, with their relevance components
    - which items were pinned (must-include)
    - the total tokens used vs budget

  Traces are kept in memory (last 200 builds) and optionally persisted to
  `~/.local/share/ema/traces/<id>.json` for debugging via
  `ema context inspect <id>`.

  This module is best-effort. Tracing failures must never break a prompt.
  """

  use GenServer
  require Logger

  @table __MODULE__
  @max_in_memory 200

  # ── Public API ─────────────────────────────────────────────────────────────

  def start_link(_opts \\ []) do
    GenServer.start_link(__MODULE__, [], name: __MODULE__)
  end

  @doc """
  Record a trace for a single context build.

  `attrs` keys:
    - `:id`        — caller-provided id (execution id, prompt id, etc.)
    - `:source`    — module that built the context (e.g. ContextManager)
    - `:focus`     — focus map used for scoring
    - `:budget`    — total token budget
    - `:allocations` — `%{section => tokens}` map from ContextBudget.allocate/1
    - `:sections`  — `%{section => [items]}` of selected items
    - `:tokens_used` — actual tokens consumed (estimate)
  """
  def record(attrs) when is_map(attrs) do
    id = Map.get(attrs, :id) || generate_id()
    trace = build_trace(id, attrs)

    if table?() do
      :ets.insert(@table, {id, trace})
      maybe_evict_oldest()
    end

    persist_async(trace)
    {:ok, id}
  rescue
    e ->
      Logger.debug("[ContextTrace] record failed: #{Exception.message(e)}")
      {:error, Exception.message(e)}
  end

  @doc "Fetch a trace by id from memory or disk."
  def fetch(id) do
    case in_memory(id) do
      {:ok, trace} -> {:ok, trace}
      :miss -> read_from_disk(id)
    end
  end

  @doc "List the most recent traces (default 20)."
  def list_recent(limit \\ 20) do
    if table?() do
      :ets.tab2list(@table)
      |> Enum.map(fn {_id, trace} -> trace end)
      |> Enum.sort_by(& &1.recorded_at, {:desc, DateTime})
      |> Enum.take(limit)
    else
      []
    end
  end

  # ── GenServer ──────────────────────────────────────────────────────────────

  @impl true
  def init(_) do
    :ets.new(@table, [:set, :public, :named_table])
    File.mkdir_p(trace_dir())
    {:ok, %{}}
  end

  @impl true
  def handle_info(_, state), do: {:noreply, state}

  # ── Private ────────────────────────────────────────────────────────────────

  defp build_trace(id, attrs) do
    %{
      id: id,
      source: Map.get(attrs, :source, "unknown"),
      focus: sanitize_focus(Map.get(attrs, :focus, %{})),
      budget: Map.get(attrs, :budget, 0),
      allocations: Map.get(attrs, :allocations, %{}),
      sections: summarize_sections(Map.get(attrs, :sections, %{})),
      tokens_used: Map.get(attrs, :tokens_used, 0),
      recorded_at: DateTime.utc_now()
    }
  end

  defp sanitize_focus(focus) do
    %{
      terms: Map.get(focus, :terms, []),
      focus_id: Map.get(focus, :focus_id),
      weights: Map.get(focus, :weights)
    }
  end

  defp summarize_sections(sections) when is_map(sections) do
    Map.new(sections, fn {key, items} ->
      {key,
       Enum.map(List.wrap(items), fn item ->
         %{
           id: Map.get(item, :id),
           title: Map.get(item, :title) || Map.get(item, :name),
           relevance: Map.get(item, :relevance),
           components: Map.get(item, :relevance_components),
           tokens: Ema.Intelligence.ContextBudget.estimate_item_tokens(item),
           pinned: Map.get(item, :pinned, false),
           truncated: Map.get(item, :truncated, false)
         }
       end)}
    end)
  end

  defp summarize_sections(_), do: %{}

  defp in_memory(id) do
    if table?() do
      case :ets.lookup(@table, id) do
        [{^id, trace}] -> {:ok, trace}
        _ -> :miss
      end
    else
      :miss
    end
  end

  defp read_from_disk(id) do
    path = Path.join(trace_dir(), "#{id}.json")

    case File.read(path) do
      {:ok, raw} ->
        case Jason.decode(raw) do
          {:ok, trace} -> {:ok, trace}
          err -> err
        end

      {:error, _} ->
        {:error, :not_found}
    end
  end

  defp persist_async(trace) do
    Task.start(fn ->
      try do
        path = Path.join(trace_dir(), "#{trace.id}.json")
        File.write(path, Jason.encode!(trace, pretty: true))
      rescue
        e -> Logger.debug("[ContextTrace] persist failed: #{Exception.message(e)}")
      end
    end)
  end

  defp maybe_evict_oldest do
    size = :ets.info(@table, :size)

    if is_integer(size) and size > @max_in_memory do
      to_drop = size - @max_in_memory

      :ets.tab2list(@table)
      |> Enum.sort_by(fn {_id, trace} -> trace.recorded_at end, {:asc, DateTime})
      |> Enum.take(to_drop)
      |> Enum.each(fn {id, _} -> :ets.delete(@table, id) end)
    end
  end

  defp trace_dir do
    Path.join([System.user_home!(), ".local", "share", "ema", "traces"])
  end

  defp generate_id do
    "trace_" <>
      (System.system_time(:millisecond) |> Integer.to_string()) <>
      "_" <> (:crypto.strong_rand_bytes(3) |> Base.encode16(case: :lower))
  end

  defp table? do
    :ets.whereis(@table) != :undefined
  end
end
