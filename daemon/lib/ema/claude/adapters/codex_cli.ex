defmodule Ema.Claude.Adapters.CodexCli do
  @moduledoc """
  Adapter for the OpenAI Codex CLI (`codex`).

  Wraps the `codex` binary via an Erlang Port using `codex exec --full-auto` mode.

  **PTY Note:** Codex CLI requires a pseudo-terminal (PTY) for interactive operation.
  When running in --full-auto mode, PTY is handled by the OS-level port configuration.
  On Linux, use `script -q -c "codex exec ..." /dev/null` or a PTY wrapper if the
  standard Port approach doesn't work. The `porcelain` or `ex_pty` library may be needed
  for full PTY support.

  Output format differs from Claude CLI — Codex emits progress/status lines followed
  by the final result, not structured JSONL throughout.
  """

  @behaviour Ema.Claude.Adapter

  require Logger

  @default_model "o4-mini"

  @impl true
  def start_session(prompt, _session_id, model, opts \\ []) do
    case System.find_executable("codex") do
      nil ->
        {:error, :codex_not_found}

      codex_path ->
        args = build_args(prompt, model, opts)

        # NOTE: Codex may require PTY. Using script(1) wrapper for PTY emulation.
        # If `script` is available, wrap the invocation; otherwise try direct Port.
        {executable, final_args} = maybe_wrap_with_pty(codex_path, args)

        port =
          Port.open({:spawn_executable, executable}, [
            :binary,
            :exit_status,
            :stderr_to_stdout,
            {:args, final_args},
            {:line, 65_536}
          ])

        {:ok, port}
    end
  end

  @impl true
  def send_message(port, _message) when is_port(port) do
    # Codex exec --full-auto runs non-interactively; multi-turn not supported this way.
    {:error, :not_supported_full_auto_mode}
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
      streaming: false,
      multi_turn: false,
      tool_use: true,
      models: ["o4-mini", "o3", "gpt-4.1", "gpt-4.1-mini"],
      task_types: [:code_generation, :code_review, :general],
      session_resume: false,
      requires_pty: true
    }
  end

  @impl true
  def health_check do
    case System.find_executable("codex") do
      nil -> {:error, :codex_not_found}
      _path -> :ok
    end
  end

  @impl true
  def parse_event(raw) when is_binary(raw) do
    line = String.trim(raw)

    cond do
      line == "" ->
        :skip

      String.starts_with?(line, "{") ->
        # Codex sometimes emits JSON status objects
        case Jason.decode(line) do
          {:ok, %{"type" => "result", "output" => output}} ->
            {:ok, %{type: :message_stop, content: output, raw: line}}

          {:ok, %{"type" => "error", "message" => msg}} ->
            {:error, %{message: msg, raw: line}}

          {:ok, data} ->
            {:ok, %{type: :unknown, raw: data}}

          {:error, _} ->
            :skip
        end

      String.starts_with?(line, "Error:") or String.starts_with?(line, "error:") ->
        {:error, %{message: line, raw: line}}

      String.starts_with?(line, "[") ->
        # Progress/status lines like [tool_call], [working], etc.
        :skip

      true ->
        # Plain text output — treat as content
        {:ok, %{type: :text_delta, content: line <> "\n", raw: line}}
    end
  end

  # Private helpers

  defp build_args(prompt, model, _opts) do
    base = ["exec", "--full-auto"]
    base = if model && model != @default_model, do: base ++ ["--model", model], else: base
    base ++ [prompt]
  end

  defp maybe_wrap_with_pty(codex_path, args) do
    case System.find_executable("script") do
      nil ->
        # No PTY wrapper available, try direct execution
        Logger.warning("CodexCli: `script` not found, PTY wrapping unavailable")
        {codex_path, args}

      script_path ->
        # Use script(1) to allocate PTY: script -q -c "codex <args>" /dev/null
        cmd = Enum.join([codex_path | args], " ")
        {script_path, ["-q", "-c", cmd, "/dev/null"]}
    end
  end
end
