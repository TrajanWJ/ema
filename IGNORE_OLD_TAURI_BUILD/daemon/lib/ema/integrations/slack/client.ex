defmodule Ema.Integrations.Slack.Client do
  @moduledoc "Req-based HTTP client for Slack Web API."

  @base_url "https://slack.com/api"

  def get_token do
    Ema.Settings.get("slack_bot_token")
  end

  def post_message(channel, text) do
    with {:ok, token} <- require_token() do
      Req.post("#{@base_url}/chat.postMessage",
        headers: headers(token),
        json: %{channel: channel, text: text}
      )
      |> handle_response()
    end
  end

  defp require_token do
    case get_token() do
      nil -> {:error, :no_token}
      "" -> {:error, :no_token}
      token -> {:ok, token}
    end
  end

  defp headers(token) do
    [
      {"authorization", "Bearer #{token}"},
      {"content-type", "application/json; charset=utf-8"}
    ]
  end

  defp handle_response({:ok, %Req.Response{status: 200, body: %{"ok" => true} = body}}) do
    {:ok, body}
  end

  defp handle_response({:ok, %Req.Response{status: 200, body: %{"ok" => false, "error" => err}}}) do
    {:error, err}
  end

  defp handle_response({:ok, %Req.Response{status: status, body: body}}) do
    {:error, %{status: status, body: body}}
  end

  defp handle_response({:error, reason}) do
    {:error, reason}
  end
end
