defmodule Ema.Agents.DiscordChannel do
  @moduledoc """
  Discord channel integration via HTTP API polling.

  Monitors configured Discord channels for new messages, forwards them
  to the AgentWorker, and posts responses back. Uses :httpc (built-in
  Erlang HTTP client) -- no external dependencies required.

  Config shape:
    %{
      "bot_token" => "...",
      "channel_ids" => ["123456789", ...]
    }
  """

  use GenServer
  require Logger

  alias Ema.Agents
  alias Ema.Agents.AgentWorker

  @discord_api "https://discord.com/api/v10"
  @poll_interval_ms 5_000
  @reconnect_delay_ms 10_000
  @max_backoff_ms 120_000

  # --- Public API ---

  def start_link({agent_id, channel_config}) do
    GenServer.start_link(__MODULE__, {agent_id, channel_config}, name: via(agent_id))
  end

  @doc "Returns the current connection status atom."
  def status(agent_id) do
    GenServer.call(via(agent_id), :status)
  end

  @doc "Sends a message to a Discord channel. Returns :ok or {:error, reason}."
  def send_message(agent_id, channel_id, content) do
    GenServer.call(via(agent_id), {:send_message, channel_id, content}, 15_000)
  end

  defp via(agent_id) do
    {:via, Registry, {Ema.Agents.Registry, {:discord, agent_id}}}
  end

  # --- Callbacks ---

  @impl true
  def init({agent_id, config}) do
    ensure_httpc_started()

    state = %{
      agent_id: agent_id,
      bot_token: config["bot_token"],
      channel_ids: config["channel_ids"] || [],
      status: :disconnected,
      bot_user_id: nil,
      # Track last seen message per channel to use `after` param
      last_message_ids: %{},
      backoff_ms: @reconnect_delay_ms
    }

    send(self(), :connect)
    {:ok, state}
  end

  @impl true
  def handle_call(:status, _from, state) do
    {:reply, state.status, state}
  end

  def handle_call({:send_message, channel_id, content}, _from, state) do
    case post_discord_message(channel_id, content, state.bot_token) do
      {:ok, _msg} -> {:reply, :ok, state}
      {:error, reason} -> {:reply, {:error, reason}, state}
    end
  end

  @impl true
  def handle_info(:connect, state) do
    case fetch_bot_user(state.bot_token) do
      {:ok, bot_user_id} ->
        Logger.info(
          "DiscordChannel connected for agent #{state.agent_id}, bot user #{bot_user_id}"
        )

        new_state = %{
          state
          | status: :connected,
            bot_user_id: bot_user_id,
            backoff_ms: @reconnect_delay_ms
        }

        schedule_poll(0)
        {:noreply, new_state}

      {:error, reason} ->
        Logger.error(
          "DiscordChannel connect failed for agent #{state.agent_id}: #{inspect(reason)}"
        )

        schedule_reconnect(state.backoff_ms)

        {:noreply,
         %{
           state
           | status: :error,
             backoff_ms: min(state.backoff_ms * 2, @max_backoff_ms)
         }}
    end
  end

  def handle_info(:poll, %{status: status} = state) when status != :connected do
    {:noreply, state}
  end

  def handle_info(:poll, state) do
    new_state =
      Enum.reduce(state.channel_ids, state, fn channel_id, acc ->
        poll_channel(channel_id, acc)
      end)

    schedule_poll(@poll_interval_ms)
    {:noreply, new_state}
  end

  def handle_info(:reconnect, state) do
    send(self(), :connect)
    {:noreply, %{state | status: :disconnected}}
  end

  def handle_info(msg, state) do
    Logger.debug("DiscordChannel unexpected message: #{inspect(msg)}")
    {:noreply, state}
  end

  # --- Internals ---

  defp poll_channel(channel_id, state) do
    after_id = Map.get(state.last_message_ids, channel_id)

    case fetch_messages(channel_id, after_id, state.bot_token) do
      {:ok, []} ->
        state

      {:ok, {:set_cursor, cursor_id}} ->
        # First poll -- just set the cursor without processing
        put_in(state, [:last_message_ids, channel_id], cursor_id)

      {:ok, messages} when is_list(messages) ->
        # Messages come newest-first from Discord; sort ascending for processing order
        sorted = Enum.sort_by(messages, &Map.get(&1, "id"))
        latest_id = List.last(sorted) |> Map.get("id")

        Enum.each(sorted, fn msg ->
          handle_discord_message(msg, channel_id, state)
        end)

        put_in(state, [:last_message_ids, channel_id], latest_id)

      {:error, reason} ->
        Logger.warning("DiscordChannel poll error on #{channel_id}: #{inspect(reason)}")

        state
    end
  end

  defp handle_discord_message(msg, channel_id, state) do
    author_id = get_in(msg, ["author", "id"])
    content = Map.get(msg, "content", "")
    is_bot = get_in(msg, ["author", "bot"]) == true

    # Skip messages from bots (including ourselves)
    if is_bot or author_id == state.bot_user_id or content == "" do
      :skip
    else
      process_user_message(author_id, channel_id, content, state)
    end
  end

  defp process_user_message(author_id, channel_id, content, state) do
    agent_id = state.agent_id

    broadcast_event(:message_received, %{
      agent_id: agent_id,
      channel_type: "discord",
      channel_id: channel_id,
      external_user_id: author_id,
      content: content
    })

    Task.Supervisor.start_child(Ema.TaskSupervisor, fn ->
      with {:ok, conversation} <-
             Agents.get_or_create_conversation(agent_id, "discord", channel_id, author_id),
           {:ok, response} <-
             AgentWorker.send_message(agent_id, conversation.id, content, %{
               channel_type: "discord",
               channel_id: channel_id,
               external_user_id: author_id
             }) do
        reply_text = response.reply

        case post_discord_message(channel_id, reply_text, state.bot_token) do
          {:ok, _} ->
            broadcast_event(:message_sent, %{
              agent_id: agent_id,
              channel_type: "discord",
              channel_id: channel_id,
              content: reply_text
            })

          {:error, reason} ->
            Logger.error("DiscordChannel failed to post reply: #{inspect(reason)}")
        end
      else
        {:error, reason} ->
          Logger.error(
            "DiscordChannel message handling failed for agent #{agent_id}: #{inspect(reason)}"
          )
      end
    end)
  end

  # --- Discord HTTP helpers ---

  defp fetch_bot_user(bot_token) do
    url = "#{@discord_api}/users/@me"

    case http_get(url, bot_token) do
      {:ok, %{"id" => id}} -> {:ok, id}
      {:ok, body} -> {:error, {:unexpected_response, body}}
      {:error, _} = err -> err
    end
  end

  defp fetch_messages(channel_id, nil, bot_token) do
    # First poll -- grab last message ID to set cursor, don't process history
    url = "#{@discord_api}/channels/#{channel_id}/messages?limit=1"

    case http_get(url, bot_token) do
      {:ok, [msg | _]} -> {:ok, {:set_cursor, Map.get(msg, "id")}}
      {:ok, []} -> {:ok, []}
      {:ok, _unexpected} -> {:ok, []}
      {:error, _} = err -> err
    end
  end

  defp fetch_messages(channel_id, after_id, bot_token) do
    url = "#{@discord_api}/channels/#{channel_id}/messages?after=#{after_id}&limit=100"
    http_get(url, bot_token)
  end

  defp post_discord_message(channel_id, content, bot_token) do
    url = "#{@discord_api}/channels/#{channel_id}/messages"
    # Discord max message length is 2000 chars
    truncated = truncate(content, 2000)
    body = Jason.encode!(%{"content" => truncated})
    http_post(url, body, bot_token)
  end

  # --- Generic HTTP via :httpc ---

  defp http_get(url, bot_token) do
    headers = [
      {~c"Authorization", String.to_charlist("Bot #{bot_token}")},
      {~c"Content-Type", ~c"application/json"}
    ]

    request = {String.to_charlist(url), headers}

    case :httpc.request(:get, request, [{:ssl, ssl_opts()}], []) do
      {:ok, {{_, status, _}, _headers, body}} when status in 200..299 ->
        Jason.decode(List.to_string(body))

      {:ok, {{_, 429, _}, resp_headers, _body}} ->
        retry_after = extract_retry_after(resp_headers)

        Logger.warning("Discord rate limited, retry after #{retry_after}s")
        {:error, {:rate_limited, retry_after}}

      {:ok, {{_, status, _}, _headers, body}} ->
        Logger.warning("Discord API #{status}: #{List.to_string(body)}")
        {:error, {:http_status, status}}

      {:error, reason} ->
        {:error, {:httpc_error, reason}}
    end
  end

  defp http_post(url, json_body, bot_token) do
    headers = [
      {~c"Authorization", String.to_charlist("Bot #{bot_token}")},
      {~c"Content-Type", ~c"application/json"}
    ]

    request =
      {String.to_charlist(url), headers, ~c"application/json", String.to_charlist(json_body)}

    case :httpc.request(:post, request, [{:ssl, ssl_opts()}], []) do
      {:ok, {{_, status, _}, _headers, body}} when status in 200..299 ->
        Jason.decode(List.to_string(body))

      {:ok, {{_, 429, _}, resp_headers, _body}} ->
        retry_after = extract_retry_after(resp_headers)

        Logger.warning("Discord rate limited on POST, retry after #{retry_after}s")
        {:error, {:rate_limited, retry_after}}

      {:ok, {{_, status, _}, _headers, body}} ->
        Logger.warning("Discord POST #{status}: #{List.to_string(body)}")
        {:error, {:http_status, status}}

      {:error, reason} ->
        {:error, {:httpc_error, reason}}
    end
  end

  defp ssl_opts do
    [
      {:verify, :verify_peer},
      {:cacerts, :public_key.cacerts_get()},
      {:depth, 3},
      {:customize_hostname_check,
       [{:match_fun, :public_key.pkix_verify_hostname_match_fun(:https)}]}
    ]
  end

  defp extract_retry_after(headers) do
    case List.keyfind(headers, ~c"retry-after", 0) do
      {_, value} ->
        value |> List.to_string() |> String.to_float() |> ceil()

      nil ->
        5
    end
  end

  # --- Utilities ---

  defp schedule_poll(delay_ms) do
    Process.send_after(self(), :poll, delay_ms)
  end

  defp schedule_reconnect(delay_ms) do
    Process.send_after(self(), :reconnect, delay_ms)
  end

  defp broadcast_event(event, payload) do
    Phoenix.PubSub.broadcast(
      Ema.PubSub,
      "channels:messages",
      {event, payload}
    )
  end

  defp truncate(text, max_len) when byte_size(text) <= max_len, do: text

  defp truncate(text, max_len) do
    String.slice(text, 0, max_len - 3) <> "..."
  end

  defp ensure_httpc_started do
    :inets.start()
    :ssl.start()
  end
end
