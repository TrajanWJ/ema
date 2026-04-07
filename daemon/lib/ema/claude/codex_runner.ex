defmodule Ema.Claude.CodexRunner do
  @moduledoc """
  Shells out to the Codex CLI for coding-focused executions.

  Uses stdin redirection and an optional `script(1)` PTY wrapper so EMA can drive
  Codex in the same direct CLI style that has already been validated outside EMA.
  """

  @doc """
  Run a prompt through Codex CLI.

  Options:
    - `:model` - Codex/OpenAI model override. If omitted, Codex uses its active config.
    - `:timeout` - command timeout in ms (default: 300_000)
    - `:cmd_fn` - function to use for running commands (default: &System.cmd/3)
    - `:workdir` - working directory for `codex exec -C`
    - `:simulate_tui` - wrap the command with `script(1)` when available (default: true)
    - `:full_auto` - include `--full-auto` (default: true)
  """
  def run(prompt, opts \\ []) when is_binary(prompt) do
    timeout = Keyword.get(opts, :timeout, 300_000)
    cmd_fn = Keyword.get(opts, :cmd_fn, &System.cmd/3)
    workdir = resolve_workdir(Keyword.get(opts, :workdir))
    model = Keyword.get(opts, :model)
    simulate_tui = Keyword.get(opts, :simulate_tui, true)
    full_auto = Keyword.get(opts, :full_auto, true)

    task =
      Task.async(fn ->
        case resolve_codex_path() do
          nil ->
            {:error, %{code: :not_found, message: "Codex CLI not available"}}

          codex_bin ->
            run_via_stdin(codex_bin, prompt, workdir, model, simulate_tui, full_auto, cmd_fn)
        end
      end)

    case Task.yield(task, timeout) || Task.shutdown(task) do
      {:ok, result} -> result
      nil -> {:error, %{code: :timeout, message: "Codex CLI timed out after #{timeout}ms"}}
    end
  end

  def available? do
    not is_nil(resolve_codex_path())
  end

  defp run_via_stdin(codex_bin, prompt, workdir, model, simulate_tui, full_auto, cmd_fn) do
    tmp = System.tmp_dir!()
    prompt_file = Path.join(tmp, "ema-codex-prompt-#{System.unique_integer([:positive])}.txt")

    try do
      File.write!(prompt_file, prompt)

      inner_cmd = build_inner_command(codex_bin, prompt_file, workdir, model, full_auto)

      shell_cmd =
        if simulate_tui and System.find_executable("script") do
          "script -q -e -c #{shell_escape(inner_cmd)} /dev/null"
        else
          inner_cmd
        end

      case cmd_fn.("bash", ["-lc", shell_cmd], stderr_to_stdout: true) do
        {output, 0} -> {:ok, parse_output(output)}
        {error, code} -> {:error, %{code: code, message: error}}
      end
    after
      File.rm(prompt_file)
    end
  end

  defp build_inner_command(codex_bin, prompt_file, workdir, model, full_auto) do
    args =
      [
        shell_escape(codex_bin),
        "exec",
        if(full_auto, do: "--full-auto", else: nil),
        "--skip-git-repo-check",
        "-C",
        shell_escape(workdir),
        if(present?(model), do: "--model", else: nil),
        if(present?(model), do: shell_escape(model), else: nil),
        "-"
      ]
      |> Enum.reject(&is_nil/1)
      |> Enum.join(" ")

    args <> " < " <> shell_escape(prompt_file)
  end

  defp parse_output(output) do
    cleaned =
      output
      |> strip_ansi()
      |> String.replace("\r", "")
      |> String.trim()

    %{
      "result" => extract_result_text(cleaned),
      "raw" => cleaned
    }
  end

  defp extract_result_text(output) do
    case Regex.named_captures(
           ~r/\ncodex\s*\n(?<body>.*?)(?:\ntokens used\s*\n.*)?$/s,
           "\n" <> output
         ) do
      %{"body" => body} ->
        body
        |> String.trim()
        |> dedupe_consecutive_lines()

      _ ->
        output
    end
  end

  defp dedupe_consecutive_lines(text) do
    text
    |> String.split("\n")
    |> Enum.reduce([], fn line, acc ->
      case acc do
        [^line | _] -> acc
        _ -> [line | acc]
      end
    end)
    |> Enum.reverse()
    |> Enum.join("\n")
    |> String.trim()
  end

  defp strip_ansi(text) do
    Regex.replace(~r/\e\[[0-9;?]*[ -\/]*[@-~]/, text, "")
  end

  defp resolve_codex_path do
    System.find_executable("codex")
  end

  defp resolve_workdir(nil), do: File.cwd!()

  defp resolve_workdir(path) when is_binary(path) do
    expanded = Path.expand(path)
    if File.dir?(expanded), do: expanded, else: File.cwd!()
  end

  defp present?(value), do: is_binary(value) and String.trim(value) != ""

  defp shell_escape(value) do
    "'" <> String.replace(to_string(value), "'", "'\"'\"'") <> "'"
  end
end
