defmodule Ema.Pipes.Actions.NotifyAction do
  @moduledoc """
  Pipes Action: Send Notifications.

  Sends a rendered notification via Discord, Telegram, or Phoenix PubSub.

  ## Config Keys

    - `channel`          — "discord" | "telegram" | "pubsub" (default: "pubsub")
    - `target`           — channel id or topic name (required for discord/telegram)
    - `message_template` — string with {{variable}} placeholders from payload
    - `topic`            — PubSub topic override (default: "notifications:pipes")

  ## Example Pipe Config

      %{
        action_id: "notify",
        config: %{
          "channel"          => "discord",
          "target"           => "1234567890",
          "message_template" => "Task {{title}} was completed by {{user}}"
        }
      }
  """

  require Logger

  @default_topic "notifications:pipes"

  @doc "Render and dispatch notification."
  def execute(payload, config) do
    config = normalize_config(config)

    with {:ok, message} <- render_message(payload, config.message_template) do
      Logger.debug(
        "[NotifyAction] Sending via #{config.channel}: #{String.slice(message, 0, 80)}..."
      )

      dispatch(config.channel, config.target, message, config.topic, payload)
    end
  end

  # ── Private ──────────────────────────────────────────────────────────────────

  defp normalize_config(config) when is_map(config) do
    %{
      channel: config["channel"] || config[:channel] || "pubsub",
      target: config["target"] || config[:target],
      message_template:
        config["message_template"] || config[:message_template] || "Pipe event: {{event_type}}",
      topic: config["topic"] || config[:topic] || @default_topic
    }
  end

  defp render_message(payload, template) do
    rendered =
      Regex.replace(~r/\{\{(\w+)\}\}/, template, fn _, key ->
        val = payload[key] || payload[String.to_atom(key)]
        to_string(val || "")
      end)

    {:ok, rendered}
  rescue
    e -> {:error, {:template_render_failed, Exception.message(e)}}
  end

  defp dispatch("discord", target, message, _topic, _payload) when is_binary(target) do
    if Code.ensure_loaded?(Ema.Discord.Bridge) do
      # Discord bridge — use channel_id directly
      Logger.info("[NotifyAction] Discord -> #{target}: #{message}")
      # Discord.Bridge is a chat session manager; for outbound we broadcast via PubSub
      # so the Discord handler picks it up.
      Phoenix.PubSub.broadcast(Ema.PubSub, "discord:outbound:#{target}", {:send_message, message})
      {:ok, :dispatched}
    else
      fallback_pubsub("discord:outbound:#{target}", message)
    end
  end

  defp dispatch("discord", nil, message, topic, _payload) do
    Logger.warning(
      "[NotifyAction] Discord notify with no target — falling back to PubSub topic #{topic}"
    )

    fallback_pubsub(topic, message)
  end

  defp dispatch("telegram", target, message, _topic, _payload) when is_binary(target) do
    Phoenix.PubSub.broadcast(Ema.PubSub, "telegram:outbound:#{target}", {:send_message, message})
    {:ok, :dispatched}
  end

  defp dispatch("telegram", nil, message, topic, _payload) do
    Logger.warning(
      "[NotifyAction] Telegram notify with no target — falling back to PubSub topic #{topic}"
    )

    fallback_pubsub(topic, message)
  end

  defp dispatch("pubsub", _target, message, topic, payload) do
    event = %{
      message: message,
      payload: payload,
      timestamp: DateTime.utc_now()
    }

    Phoenix.PubSub.broadcast(Ema.PubSub, topic, {:pipe_notification, event})
    {:ok, :dispatched}
  end

  defp dispatch(channel, _target, message, topic, _payload) do
    Logger.warning("[NotifyAction] Unknown channel '#{channel}' — broadcasting to #{topic}")
    fallback_pubsub(topic, message)
  end

  defp fallback_pubsub(topic, message) do
    Phoenix.PubSub.broadcast(Ema.PubSub, topic, {:pipe_notification, %{message: message}})
    {:ok, :dispatched}
  end
end
