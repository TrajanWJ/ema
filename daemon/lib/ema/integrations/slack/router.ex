defmodule Ema.Integrations.Slack.Router do
  @moduledoc "Routes Slack events and slash commands to handlers."

  alias Ema.Integrations.Slack.Bot

  def route_command(%{"command" => "/ema", "text" => text} = params) do
    {command, rest} = parse_subcommand(text)
    Bot.handle_command(command, Map.put(params, "text", rest))
  end

  def route_command(_params) do
    %{response_type: "ephemeral", text: "Unknown command."}
  end

  def route_event(%{"type" => "url_verification", "challenge" => challenge}) do
    {:challenge, challenge}
  end

  def route_event(%{"event" => %{"type" => "app_mention", "text" => text, "channel" => channel}}) do
    {:mention, %{text: text, channel: channel}}
  end

  def route_event(_payload) do
    :ok
  end

  defp parse_subcommand(text) do
    text = String.trim(text)

    case String.split(text, " ", parts: 2) do
      [command] -> {command, ""}
      [command, rest] -> {command, rest}
      [] -> {"status", ""}
    end
  end
end
