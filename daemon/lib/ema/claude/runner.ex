defmodule Ema.Claude.Runner do
  @moduledoc """
  Shells out to the Claude CLI to run prompts.
  Handles JSON output parsing and graceful fallback when CLI is unavailable.
  """

  alias Ema.Claude.{Failure, Preflight}
  alias Ema.Intelligence.CostGovernor

  require Logger

  @doc """
  Run a prompt through Claude CLI.

  Options:
    - :model - Claude model to use (default: "sonnet")
    - :timeout - command timeout in ms (default: 300_000)
    - :cmd_fn - function to use for running commands (default: &System.cmd/3, for testing)
    - :stage - pipeline stage atom for failure classification
    - :skip_preflight - skip preflight checks (default: false)
    - :domain - cost governor domain (default: :system)
  """
  def run(prompt, opts \\ []) do
    model = Keyword.get(opts, :model, "sonnet")
    default_timeout = Application.get_env(:ema, :timeouts, []) |> Keyword.get(:claude_runner, 300_000)
    timeout = Keyword.get(opts, :timeout, default_timeout)
    cmd_fn = Keyword.get(opts, :cmd_fn, &System.cmd/3)
    stage = Keyword.get(opts, :stage)
    skip_preflight = Keyword.get(opts, :skip_preflight, false)
    domain = Keyword.get(opts, :domain, :system)

    with :ok <- governor_check(domain),
         :ok <- maybe_preflight(prompt, stage, skip_preflight) do
      effective_model = CostGovernor.recommended_model(model)

      task =
        Task.async(fn ->
          try do
            claude_bin = resolve_claude_path()
            run_via_stdin(claude_bin, prompt, effective_model, cmd_fn)
          rescue
            e in ErlangError ->
              Logger.warning("Claude CLI not available: #{inspect(e)}")
              {:error, %{code: :not_found, message: "Claude CLI not available"}}
          end
        end)

      case Task.yield(task, timeout) || Task.shutdown(task) do
        {:ok, {:error, reason} = error} ->
          record_failure(reason, stage)
          error

        {:ok, result} ->
          result

        nil ->
          error = %{code: :timeout, message: "Claude CLI timed out after #{timeout}ms"}
          record_failure(error, stage)
          {:error, error}
      end
    end
  end

  defp maybe_preflight(_prompt, _stage, true), do: :ok

  defp maybe_preflight(prompt, stage, false) do
    case Preflight.run!(prompt: prompt, stage: stage) do
      :ok -> :ok
      {:error, failure} -> {:error, %{code: :preflight_failed, message: failure.raw_reason}}
    end
  end

  defp record_failure(reason, stage) do
    failure = Failure.classify_runner_error(reason, stage: stage)
    Failure.record(failure)
  end

  # Write prompt to a temp file and redirect via bash.
  # This avoids:
  #   1. The 3-second stdin wait ("Warning: no stdin data received in 3s")
  #   2. That warning prefix prepended to JSON output breaking parse_output
  #   3. Argument-length limits on very large prompts
  #
  # The temp file path is shell-safe (only alphanumerics + path separators).
  # No prompt content is interpolated into the shell command.
  defp run_via_stdin(claude_bin, prompt, model, cmd_fn) do
    tmp = System.tmp_dir!()
    prompt_file = Path.join(tmp, "ema-prompt-#{System.unique_integer([:positive])}.txt")

    try do
      File.write!(prompt_file, prompt)

      # Build the shell command — only safe values interpolated (bin path, model, file path)
      # Prompt content stays in the file, never touches the shell command line
      shell_cmd =
        "#{claude_bin} --print --output-format json --model #{model} --permission-mode bypassPermissions < #{prompt_file}"

      case cmd_fn.("bash", ["-c", shell_cmd], stderr_to_stdout: true) do
        {output, 0} -> {:ok, parse_output(output)}
        {error, code} -> {:error, %{code: code, message: error}}
      end
    after
      File.rm(prompt_file)
    end
  end

  @doc """
  Check if the Claude CLI is available on the system.
  """
  def available? do
    case System.find_executable("claude") do
      nil ->
        fallback = Path.join([System.get_env("HOME", "/root"), ".local", "bin", "claude"])
        File.exists?(fallback)

      _path ->
        true
    end
  end

  def resolve_claude_path do
    case System.find_executable("claude") do
      nil ->
        fallback = Path.join([System.get_env("HOME", "/root"), ".local", "bin", "claude"])
        if File.exists?(fallback), do: fallback, else: "claude"

      path ->
        path
    end
  end

  defp parse_output(output) do
    # Strip any warning/noise lines before the JSON object.
    # Claude sometimes prefixes output with warnings like:
    # "Warning: no stdin data received in 3s..."
    json_str =
      output
      |> String.split("\n")
      |> Enum.drop_while(fn line -> not String.starts_with?(String.trim(line), "{") end)
      |> Enum.join("\n")

    case Jason.decode(json_str) do
      {:ok, parsed} ->
        parsed

      {:error, _} ->
        Logger.warning(
          "[Runner] Failed to parse Claude output as JSON, returning raw: #{String.slice(output, 0, 200)}"
        )

        %{"raw" => output}
    end
  end

  defp governor_check(domain) do
    try do
      case CostGovernor.allowed?(domain) do
        :ok ->
          :ok

        {:error, :budget_exceeded, _tier, msg} ->
          {:error, %{code: :budget_exceeded, message: msg}}
      end
    rescue
      _ -> :ok
    end
  end
end
