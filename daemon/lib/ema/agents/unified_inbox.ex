defmodule Ema.Agents.UnifiedInbox do
  @moduledoc """
  Aggregates messages from all channels into a single sorted stream.

  Subscribes to real-time channel messages and maintains an in-memory cache
  of recent messages for fast retrieval. Broadcasts "inbox:updated" when
  new messages arrive.
  """

  use GenServer

  alias Ema.Agents.Message

  @cache_limit 200
  @default_list_limit 50
  @pubsub Ema.PubSub
  @messages_topic "channels:messages"
  @inbox_topic "inbox:updated"

  # --- Client API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc """
  Returns recent messages across all channels.

  ## Options
    * `:channel_type` - filter by channel type
    * `:agent_id` - filter by agent
    * `:since` - DateTime, only messages after this time
    * `:limit` - max messages to return (default #{@default_list_limit})
  """
  @spec list_messages(keyword()) :: [Message.t()]
  def list_messages(opts \\ []) do
    GenServer.call(__MODULE__, {:list_messages, opts})
  end

  @doc "Full-text search across all cached messages."
  @spec search_messages(String.t()) :: [Message.t()]
  def search_messages(query) when is_binary(query) do
    GenServer.call(__MODULE__, {:search_messages, query})
  end

  # --- Server Callbacks ---

  @impl true
  def init(_opts) do
    Phoenix.PubSub.subscribe(@pubsub, @messages_topic)

    messages = load_recent_messages()

    {:ok, %{messages: messages}}
  end

  @impl true
  def handle_call({:list_messages, opts}, _from, state) do
    limit = Keyword.get(opts, :limit, @default_list_limit)

    filtered =
      state.messages
      |> maybe_filter_channel_type(Keyword.get(opts, :channel_type))
      |> maybe_filter_agent_id(Keyword.get(opts, :agent_id))
      |> maybe_filter_since(Keyword.get(opts, :since))
      |> Enum.take(limit)

    {:reply, filtered, state}
  end

  @impl true
  def handle_call({:search_messages, query}, _from, state) do
    downcased = String.downcase(query)

    results =
      Enum.filter(state.messages, fn msg ->
        msg.content
        |> to_string()
        |> String.downcase()
        |> String.contains?(downcased)
      end)

    {:reply, results, state}
  end

  @impl true
  def handle_info({:new_message, message}, state) do
    messages =
      [message | state.messages]
      |> Enum.sort_by(& &1.inserted_at, {:desc, DateTime})
      |> Enum.take(@cache_limit)

    Phoenix.PubSub.broadcast(@pubsub, @inbox_topic, {:inbox_updated, message})

    {:noreply, %{state | messages: messages}}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  # --- Private ---

  defp load_recent_messages do
    import Ecto.Query

    Message
    |> order_by(desc: :inserted_at)
    |> limit(@cache_limit)
    |> Ema.Repo.all()
  end

  defp maybe_filter_channel_type(messages, nil), do: messages

  defp maybe_filter_channel_type(messages, channel_type) do
    Enum.filter(messages, fn msg ->
      case Ema.Repo.preload(msg, :conversation) do
        %{conversation: %{channel_type: ^channel_type}} -> true
        _ -> false
      end
    end)
  end

  defp maybe_filter_agent_id(messages, nil), do: messages

  defp maybe_filter_agent_id(messages, agent_id) do
    Enum.filter(messages, fn msg ->
      case Ema.Repo.preload(msg, :conversation) do
        %{conversation: %{agent_id: ^agent_id}} -> true
        _ -> false
      end
    end)
  end

  defp maybe_filter_since(messages, nil), do: messages

  defp maybe_filter_since(messages, %DateTime{} = since) do
    Enum.filter(messages, fn msg ->
      DateTime.compare(msg.inserted_at, since) == :gt
    end)
  end
end
