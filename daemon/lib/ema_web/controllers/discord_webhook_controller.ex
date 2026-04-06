defmodule EmaWeb.DiscordWebhookController do
  @moduledoc """
  Receives Discord messages from webhook callers and
  routes them through EMA's Voice/Jarvis pipeline.

  POST /api/discord/message
    %{"channel_id" => "...", "user_id" => "...", "text" => "..."}

  Returns 200 immediately (async processing). The response is broadcast
  to Phoenix.PubSub topic "discord:responses" as {:response, channel_id, text}.
  """
  use EmaWeb, :controller
  require Logger

  alias Ema.Discord.Bridge

  def receive(conn, %{"channel_id" => channel_id, "user_id" => user_id, "text" => text})
      when is_binary(channel_id) and is_binary(text) and byte_size(text) > 0 do
    # Process async — return 200 immediately so webhook doesn't time out
    Task.start(fn ->
      case Bridge.receive_message(channel_id, user_id, text) do
        {:ok, response} ->
          Phoenix.PubSub.broadcast(
            Ema.PubSub,
            "discord:responses",
            {:response, channel_id, response}
          )

        {:error, reason} ->
          Logger.error("Discord Bridge failed for channel #{channel_id}: #{inspect(reason)}")
          Phoenix.PubSub.broadcast(
            Ema.PubSub,
            "discord:responses",
            {:error, channel_id, inspect(reason)}
          )
      end
    end)

    conn
    |> put_status(:ok)
    |> json(%{status: "processing", channel_id: channel_id})
  end

  def receive(conn, params) do
    Logger.warning("Discord webhook missing required fields: #{inspect(Map.keys(params))}")

    conn
    |> put_status(:unprocessable_entity)
    |> json(%{
      error: "Missing required fields",
      required: ["channel_id", "user_id", "text"],
      received: Map.keys(params)
    })
  end
end
