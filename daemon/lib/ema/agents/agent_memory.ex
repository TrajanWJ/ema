defmodule Ema.Agents.AgentMemory do
  @moduledoc """
  Per-agent GenServer that manages conversation memory.
  When a conversation exceeds a configurable threshold, older messages
  are summarized into a system message to compress context.
  """

  use GenServer
  require Logger

  alias Ema.Agents
  alias Ema.Claude.Runner

  @default_threshold 20

  # --- Public API ---

  def start_link(agent_id) do
    GenServer.start_link(__MODULE__, agent_id, name: via(agent_id))
  end

  def check_conversation(agent_id, conversation_id) do
    GenServer.cast(via(agent_id), {:check_conversation, conversation_id})
  end

  defp via(agent_id) do
    {:via, Registry, {Ema.Agents.Registry, {:memory, agent_id}}}
  end

  # --- Callbacks ---

  @impl true
  def init(agent_id) do
    Logger.info("AgentMemory started for agent #{agent_id}")

    {:ok,
     %{
       agent_id: agent_id,
       threshold: @default_threshold
     }}
  end

  @impl true
  def handle_cast({:check_conversation, conversation_id}, state) do
    maybe_summarize(conversation_id, state)
    {:noreply, state}
  end

  @impl true
  def handle_info({:check_conversation, conversation_id}, state) do
    maybe_summarize(conversation_id, state)
    {:noreply, state}
  end

  defp maybe_summarize(conversation_id, state) do
    count = Agents.count_messages(conversation_id)

    if count > state.threshold do
      summarize_conversation(conversation_id, state)
    end
  rescue
    e ->
      Logger.warning(
        "AgentMemory summarization failed for #{conversation_id}: #{Exception.message(e)}"
      )
  end

  # --- Internal ---

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

      case Runner.run(prompt, model: "haiku", max_tokens: 1024) do
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
            "Summarized #{length(to_summarize)} messages in conversation #{conversation_id}"
          )

        {:error, reason} ->
          Logger.warning(
            "Failed to summarize conversation #{conversation_id}: #{inspect(reason)}"
          )
      end
    end
  end
end
