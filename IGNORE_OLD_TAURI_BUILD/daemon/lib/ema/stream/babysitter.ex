defmodule Ema.Stream.Babysitter do
  @moduledoc """
  Stream babysitter — monitors #babysitter-sprint for human directives and acts on them.

  Every 60s polls Discord channel #babysitter-sprint (1489815795293749258) for
  messages from the designated human user (1482230345909932168).

  On detecting an unacknowledged directive:
    1. Posts `[INTENT] Taking: <directive>` to #intent-stream
    2. Replies with acknowledgement in #babysitter-sprint
    3. Marks directive as acknowledged in ETS

  Escalates to #intent-stream if a directive is 5+ minutes old without action.
  """

  use GenServer

  require Logger

  alias Ema.Feedback.Broadcast

  @babysitter_channel_id 1_489_815_795_293_749_258
  @human_user_id "1482230345909932168"
  @poll_interval_ms 60_000
  @escalation_threshold_ms 5 * 60 * 1_000
  @discord_api "https://discord.com/api/v10"
  @ets_table :stream_babysitter_directives

  # Public API

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc "Force an immediate poll cycle."
  def poll_now(server \\ __MODULE__) do
    GenServer.cast(server, :poll_now)
  end

  @doc "Return all tracked directives."
  def directives(server \\ __MODULE__) do
    GenServer.call(server, :directives)
  end

  # GenServer callbacks

  @impl true
  def init(_opts) do
    table = :ets.new(@ets_table, [:set, :named_table, :public, read_concurrency: true])

    timer_ref = schedule_poll(@poll_interval_ms)

    state = %{
      poll_interval_ms: @poll_interval_ms,
      timer_ref: timer_ref,
      ets: table,
      poll_count: 0,
      last_poll_at: nil,
      # Track message IDs we've already seen, rolling window
      seen_message_ids: MapSet.new()
    }

    Logger.info("[Stream.Babysitter] Started, polling every #{@poll_interval_ms}ms")
    {:ok, state}
  end

  @impl true
  def handle_call(:directives, _from, state) do
    directives = :ets.tab2list(@ets_table) |> Enum.map(fn {_k, v} -> v end)
    {:reply, directives, state}
  end

  @impl true
  def handle_cast(:poll_now, state) do
    {:noreply, do_poll(state)}
  end

  @impl true
  def handle_info(:poll, state) do
    new_state = do_poll(state)
    timer_ref = schedule_poll(state.poll_interval_ms)
    {:noreply, %{new_state | timer_ref: timer_ref}}
  end

  # --- Poll logic ---

  defp do_poll(state) do
    now = DateTime.utc_now()
    Logger.debug("[Stream.Babysitter] Polling #babysitter-sprint")

    # Check for escalation-due directives first
    check_escalations(now)

    # Fetch recent messages
    case fetch_recent_messages(@babysitter_channel_id) do
      {:ok, messages} ->
        new_seen = process_messages(messages, state.seen_message_ids, now)

        # Keep seen set bounded to 500 entries
        seen =
          if MapSet.size(new_seen) > 500 do
            # Trim to last 200
            new_seen |> MapSet.to_list() |> Enum.take(-200) |> MapSet.new()
          else
            new_seen
          end

        %{state | poll_count: state.poll_count + 1, last_poll_at: now, seen_message_ids: seen}

      {:error, reason} ->
        Logger.warning("[Stream.Babysitter] Poll failed: #{inspect(reason)}")
        %{state | poll_count: state.poll_count + 1, last_poll_at: now}
    end
  end

  defp process_messages(messages, seen, now) do
    Enum.reduce(messages, seen, fn msg, acc_seen ->
      msg_id = msg["id"] || ""
      author_id = get_in(msg, ["author", "id"]) || ""
      content = msg["content"] || ""

      cond do
        MapSet.member?(acc_seen, msg_id) ->
          acc_seen

        author_id != @human_user_id ->
          MapSet.put(acc_seen, msg_id)

        content == "" ->
          MapSet.put(acc_seen, msg_id)

        # Skip bot acknowledgements
        String.starts_with?(content, "[ACK]") or String.starts_with?(content, "[INTENT]") ->
          MapSet.put(acc_seen, msg_id)

        true ->
          handle_directive(msg_id, content, now)
          MapSet.put(acc_seen, msg_id)
      end
    end)
  end

  defp handle_directive(msg_id, content, now) do
    case :ets.lookup(@ets_table, msg_id) do
      [{^msg_id, _directive}] ->
        # Already tracked — do nothing
        :ok

      [] ->
        Logger.info("[Stream.Babysitter] New directive: #{String.slice(content, 0, 80)}")

        directive = %{
          id: msg_id,
          content: content,
          detected_at: now,
          acknowledged: false,
          acknowledged_at: nil,
          escalated: false
        }

        :ets.insert(@ets_table, {msg_id, directive})

        # Post intent
        intent_msg = "[INTENT] Taking: #{content}"
        Broadcast.emit(:intent_stream, intent_msg)

        # Acknowledge in sprint channel
        ack_msg = "[ACK] Received directive: #{String.slice(content, 0, 120)}"
        post_to_channel(@babysitter_channel_id, ack_msg)

        # Mark acknowledged
        acknowledged = %{directive | acknowledged: true, acknowledged_at: DateTime.utc_now()}
        :ets.insert(@ets_table, {msg_id, acknowledged})

        :ok
    end
  end

  defp check_escalations(now) do
    cutoff = DateTime.add(now, -@escalation_threshold_ms, :millisecond)

    :ets.tab2list(@ets_table)
    |> Enum.each(fn {_id, directive} ->
      if not directive.acknowledged and not directive.escalated do
        if DateTime.compare(directive.detected_at, cutoff) == :lt do
          Logger.warning("[Stream.Babysitter] Escalating stale directive: #{directive.id}")

          escalation = """
          ⚠️ **[ESCALATION]** Directive unacknowledged for 5+ minutes
          > #{String.slice(directive.content, 0, 200)}
          Detected at: #{DateTime.to_string(directive.detected_at)}
          """

          Broadcast.emit(:intent_stream, String.trim(escalation))

          updated = %{directive | escalated: true}
          :ets.insert(@ets_table, {directive.id, updated})
        end
      end
    end)
  end

  defp fetch_recent_messages(channel_id) do
    token = discord_token()

    if is_nil(token) or token == "" do
      {:error, :no_token}
    else
      url = "#{@discord_api}/channels/#{channel_id}/messages?limit=50"

      case Req.get(url,
             headers: [{"authorization", "Bot #{token}"}],
             receive_timeout: 10_000
           ) do
        {:ok, %{status: status, body: body}} when status in 200..204 ->
          {:ok, body}

        {:ok, %{status: 429, body: body}} ->
          retry_after = get_in(body, ["retry_after"]) || 1.0
          Process.sleep(round(retry_after * 1000))
          fetch_recent_messages(channel_id)

        {:ok, %{status: status, body: body}} ->
          {:error, {:http_error, status, body}}

        {:error, reason} ->
          {:error, reason}
      end
    end
  end

  defp post_to_channel(channel_id, content) do
    token = discord_token()

    if is_nil(token) or token == "" do
      Logger.warning("[Stream.Babysitter] No token, skipping post to #{channel_id}")
      :ok
    else
      url = "#{@discord_api}/channels/#{channel_id}/messages"
      body = Jason.encode!(%{"content" => String.slice(content, 0, 2000)})

      case Req.post(url,
             body: body,
             headers: [
               {"authorization", "Bot #{token}"},
               {"content-type", "application/json"}
             ]
           ) do
        {:ok, %{status: status}} when status in 200..204 ->
          :ok

        {:ok, %{status: status}} ->
          Logger.warning("[Stream.Babysitter] Failed to post ack, status=#{status}")
          :ok

        {:error, reason} ->
          Logger.warning("[Stream.Babysitter] Failed to post ack: #{inspect(reason)}")
          :ok
      end
    end
  end

  defp discord_token do
    Application.get_env(:ema, :discord_bot_token) || System.get_env("DISCORD_BOT_TOKEN")
  end

  defp schedule_poll(interval_ms) do
    Process.send_after(self(), :poll, interval_ms)
  end
end
