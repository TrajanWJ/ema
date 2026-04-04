defmodule Ema.Claude.Adapters.ClaudeCli do
  @moduledoc """
  Adapter for the Claude Code CLI (`claude`).

  Wraps the `claude` binary via an Erlang Port. Uses `--print --output-format stream-json
  --permission-mode bypassPermissions` for non-interactive streaming output.

  Supports:
  - `--session-id` for multi-turn conversations
  - `--model` for model selection
  - `--plugin-dir` for custom plugin directories
  - `--mcp-config` for MCP server configuration

  Output is JSONL (one JSON object per line) in stream-json format.
  """

  @behaviour Ema.Claude.Adapter

  require Logger

  @default_model "claude-opus-4-5"

  @doc "Run a one-shot prompt via Bridge. Public — used as OpenClaw fallback."
  def run(prompt, agent_id \\ nil, opts \\ [])

  def run(prompt, _agent_id, opts) when is_binary(prompt) do
    Ema.Claude.Bridge.run(prompt, opts)
  end

  @impl true
  def start_session(prompt, session_id, model, opts \\ []) do
    case System.find_executable("claude") do
      nil ->
        {:error, :claude_not_found}

      claude_path ->
        args = build_args(prompt, session_id, model, opts)

        port =
          Port.open({:spawn_executable, claude_path}, [
            :binary,
            :exit_status,
            :stderr_to_stdout,
            {:args, args},
            {:line, 65_536}
          ])

        {:ok, port}
    end
  end

  @impl true
  def send_message(port, message) when is_port(port) do
    # Claude CLI --print mode doesn't support interactive input after start.
    # For multi-turn, start a new session with --session-id.
    _ = message
    {:error, :not_supported_use_session_id}
  end

  @impl true
  def stop_session(port) when is_port(port) do
    if Port.info(port) != nil do
      Port.close(port)
    end

    :ok
  end

  @impl true
  def capabilities do
    %{
      streaming: true,
      multi_turn: true,
      tool_use: true,
      models: ["claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-3-5", "claude-opus-4-6"],
      task_types: [:code_generation, :code_review, :research, :creative, :general, :summarization],
      session_resume: true,
      mcp_support: true
    }
  end

  @impl true
  def health_check do
    case System.find_executable("claude") do
      nil -> {:error, :claude_not_found}
      _path -> :ok
    end
  end

  @impl true
  def parse_event(raw) when is_binary(raw) do
    line = String.trim(raw)

    if line == "" do
      :skip
    else
      case Jason.decode(line) do
        {:ok, %{"type" => "text"} = event} ->
          {:ok,
           %{
             type: :text_delta,
             content: event["text"] || "",
             raw: event
           }}

        {:ok, %{"type" => "result"} = event} ->
          {:ok,
           %{
             type: :message_stop,
             content: event["result"] || "",
             usage: %{
               tokens_in: get_in(event, ["usage", "input_tokens"]) || 0,
               tokens_out: get_in(event, ["usage", "output_tokens"]) || 0
             },
             session_id: event["session_id"],
             cost_usd: event["cost_usd"],
             raw: event
           }}

        {:ok, %{"type" => "assistant"} = event} ->
          content = extract_assistant_content(event)

          {:ok,
           %{
             type: :text_delta,
             content: content,
             raw: event
           }}

        {:ok, %{"type" => "error"} = event} ->
          {:error, %{message: event["message"] || "Unknown error", raw: event}}

        {:ok, %{"type" => type}} when type in ["system", "user"] ->
          :skip

        {:ok, event} ->
          {:ok, %{type: :unknown, raw: event}}

        {:error, _} ->
          Logger.debug("ClaudeCli: failed to parse JSON line: #{inspect(line)}")
          :skip
      end
    end
  end

  # Private helpers

  defp build_args(prompt, session_id, model, opts) do
    base = [
      "--print",
      "--output-format",
      "stream-json",
      "--permission-mode",
      "bypassPermissions",
      "--model",
      model || @default_model
    ]

    base = if session_id && session_id != "", do: base ++ ["--session-id", session_id], else: base

    base =
      if plugin_dir = Keyword.get(opts, :plugin_dir),
        do: base ++ ["--plugin-dir", plugin_dir],
        else: base

    base =
      if mcp_config = Keyword.get(opts, :mcp_config),
        do: base ++ ["--mcp-config", mcp_config],
        else: base

    base ++ [prompt]
  end

  defp extract_assistant_content(%{"message" => %{"content" => content}}) when is_list(content) do
    content
    |> Enum.filter(&(&1["type"] == "text"))
    |> Enum.map_join("", & &1["text"])
  end

  defp extract_assistant_content(_), do: ""
end
