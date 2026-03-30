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
    _timeout = Keyword.get(opts, :timeout, 120_000)
    cmd_fn = Keyword.get(opts, :cmd_fn, &System.cmd/3)

    args = ["--print", "--output-format", "json", "--model", model, "-p", prompt]

    try do
      case cmd_fn.("claude", args, stderr_to_stdout: true) do
        {output, 0} -> {:ok, parse_output(output)}
        {error, code} -> {:error, %{code: code, message: error}}
      end
    rescue
      e in ErlangError ->
        Logger.warning("Claude CLI not available: #{inspect(e)}")
        {:error, %{code: :not_found, message: "Claude CLI not available"}}
    end
  end

  @doc """
  Check if the Claude CLI is available on the system.
  """
  def available? do
    case System.find_executable("claude") do
      nil -> false
      _path -> true
    end
  end

  defp parse_output(output) do
    case Jason.decode(output) do
      {:ok, parsed} -> parsed
      {:error, _} -> %{"raw" => output}
    end
  end
end
