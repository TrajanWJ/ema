defmodule Ema.Agents.TelegramChannel do
  @moduledoc """
  Telegram channel integration via Bot API long-polling.

  Uses getUpdates with a 25-second timeout for efficient long-polling.
  Forwards messages from allowed chats to the AgentWorker and posts
  responses back via sendMessage. Uses :httpc -- no external deps.

  Config shape:
    %{
      "bot_token" => "...",
      "allowed_chat_ids" => [123456789, ...]
    }
  """

  use GenServer
  require Logger

  alias Ema.Agents
  alias Ema.Agents.AgentWorker

  @poll_timeout_s 25
  # :httpc timeout must exceed the long-poll timeout
  @httpc_timeout_ms (@poll_timeout_s + 5) * 1_000
  @reconnect_delay_ms 5_000
  @max_backoff_ms 120_000

  # --- Public API ---

  def start_link({agent_id, channel_config}) do
    GenServer.start_link(__MODULE__, {agent_id, channel_config}, name: via(agent_id))
  end

  @doc "Returns the current connection status atom."
  def status(agent_id) do
    GenServer.call(via(agent_id), :status)
  end

  @doc "Sends a message to a Telegram chat. Returns :ok or {:error, reason}."
  def send_message(agent_id, chat_id, text) do
    GenServer.call(via(agent_id), {:send_message, chat_id, text}, 15_000)
  end

  defp via(agent_id) do
    {:via, Registry, {Ema.Agents.Registry, {:telegram, agent_id}}}
  end

  # --- Callbacks ---

  @impl true
  def init({agent_id, config}) do
    ensure_httpc_started()

    allowed =
      (config["allowed_chat_ids"] || [])
      |> Enum.map(&to_integer/1)
      |> MapSet.new()

    state = %{
      agent_id: agent_id,
      bot_token: config["bot_token"],
      allowed_chat_ids: allowed,
      status: :disconnected,
      offset: 0,
      bot_username: nil,
      backoff_ms: @reconnect_delay_ms
    }

    send(self(), :connect)
    {:ok, state}
  end

  @impl true
  def handle_call(:status, _from, state) do
    {:reply, state.status, state}
  end

  def handle_call({:send_message, chat_id, text}, _from, state) do
    case telegram_send_message(chat_id, text, state.bot_token) do
      {:ok, _} -> {:reply, :ok, state}
      {:error, reason} -> {:reply, {:error, reason}, state}
    end
  end

  @impl true
  def handle_info(:connect, state) do
    case fetch_bot_info(state.bot_token) do
      {:ok, username} ->
        Logger.info(
          "TelegramChannel connected for agent #{state.agent_id}, bot @#{username}"
        )

        new_state = %{
          state
          | status: :connected,
            bot_username: username,
            backoff_ms: @reconnect_delay_ms
        }

        schedule_poll(0)
        {:noreply, new_state}

      {:error, reason} ->
        Logger.error(
          "TelegramChannel connect failed for agent #{state.agent_id}: #{inspect(reason)}"
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
    case get_updates(state.offset, state.bot_token) do
      {:ok, []} ->
        schedule_poll(0)
        {:noreply, state}

      {:ok, updates} ->
        new_offset =
          updates
          |> Enum.map(&Map.get(&1, "update_id"))
          |> Enum.max()
          |> Kernel.+(1)

        Enum.each(updates, fn update ->
          handle_update(update, state)
        end)

        schedule_poll(0)
        {:noreply, %{state | offset: new_offset}}

      {:error, {:http_status, 409}} ->
        # Conflict -- another instance is polling. Back off.
        Logger.warning("TelegramChannel 409 conflict, backing off")
        schedule_poll(5_000)
        {:noreply, state}

      {:error, reason} ->
        Logger.warning("TelegramChannel poll error: #{inspect(reason)}")
        schedule_reconnect(state.backoff_ms)

        {:noreply,
         %{
           state
           | status: :error,
             backoff_ms: min(state.backoff_ms * 2, @max_backoff_ms)
         }}
    end
  end

  def handle_info(:reconnect, state) do
    send(self(), :connect)
    {:noreply, %{state | status: :disconnected}}
  end

  def handle_info(msg, state) do
    Logger.debug("TelegramChannel unexpected message: #{inspect(msg)}")
    {:noreply, state}
  end

  # --- Update processing ---

  defp handle_update(%{"message" => message}, state) when is_map(message) do
    chat_id = get_in(message, ["chat", "id"])
    text = Map.get(message, "text", "")
    from_id = get_in(message, ["from", "id"])
    is_bot = get_in(message, ["from", "is_bot"]) == true

    cond do
      is_bot ->
        :skip

      text == "" ->
        :skip

      not MapSet.member?(state.allowed_chat_ids, chat_id) ->
        Logger.debug("TelegramChannel ignoring message from unallowed chat #{chat_id}")
        :skip

      true ->
        process_user_message(from_id, chat_id, text, state)
    end
  end

  defp handle_update(_update, _state) do
    # Ignore non-message updates (edited messages, callbacks, etc.)
    :skip
  end

  defp process_user_message(from_id, chat_id, text, state) do
    agent_id = state.agent_id
    external_user_id = Integer.to_string(from_id)
    channel_id = Integer.to_string(chat_id)

    broadcast_event(:message_received, %{
      agent_id: agent_id,
      channel_type: "telegram",
      channel_id: channel_id,
      external_user_id: external_user_id,
      content: text
    })

    Task.Supervisor.start_child(Ema.TaskSupervisor, fn ->
      with {:ok, conversation} <-
             Agents.get_or_create_conversation(agent_id, "telegram", channel_id, external_user_id),
           {:ok, response} <-
             AgentWorker.send_message(agent_id, conversation.id, text, %{
               channel_type: "telegram",
               channel_id: channel_id,
               external_user_id: external_user_id
             }) do
        reply_text = response.reply

        case telegram_send_message(chat_id, reply_text, state.bot_token) do
          {:ok, _} ->
            broadcast_event(:message_sent, %{
              agent_id: agent_id,
              channel_type: "telegram",
              channel_id: channel_id,
              content: reply_text
            })

          {:error, reason} ->
            Logger.error("TelegramChannel failed to send reply: #{inspect(reason)}")
        end
      else
        {:error, reason} ->
          Logger.error(
            "TelegramChannel message handling failed for agent #{agent_id}: #{inspect(reason)}"
          )
      end
    end)
  end

  # --- Telegram HTTP helpers ---

  defp api_url(bot_token, method) do
    "https://api.telegram.org/bot#{bot_token}/#{method}"
  end

  defp fetch_bot_info(bot_token) do
    url = api_url(bot_token, "getMe")

    case http_get(url) do
      {:ok, %{"ok" => true, "result" => %{"username" => username}}} ->
        {:ok, username}

      {:ok, %{"ok" => false, "description" => desc}} ->
        {:error, {:telegram_error, desc}}

      {:ok, body} ->
        {:error, {:unexpected_response, body}}

      {:error, _} = err ->
        err
    end
  end

  defp get_updates(offset, bot_token) do
    url = api_url(bot_token, "getUpdates")

    body =
      Jason.encode!(%{
        "offset" => offset,
        "timeout" => @poll_timeout_s,
        "allowed_updates" => ["message"]
      })

    case http_post(url, body, @httpc_timeout_ms) do
      {:ok, %{"ok" => true, "result" => results}} when is_list(results) ->
        {:ok, results}

      {:ok, %{"ok" => false, "description" => desc}} ->
        {:error, {:telegram_error, desc}}

      {:ok, body} ->
        {:error, {:unexpected_response, body}}

      {:error, _} = err ->
        err
    end
  end

  defp telegram_send_message(chat_id, text, bot_token) do
    url = api_url(bot_token, "sendMessage")
    # Telegram max message length is 4096 chars
    truncated = truncate(text, 4096)

    body =
      Jason.encode!(%{
        "chat_id" => chat_id,
        "text" => truncated,
        "parse_mode" => "Markdown"
      })

    case http_post(url, body) do
      {:ok, %{"ok" => true, "result" => result}} ->
        {:ok, result}

      {:ok, %{"ok" => true}} ->
        {:ok, %{}}

      {:ok, %{"ok" => false, "description" => desc}} ->
        # Markdown parse failure -- retry without parse_mode
        if String.contains?(desc, "parse") do
          retry_body = Jason.encode!(%{"chat_id" => chat_id, "text" => truncated})

          case http_post(url, retry_body) do
            {:ok, %{"ok" => true, "result" => result}} -> {:ok, result}
            {:ok, %{"ok" => false, "description" => d}} -> {:error, {:telegram_error, d}}
            err -> err
          end
        else
          {:error, {:telegram_error, desc}}
        end

      {:error, _} = err ->
        err
    end
  end

  # --- Generic HTTP via :httpc ---

  defp http_get(url) do
    headers = [{~c"Content-Type", ~c"application/json"}]
    request = {String.to_charlist(url), headers}

    case :httpc.request(:get, request, [{:ssl, ssl_opts()}, {:timeout, 10_000}], []) do
      {:ok, {{_, status, _}, _headers, body}} when status in 200..299 ->
        Jason.decode(List.to_string(body))

      {:ok, {{_, status, _}, _headers, body}} ->
        Logger.warning("Telegram API GET #{status}: #{List.to_string(body)}")
        {:error, {:http_status, status}}

      {:error, reason} ->
        {:error, {:httpc_error, reason}}
    end
  end

  defp http_post(url, json_body, timeout_ms \\ 10_000) do
    headers = [{~c"Content-Type", ~c"application/json"}]

    request =
      {String.to_charlist(url), headers, ~c"application/json", String.to_charlist(json_body)}

    case :httpc.request(:post, request, [{:ssl, ssl_opts()}, {:timeout, timeout_ms}], []) do
      {:ok, {{_, status, _}, _headers, body}} when status in 200..299 ->
        Jason.decode(List.to_string(body))

      {:ok, {{_, 429, _}, _headers, body}} ->
        parsed = Jason.decode(List.to_string(body))

        retry_after =
          case parsed do
            {:ok, %{"parameters" => %{"retry_after" => s}}} -> s
            _ -> 5
          end

        Logger.warning("Telegram rate limited, retry after #{retry_after}s")
        {:error, {:rate_limited, retry_after}}

      {:ok, {{_, status, _}, _headers, body}} ->
        Logger.warning("Telegram API POST #{status}: #{List.to_string(body)}")
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

  defp to_integer(val) when is_integer(val), do: val
  defp to_integer(val) when is_binary(val), do: String.to_integer(val)

  defp ensure_httpc_started do
    :inets.start()
    :ssl.start()
  end
end
