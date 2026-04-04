defmodule Ema.Agents.AgentMemory do
  @moduledoc """
  Per-agent GenServer that manages conversation memory.

  When a conversation exceeds a configurable threshold, older messages
  are summarized into a system message to compress context.

  ## Extended capabilities (EMA migration additions)

  - `load_context/2` — load full conversation history from SQLite for context window
  - `get_memory_summary/2` — return compressed summary of recent conversation
  - `record_openclaw_session/3` — link an OpenClaw session ID to a conversation
  - `get_openclaw_conversation/2` — look up EMA conversation for an OC session

  These enable EMA to hold the full conversation state even when OpenClaw
  only has the most recent exchange in its own file-based store.
  """

  use GenServer
  require Logger

  alias Ema.Agents
  alias Ema.Claude.Bridge
  alias Ema.Persistence.SessionStore

  @default_threshold 20
  # ~100k tokens of history before aggressive compression
  @max_message_chars 400_000

  # --- Public API ---

  def start_link(agent_id) do
    GenServer.start_link(__MODULE__, agent_id, name: via(agent_id))
  end

  def check_conversation(agent_id, conversation_id) do
    GenServer.cast(via(agent_id), {:check_conversation, conversation_id})
  end

  @doc """
  Load the full conversation context from SQLite for a conversation.
  Returns {:ok, [%Message{}]} or {:error, reason}.
  Used when an agent spawns to reconstruct its context window.
  """
  def load_context(agent_id, conversation_id) do
    GenServer.call(via(agent_id), {:load_context, conversation_id}, 30_000)
  end

  @doc """
  Get a compressed summary of recent conversation history.
  Returns {:ok, summary_string} — suitable for injecting into a new context window.
  """
  def get_memory_summary(agent_id, conversation_id) do
    GenServer.call(via(agent_id), {:get_memory_summary, conversation_id}, 60_000)
  end

  @doc """
  Record the link between an OpenClaw session and an EMA conversation.
  This allows EMA to route future messages from the same OC session to the
  correct conversation, maintaining continuity even across OpenClaw restarts.
  """
  def record_openclaw_session(agent_id, oc_session_id, conversation_id) do
    GenServer.call(via(agent_id), {:record_oc_session, oc_session_id, conversation_id})
  end

  @doc """
  Look up the EMA conversation ID for an OpenClaw session.
  Returns {:ok, conversation_id} or :error.
  """
  def get_openclaw_conversation(agent_id, oc_session_id) do
    GenServer.call(via(agent_id), {:get_oc_conversation, oc_session_id})
  end

  defp via(agent_id) do
    {:via, Registry, {Ema.Agents.Registry, {:memory, agent_id}}}
  end

  # --- Callbacks ---

  @impl true
  def init(agent_id) do
    Logger.info("[AgentMemory] started for agent #{agent_id}")

    {:ok,
     %{
       agent_id: agent_id,
       threshold: @default_threshold,
       # Map from oc_session_id -> conversation_id for this agent
       oc_sessions: %{}
     }}
  end

  @impl true
  def handle_cast({:check_conversation, conversation_id}, state) do
    maybe_summarize(conversation_id, state)
    {:noreply, state}
  end

  @impl true
  def handle_call({:load_context, conversation_id}, _from, state) do
    messages = Agents.list_messages_by_conversation(conversation_id)
    {:reply, {:ok, messages}, state}
  end

  @impl true
  def handle_call({:get_memory_summary, conversation_id}, _from, state) do
    result = build_memory_summary(conversation_id, state)
    {:reply, result, state}
  end

  @impl true
  def handle_call({:record_oc_session, oc_session_id, conversation_id}, _from, state) do
    # Also register in SessionStore for cross-agent lookup
    SessionStore.put_openclaw_session(oc_session_id, state.agent_id,
      conversation_id: conversation_id
    )

    new_oc_sessions = Map.put(state.oc_sessions, oc_session_id, conversation_id)
    Logger.info("[AgentMemory] #{state.agent_id}: linked OC session #{oc_session_id} → conversation #{conversation_id}")
    {:reply, :ok, %{state | oc_sessions: new_oc_sessions}}
  end

  @impl true
  def handle_call({:get_oc_conversation, oc_session_id}, _from, state) do
    result = Map.fetch(state.oc_sessions, oc_session_id)
    {:reply, result, state}
  end

  @impl true
  def handle_info({:check_conversation, conversation_id}, state) do
    maybe_summarize(conversation_id, state)
    {:noreply, state}
  end

  # --- Internal ---

  defp maybe_summarize(conversation_id, state) do
    count = Agents.count_messages(conversation_id)

    cond do
      count > state.threshold ->
        summarize_conversation(conversation_id, state)

      total_chars_exceed?(conversation_id) ->
        Logger.info("[AgentMemory] Conversation #{conversation_id} exceeds char limit, compressing")
        summarize_conversation(conversation_id, state)

      true ->
        :ok
    end
  rescue
    e ->
      Logger.warning(
        "[AgentMemory] Summarization failed for #{conversation_id}: #{Exception.message(e)}"
      )
  end

  defp total_chars_exceed?(conversation_id) do
    messages = Agents.list_messages_by_conversation(conversation_id)
    total = Enum.reduce(messages, 0, fn msg, acc -> acc + String.length(msg.content || "") end)
    total > @max_message_chars
  end

  defp build_memory_summary(conversation_id, state) do
    messages = Agents.list_messages_by_conversation(conversation_id)

    if length(messages) == 0 do
      {:ok, "No conversation history."}
    else
      # If already has a summary message, return it directly
      case Enum.find(messages, fn m ->
             m.role == "system" and
               is_map(m.metadata) and
               Map.get(m.metadata, "type") == "summary"
           end) do
        %{content: summary_content} ->
          {:ok, summary_content}

        nil ->
          # Build one on demand
          content =
            Enum.map_join(messages, "\n", fn msg ->
              "[#{msg.role}]: #{msg.content || "(no content)"}"
            end)

          prompt = """
          Summarize this conversation history concisely, preserving key facts,
          decisions, and context needed for continuity. Output only the summary.

          #{String.slice(content, 0, 20_000)}
          """

          case Bridge.run(prompt, model: "haiku") do
            {:ok, summary} -> {:ok, summary}
            {:error, reason} -> {:error, reason}
          end
      end
    end
  end

  defp summarize_conversation(conversation_id, state) do
    messages = Agents.list_messages_by_conversation(conversation_id)

    # Keep the last N/2 messages, summarize the rest
    keep_count = div(state.threshold, 2)
    {to_summarize, _to_keep} = Enum.split(messages, length(messages) - keep_count)

    if length(to_summarize) < 4 do
      :ok
    else
      content_to_summarize =
        Enum.map_join(to_summarize, "\n", fn msg ->
          "[#{msg.role}]: #{msg.content || "(no content)"}"
        end)

      prompt = """
      Summarize this conversation history concisely, preserving key facts, \
      decisions, and context needed for continuity. Output only the summary, \
      no preamble.

      #{content_to_summarize}
      """

      case Bridge.run(prompt, model: "haiku") do
        {:ok, summary} ->
          # Delete the old messages
          oldest_kept = Enum.at(to_summarize, -1)

          if oldest_kept do
            Agents.delete_messages_before(conversation_id, oldest_kept.inserted_at)
          end

          # Insert summary as a system message
          Agents.add_message(%{
            conversation_id: conversation_id,
            role: "system",
            content: "[Conversation summary]: #{summary}",
            metadata: %{type: "summary", summarized_count: length(to_summarize)}
          })

          Logger.info(
            "[AgentMemory] Summarized #{length(to_summarize)} messages in conversation #{conversation_id}"
          )

        {:error, reason} ->
          Logger.warning(
            "[AgentMemory] Failed to summarize conversation #{conversation_id}: #{inspect(reason)}"
          )
      end
    end
  end
end
