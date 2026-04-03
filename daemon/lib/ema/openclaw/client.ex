defmodule Ema.OpenClaw.Client do
  @moduledoc """
  HTTP client for the OpenClaw gateway REST API.
  """

  alias Ema.OpenClaw.Config

  @timeout 30_000

  def get_status do
    get("/api/status")
  end

  def send_message(session_id, message) when is_binary(session_id) and is_binary(message) do
    post("/api/sessions/#{session_id}/messages", %{content: message})
  end

  def list_sessions do
    get("/api/sessions")
  end

  def spawn_agent(agent_type, opts \\ %{}) do
    post("/api/agents/spawn", Map.merge(%{type: agent_type}, opts))
  end

  # -- HTTP helpers --

  defp get(path) do
    url = Config.gateway_url() <> path

    case Req.get(url, headers: auth_headers(), receive_timeout: @timeout) do
      {:ok, %Req.Response{status: status, body: body}} when status in 200..299 ->
        {:ok, body}

      {:ok, %Req.Response{status: status, body: body}} ->
        {:error, %{status: status, body: body}}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp post(path, body) do
    url = Config.gateway_url() <> path

    case Req.post(url, json: body, headers: auth_headers(), receive_timeout: @timeout) do
      {:ok, %Req.Response{status: status, body: body}} when status in 200..299 ->
        {:ok, body}

      {:ok, %Req.Response{status: status, body: body}} ->
        {:error, %{status: status, body: body}}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp auth_headers do
    case Config.auth_token() do
      nil -> []
      token -> [{"authorization", "Bearer #{token}"}]
    end
  end
end
