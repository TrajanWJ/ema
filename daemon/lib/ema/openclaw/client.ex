defmodule Ema.OpenClaw.Client do
  @moduledoc "HTTP client for the OpenClaw gateway REST API."
  alias Ema.OpenClaw.Config
  require Logger

  @timeout 120_000

  def get_status, do: get("/api/status")

  @doc """
  Dispatch a prompt to a specific OpenClaw agent via chat completions.
  The model field routes to the named agent (researcher, coder, main, etc).
  Returns {:ok, %{text: str, usage: map, agent_id: str}} or {:error, reason}.
  """
  def chat(agent_id, prompt, opts \\ []) do
    timeout = Keyword.get(opts, :timeout, @timeout)

    body = %{
      model: agent_id,
      messages: [%{role: "user", content: prompt}],
      stream: false
    }

    case post("/v1/chat/completions", body, timeout) do
      {:ok, %{"choices" => [%{"message" => %{"content" => content}} | _]} = resp} ->
        {:ok, %{text: content, usage: resp["usage"] || %{}, agent_id: agent_id}}

      {:ok, other} ->
        Logger.warning("[OpenClaw.Client] Unexpected chat response: #{inspect(other)}")
        {:error, {:unexpected_response, other}}

      {:error, _} = err ->
        err
    end
  end

  def invoke_tool(tool_name, args \\ %{}) do
    post("/tools/invoke", %{tool: tool_name, arguments: args}, @timeout)
  end

  def list_sessions, do: get("/api/sessions/list")

  # Legacy compat
  def send_message(session_id, message), do: chat(session_id, message)

  def spawn_agent(agent_type, opts \\ %{}) do
    prompt = Map.get(opts, "prompt", Map.get(opts, :prompt, "Hello"))
    chat(agent_type, prompt)
  end

  # -- HTTP helpers --

  defp get(path) do
    url = Config.gateway_url() <> path

    case Req.get(url, headers: auth_headers(), receive_timeout: @timeout) do
      {:ok, %Req.Response{status: s, body: b}} when s in 200..299 -> {:ok, b}
      {:ok, %Req.Response{status: s, body: b}} -> {:error, %{status: s, body: b}}
      {:error, reason} -> {:error, reason}
    end
  end

  defp post(path, body, timeout) do
    url = Config.gateway_url() <> path

    case Req.post(url, json: body, headers: auth_headers(), receive_timeout: timeout) do
      {:ok, %Req.Response{status: s, body: b}} when s in 200..299 -> {:ok, b}
      {:ok, %Req.Response{status: s, body: b}} -> {:error, %{status: s, body: b}}
      {:error, reason} -> {:error, reason}
    end
  end

  defp auth_headers do
    case Config.auth_token() do
      nil -> []
      token -> [{"authorization", "Bearer #{token}"}]
    end
  end
end
