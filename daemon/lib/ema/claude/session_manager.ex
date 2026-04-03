defmodule Ema.Claude.SessionManager do
  @moduledoc """
  GenServer tracking AI conversation sessions with cost, token usage,
  and resume/fork support. Persists to SQLite via Ecto.

  Sessions are created when a Bridge starts streaming, updated as tokens
  flow, and completed when the stream ends. Supports forking a session
  from a specific message to create a branch.
  """

  use GenServer
  require Logger

  alias Ema.Repo
  alias Ema.Claude.AiSession
  alias Ema.Claude.AiSessionMessage
  alias Ema.Core.DccPrimitive
  alias Ema.Persistence.SessionStore

  import Ecto.Query

  # Cost per 1M tokens (USD) — approximate, update as pricing changes
  @cost_per_million %{
    "opus" => %{input: 15.0, output: 75.0},
    "sonnet" => %{input: 3.0, output: 15.0},
    "haiku" => %{input: 0.25, output: 1.25}
  }

  # --- Public API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc "Create a new session, optionally linked to an agent."
  def create_session(opts \\ %{}) do
    GenServer.call(__MODULE__, {:create, opts})
  end

  @doc "Resume an existing session by id."
  def resume_session(session_id) do
    GenServer.call(__MODULE__, {:resume, session_id})
  end

  @doc "Fork a session from a specific message, creating a new branch."
  def fork_session(session_id, message_id) do
    GenServer.call(__MODULE__, {:fork, session_id, message_id})
  end

  @doc "Record a message in a session."
  def add_message(session_id, role, content, opts \\ %{}) do
    GenServer.call(__MODULE__, {:add_message, session_id, role, content, opts})
  end

  @doc "Update token counts and cost for a session."
  def record_tokens(session_id, input_tokens, output_tokens) do
    GenServer.cast(__MODULE__, {:record_tokens, session_id, input_tokens, output_tokens})
  end

  @doc "Mark a session as completed."
  def complete_session(session_id) do
    GenServer.cast(__MODULE__, {:complete, session_id})
  end

  @doc "Mark a session as errored."
  def error_session(session_id) do
    GenServer.cast(__MODULE__, {:error, session_id})
  end

  @doc "List sessions with optional filters."
  def list_sessions(filters \\ %{}) do
    GenServer.call(__MODULE__, {:list, filters})
  end

  @doc "Get a single session with messages."
  def get_session(session_id) do
    GenServer.call(__MODULE__, {:get, session_id})
  end

  @doc """
  Build a context summary for a session, suitable for injection into
  Superman or other external tool calls. Returns a map with session
  metadata, recent messages, and the DCC snapshot if available.
  """
  def build_context_summary(session_id) when is_binary(session_id) do
    case get_session(session_id) do
      {:ok, %{session: session, messages: messages}} ->
        build_summary_from(session, messages)

      {:error, _} ->
        %{session_id: session_id, error: :not_found}
    end
  end

  def build_context_summary(%AiSession{} = session) do
    messages =
      AiSessionMessage
      |> where([m], m.session_id == ^session.id)
      |> order_by([m], desc: m.inserted_at)
      |> limit(20)
      |> Repo.all()
      |> Enum.reverse()

    build_summary_from(session, messages)
  end

  defp build_summary_from(session, messages) do
    dcc =
      case SessionStore.fetch(session.id) do
        {:ok, dcc} -> DccPrimitive.to_map(dcc)
        :error -> nil
      end

    recent =
      messages
      |> Enum.take(-10)
      |> Enum.map(fn m ->
        %{role: m.role, content: truncate(m.content, 500), tool_calls: m.tool_calls}
      end)

    %{
      session_id: session.id,
      model: session.model,
      status: session.status,
      project_path: session.project_path,
      message_count: session.message_count,
      total_tokens: session.total_input_tokens + session.total_output_tokens,
      cost_usd: session.cost_usd,
      recent_messages: recent,
      dcc: dcc
    }
  end

  defp truncate(nil, _max), do: nil
  defp truncate(str, max) when byte_size(str) <= max, do: str
  defp truncate(str, max), do: String.slice(str, 0, max) <> "..."

  # --- Callbacks ---

  @impl true
  def init(_opts) do
    {:ok, %{}}
  end

  @impl true
  def handle_call({:create, opts}, _from, state) do
    id = generate_id()

    attrs = %{
      id: id,
      model: Map.get(opts, :model, "sonnet"),
      status: "active",
      title: Map.get(opts, :title),
      project_path: Map.get(opts, :project_path),
      agent_id: Map.get(opts, :agent_id),
      metadata: Map.get(opts, :metadata, %{})
    }

    case %AiSession{} |> AiSession.changeset(attrs) |> Repo.insert() do
      {:ok, session} ->
        maybe_create_dcc(session)
        broadcast(:session_created, session)
        {:reply, {:ok, session}, state}

      {:error, changeset} ->
        {:reply, {:error, changeset}, state}
    end
  end

  def handle_call({:resume, session_id}, _from, state) do
    case Repo.get(AiSession, session_id) do
      nil ->
        {:reply, {:error, :not_found}, state}

      %{status: "active"} = session ->
        {:reply, {:ok, session}, state}

      session ->
        case session |> AiSession.changeset(%{status: "active"}) |> Repo.update() do
          {:ok, updated} ->
            broadcast(:session_resumed, updated)
            {:reply, {:ok, updated}, state}

          {:error, changeset} ->
            {:reply, {:error, changeset}, state}
        end
    end
  end

  def handle_call({:fork, session_id, message_id}, _from, state) do
    case Repo.get(AiSession, session_id) do
      nil ->
        {:reply, {:error, :not_found}, state}

      parent ->
        # Copy messages up to and including the fork point
        messages =
          AiSessionMessage
          |> where([m], m.session_id == ^session_id)
          |> order_by([m], asc: m.inserted_at)
          |> Repo.all()

        {kept, _dropped} = Enum.split_while(messages, fn m -> m.id != message_id end)
        fork_point = Enum.find(messages, fn m -> m.id == message_id end)
        messages_to_copy = if fork_point, do: kept ++ [fork_point], else: kept

        new_id = generate_id()

        attrs = %{
          id: new_id,
          model: parent.model,
          status: "active",
          title: "Fork of #{parent.title || parent.id}",
          project_path: parent.project_path,
          agent_id: parent.agent_id,
          parent_session_id: session_id,
          fork_point_message_id: message_id,
          message_count: length(messages_to_copy),
          metadata: Map.merge(parent.metadata || %{}, %{"forked_from" => session_id})
        }

        case %AiSession{} |> AiSession.changeset(attrs) |> Repo.insert() do
          {:ok, forked} ->
            # Copy messages to the new session
            Enum.each(messages_to_copy, fn msg ->
              %AiSessionMessage{}
              |> AiSessionMessage.changeset(%{
                id: generate_id(),
                session_id: new_id,
                role: msg.role,
                content: msg.content,
                token_count: msg.token_count,
                tool_calls: msg.tool_calls,
                metadata: Map.merge(msg.metadata || %{}, %{"copied_from" => msg.id})
              })
              |> Repo.insert()
            end)

            broadcast(:session_forked, forked)
            {:reply, {:ok, forked}, state}

          {:error, changeset} ->
            {:reply, {:error, changeset}, state}
        end
    end
  end

  def handle_call({:add_message, session_id, role, content, opts}, _from, state) do
    msg_attrs = %{
      id: generate_id(),
      session_id: session_id,
      role: role,
      content: content,
      token_count: Map.get(opts, :token_count, 0),
      tool_calls: Map.get(opts, :tool_calls, %{}),
      metadata: Map.get(opts, :metadata, %{})
    }

    case %AiSessionMessage{} |> AiSessionMessage.changeset(msg_attrs) |> Repo.insert() do
      {:ok, message} ->
        # Increment message count
        AiSession
        |> where([s], s.id == ^session_id)
        |> Repo.update_all(inc: [message_count: 1])

        {:reply, {:ok, message}, state}

      {:error, changeset} ->
        {:reply, {:error, changeset}, state}
    end
  end

  def handle_call({:list, filters}, _from, state) do
    query =
      AiSession
      |> order_by([s], desc: s.updated_at)
      |> maybe_filter_status(filters)
      |> maybe_filter_agent(filters)

    sessions = Repo.all(query)
    {:reply, {:ok, sessions}, state}
  end

  def handle_call({:get, session_id}, _from, state) do
    case Repo.get(AiSession, session_id) do
      nil ->
        {:reply, {:error, :not_found}, state}

      session ->
        messages =
          AiSessionMessage
          |> where([m], m.session_id == ^session_id)
          |> order_by([m], asc: m.inserted_at)
          |> Repo.all()

        {:reply, {:ok, %{session: session, messages: messages}}, state}
    end
  end

  @impl true
  def handle_cast({:record_tokens, session_id, input_tokens, output_tokens}, state) do
    case Repo.get(AiSession, session_id) do
      nil ->
        Logger.warning("[SessionManager] Session not found for token recording: #{session_id}")

      session ->
        cost = calculate_cost(session.model, input_tokens, output_tokens)

        session
        |> AiSession.changeset(%{
          total_input_tokens: session.total_input_tokens + input_tokens,
          total_output_tokens: session.total_output_tokens + output_tokens,
          cost_usd: session.cost_usd + cost
        })
        |> Repo.update()

        broadcast(:session_updated, %{
          id: session_id,
          total_input_tokens: session.total_input_tokens + input_tokens,
          total_output_tokens: session.total_output_tokens + output_tokens,
          cost_usd: session.cost_usd + cost
        })
    end

    {:noreply, state}
  end

  def handle_cast({:complete, session_id}, state) do
    update_status(session_id, "completed")
    maybe_crystallize_dcc(session_id)
    {:noreply, state}
  end

  def handle_cast({:error, session_id}, state) do
    update_status(session_id, "error")
    {:noreply, state}
  end

  # --- Internal ---

  defp update_status(session_id, status) do
    case Repo.get(AiSession, session_id) do
      nil -> :ok
      session ->
        case session |> AiSession.changeset(%{status: status}) |> Repo.update() do
          {:ok, updated} -> broadcast(:session_updated, updated)
          _ -> :ok
        end
    end
  end

  defp calculate_cost(model, input_tokens, output_tokens) do
    rates = Map.get(@cost_per_million, model, %{input: 3.0, output: 15.0})
    (input_tokens * rates.input + output_tokens * rates.output) / 1_000_000
  end

  defp broadcast(event, payload) do
    Phoenix.PubSub.broadcast(Ema.PubSub, "ai:sessions", {event, payload})
  end

  defp maybe_filter_status(query, %{status: status}) when is_binary(status) do
    where(query, [s], s.status == ^status)
  end

  defp maybe_filter_status(query, _), do: query

  defp maybe_filter_agent(query, %{agent_id: agent_id}) when is_binary(agent_id) do
    where(query, [s], s.agent_id == ^agent_id)
  end

  defp maybe_filter_agent(query, _), do: query

  defp generate_id do
    ts = System.system_time(:millisecond)
    rand = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "ais_#{ts}_#{rand}"
  end

  defp maybe_create_dcc(session) do
    if session_store_running?() do
      dcc =
        DccPrimitive.new(%{session_id: session.id, project_id: session.project_path})
        |> DccPrimitive.with_intent_snapshot(%{
          model: session.model,
          agent_id: session.agent_id,
          created_at: DateTime.to_iso8601(DateTime.utc_now())
        })

      SessionStore.store(session.id, dcc)
    end
  rescue
    _ -> Logger.debug("[SessionManager] SessionStore not available for DCC creation")
  end

  defp maybe_crystallize_dcc(session_id) do
    if session_store_running?() do
      case SessionStore.fetch(session_id) do
        {:ok, dcc} ->
          # Update narrative with final message count before crystallizing
          case Repo.get(AiSession, session_id) do
            nil ->
              SessionStore.crystallize(session_id)

            session ->
              narrative =
                "Session #{session_id}: #{session.message_count} messages, " <>
                  "#{session.total_input_tokens + session.total_output_tokens} tokens, " <>
                  "$#{Float.round(session.cost_usd, 4)} cost"

              updated = DccPrimitive.with_narrative(dcc, narrative)
              SessionStore.store(session_id, updated)
              SessionStore.crystallize(session_id)
          end

        :error ->
          :ok
      end
    end
  rescue
    _ -> Logger.debug("[SessionManager] SessionStore not available for DCC crystallization")
  end

  defp session_store_running? do
    Process.whereis(SessionStore) != nil
  end
end
