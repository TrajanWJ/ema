defmodule Ema.Projects.ProjectWorker do
  @moduledoc """
  GenServer managing project context generation and caching.
  One worker per project, started on demand via DynamicSupervisor.

  The context doc is regenerated at most once every 30 minutes,
  serving cached content between regenerations to keep dispatch fast.
  """

  use GenServer, restart: :temporary
  require Logger

  alias Ema.Projects.ContextDoc

  @cache_ttl_ms 30 * 60 * 1_000  # 30 minutes

  # ── Public API ───────────────────────────────────────────────────────────────

  @doc """
  Get (or start + get) the context document for a project.
  Returned as `{:ok, markdown}` or `{:error, reason}`.
  """
  def get_context(project_id) when is_binary(project_id) do
    worker = ensure_started(project_id)
    GenServer.call(worker, :get_context, 15_000)
  end

  @doc """
  Invalidate the cache for a project (forces regeneration on next call).
  Safe to call even if worker is not started.
  """
  def invalidate(project_id) when is_binary(project_id) do
    case Registry.lookup(Ema.Projects.WorkerRegistry, project_id) do
      [{pid, _}] -> GenServer.cast(pid, :invalidate)
      [] -> :ok
    end
  end

  @doc "Return child spec for DynamicSupervisor."
  def child_spec(project_id) do
    %{
      id: {__MODULE__, project_id},
      start: {__MODULE__, :start_link, [project_id]},
      restart: :temporary
    }
  end

  def start_link(project_id) do
    GenServer.start_link(__MODULE__, project_id,
      name: {:via, Registry, {Ema.Projects.WorkerRegistry, project_id}}
    )
  end

  # ── GenServer callbacks ──────────────────────────────────────────────────────

  @impl true
  def init(project_id) do
    Logger.debug("[ProjectWorker] Started for #{project_id}")
    state = %{
      project_id: project_id,
      context_doc_cache: nil,
      last_generated_at: nil
    }
    {:ok, state}
  end

  @impl true
  def handle_call(:get_context, _from, state) do
    case maybe_regenerate(state) do
      {:ok, new_state} ->
        {:reply, {:ok, new_state.context_doc_cache}, new_state}

      {:error, reason, new_state} ->
        {:reply, {:error, reason}, new_state}
    end
  end

  @impl true
  def handle_cast(:invalidate, state) do
    Logger.debug("[ProjectWorker] Cache invalidated for #{state.project_id}")
    {:noreply, %{state | context_doc_cache: nil, last_generated_at: nil}}
  end

  # ── Private ──────────────────────────────────────────────────────────────────

  defp maybe_regenerate(state) do
    if cache_fresh?(state) do
      {:ok, state}
    else
      Logger.debug("[ProjectWorker] Generating context for #{state.project_id}")

      case ContextDoc.generate(state.project_id) do
        {:ok, doc} ->
          new_state = %{state |
            context_doc_cache: doc,
            last_generated_at: System.monotonic_time(:millisecond)
          }
          {:ok, new_state}

        {:error, reason} ->
          Logger.warning("[ProjectWorker] Failed to generate context for #{state.project_id}: #{inspect(reason)}")
          # Return error but preserve old cache if any
          {:error, reason, state}
      end
    end
  end

  defp cache_fresh?(%{context_doc_cache: nil}), do: false
  defp cache_fresh?(%{last_generated_at: nil}), do: false

  defp cache_fresh?(%{last_generated_at: ts}) do
    now = System.monotonic_time(:millisecond)
    now - ts < @cache_ttl_ms
  end

  defp ensure_started(project_id) do
    case Registry.lookup(Ema.Projects.WorkerRegistry, project_id) do
      [{pid, _}] ->
        pid

      [] ->
        case DynamicSupervisor.start_child(
               Ema.Projects.ProjectWorkerSupervisor,
               child_spec(project_id)
             ) do
          {:ok, pid} -> pid
          {:error, {:already_started, pid}} -> pid
          {:error, reason} ->
            raise "Failed to start ProjectWorker for #{project_id}: #{inspect(reason)}"
        end
    end
  end
end
