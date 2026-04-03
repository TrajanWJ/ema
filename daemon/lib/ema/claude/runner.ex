defmodule Ema.Claude.Runner do
  @moduledoc """
  Shells out to the Claude CLI to run prompts.
  Handles JSON output parsing and graceful fallback when CLI is unavailable.
  """

  require Logger

  @doc """
  Run a prompt through Claude CLI.

  Options:
    - :model - Claude model to use (default: "sonnet")
    - :timeout - command timeout in ms (default: 120_000)
    - :cmd_fn - function to use for running commands (default: &System.cmd/3, for testing)
  """
  def run(prompt, opts \\ []) do
    model = Keyword.get(opts, :model, "sonnet")
    timeout = Keyword.get(opts, :timeout, 300_000)
    cmd_fn = Keyword.get(opts, :cmd_fn, &System.cmd/3)

    args = ["--print", "--output-format", "json", "--model", model, "--permission-mode", "bypassPermissions", "-p", prompt]

    task =
      Task.async(fn ->
        try do
          # Resolve full path to claude binary — daemon PATH doesn't include ~/.local/bin
          claude_bin = resolve_claude_path()
          case cmd_fn.(claude_bin, args, stderr_to_stdout: true) do
            {output, 0} -> {:ok, parse_output(output)}
            {error, code} -> {:error, %{code: code, message: error}}
          end
        rescue
          e in ErlangError ->
            Logger.warning("Claude CLI not available: #{inspect(e)}")
            {:error, %{code: :not_found, message: "Claude CLI not available"}}
        end
      end)

    case Task.yield(task, timeout) || Task.shutdown(task) do
      {:ok, result} -> result
      nil -> {:error, %{code: :timeout, message: "Claude CLI timed out after #{timeout}ms"}}
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
      _path -> true
    end
  end

  def resolve_claude_path do
    case System.find_executable("claude") do
      nil ->
        fallback = Path.join([System.get_env("HOME", "/root"), ".local", "bin", "claude"])
        if File.exists?(fallback), do: fallback, else: "claude"
      path -> path
    end
  end

  defp parse_output(output) do
    case Jason.decode(output) do
      {:ok, parsed} -> parsed
      {:error, _} -> %{"raw" => output}
    end
  end
end
