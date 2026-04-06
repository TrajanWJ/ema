defmodule Ema.Feedback.Broadcast do
  @moduledoc """
  Central feedback funnel — single point of truth for all EMA output.

  Every message EMA wants to emit goes through here, ensuring it lands in:
    1. Discord (REST API direct post to the right channel)
    2. EMA internal PubSub topic "ema:feedback" — for LiveView, HQ dashboard,
       and any in-process subscriber

  ## Usage

      # Post to a specific Discord channel + EMA internal
      Ema.Feedback.Broadcast.emit(:discord, "1489786483970936933", "message text")

      # Post to EMA internal only (no Discord)
      Ema.Feedback.Broadcast.emit(:internal, nil, "some internal event")

      # Broadcast to all (every channel EMA knows about)
      Ema.Feedback.Broadcast.emit(:all, nil, "system-wide message")

  ## Internal PubSub topic: "ema:feedback"

  Events published:
      {:feedback, %{
        source:     atom,        # :discord | :stream | :pipe | :babysitter | :agent | :system
        channel_id: string|nil,  # Discord channel ID if applicable
        message:    string,
        timestamp:  DateTime,
        metadata:   map
      }}
  """

  require Logger

  @pubsub Ema.PubSub
  @internal_topic "ema:feedback"
  @discord_api "https://discord.com/api/v10"

  # --- Public API ---

  @stream_channels %{
    system_heartbeat: "1489820670333423827",
    agent_thoughts: "1489820679472677044",
    intent_stream: "1489820673760301156",
    pipeline_flow: "1489820676859756606",
    memory_writes: "1489820685101699193",
    intelligence_layer: "1489820682198974525",
    babysitter_digest: "1489856926706827264",
    babysitter_live: "1489786483970936933",
    babysitter_sprint: "1489815795293749258"
  }

  @doc "Emit to a named stream channel by atom key"
  def emit(channel_name, message) when is_atom(channel_name) and is_binary(message) do
    case Map.fetch(@stream_channels, channel_name) do
      {:ok, channel_id} -> emit(:stream, channel_id, message)
      :error -> Logger.warning("[Broadcast] Unknown stream channel: \#{inspect(channel_name)}")
    end
  end

  def stream_channel_id(key), do: Map.get(@stream_channels, key)
  def stream_channels, do: @stream_channels

  @doc "Emit a message to Discord channel + EMA internal PubSub"
  def emit(source, channel_id, message, metadata \\ %{}) when is_binary(message) do
    event = build_event(source, channel_id, message, metadata)

    # 1. Always publish to EMA internal
    publish_internal(event)

    # 2. Post to Discord if channel_id provided
    if channel_id do
      post_discord(channel_id, message)
    end

    :ok
  end

  @doc "Subscribe to the EMA internal feedback stream (call from a GenServer/LiveView)"
  def subscribe do
    Phoenix.PubSub.subscribe(@pubsub, @internal_topic)
  end

  @doc "Get the internal PubSub topic name"
  def topic, do: @internal_topic

  # --- Internals ---

  defp build_event(source, channel_id, message, metadata) do
    %{
      source: source,
      channel_id: channel_id,
      message: message,
      timestamp: DateTime.utc_now(),
      metadata: metadata
    }
  end

  defp publish_internal(event) do
    Phoenix.PubSub.broadcast(@pubsub, @internal_topic, {:feedback, event})
  end

  defp post_discord(channel_id, message) do
    token = System.get_env("DISCORD_BOT_TOKEN")

    unless token do
      Logger.warning("[Feedback.Broadcast] No DISCORD_BOT_TOKEN — skipping Discord post")
      {:error, :no_token}
    else
      url = "#{@discord_api}/channels/#{channel_id}/messages"

      # Discord has a 2000-char limit per message — chunk if needed
      chunks = chunk_message(message, 1990)

      Enum.each(chunks, fn chunk ->
        case Req.post(url,
               headers: [
                 {"Authorization", "Bot #{token}"},
                 {"Content-Type", "application/json"}
               ],
               json: %{content: chunk},
               receive_timeout: 10_000
             ) do
          {:ok, %Req.Response{status: s}} when s in 200..299 ->
            :ok

          {:ok, %Req.Response{status: 429, body: body}} ->
            retry_after = get_in(body, ["retry_after"]) || 2
            Logger.warning("[Feedback.Broadcast] Discord rate limit, sleeping #{retry_after}s")
            :timer.sleep(trunc(retry_after * 1000) + 300)
            # Retry once
            Req.post(url,
              headers: [{"Authorization", "Bot #{token}"}, {"Content-Type", "application/json"}],
              json: %{content: chunk},
              receive_timeout: 10_000
            )

          {:ok, %Req.Response{status: s, body: b}} ->
            Logger.error("[Feedback.Broadcast] Discord #{s}: #{inspect(b)}")

          {:error, reason} ->
            Logger.error("[Feedback.Broadcast] Discord post failed: #{inspect(reason)}")
        end
      end)
    end
  end

  defp chunk_message(message, max_len) do
    message
    |> String.split("\n")
    |> Enum.reduce([""], fn line, [current | rest] ->
      candidate = if current == "", do: line, else: current <> "\n" <> line

      if String.length(candidate) <= max_len do
        [candidate | rest]
      else
        [line, current | rest]
      end
    end)
    |> Enum.reverse()
    |> Enum.reject(&(&1 == ""))
  end
end
