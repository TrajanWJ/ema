defmodule Ema.Claude.OAuthCoderRunner do
  @moduledoc """
  Fallback runner that drives Claude or Codex through `oauth-coder`.

  This preserves existing terminal OAuth state and uses tmux-backed sessions
  when direct subprocess control is unavailable or unstable.
  """

  require Logger

  def run(provider, prompt, opts \\ [])
      when provider in [:claude, :codex] and is_binary(prompt) do
    timeout = Keyword.get(opts, :timeout, 300_000)
    cmd_fn = Keyword.get(opts, :cmd_fn, &System.cmd/3)
    workdir = Keyword.get(opts, :workdir, File.cwd!())
    model = Keyword.get(opts, :model)
    session_id = Keyword.get(opts, :session_id)

    case System.find_executable("oauth-coder") do
      nil ->
        {:error, %{code: :not_found, message: "oauth-coder not available"}}

      oauth_coder ->
        args =
          [
            "ask",
            Atom.to_string(provider),
            prompt,
            "--close",
            "--cwd",
            workdir
          ]
          |> maybe_add("--model", model)
          |> maybe_add("--session-id", session_id)

        case cmd_fn.(oauth_coder, args, stderr_to_stdout: true, timeout: timeout) do
          {output, 0} ->
            {:ok,
             %{
               "result" => String.trim(output),
               "raw" => String.trim(output),
               "transport" => "tmux_oauth_coder"
             }}

          {output, code} ->
            Logger.warning("[OAuthCoderRunner] #{provider} fallback failed (#{code})")
            {:error, %{code: code, message: output}}
        end
    end
  end

  def available? do
    not is_nil(System.find_executable("oauth-coder"))
  end

  defp maybe_add(args, _flag, nil), do: args
  defp maybe_add(args, _flag, ""), do: args
  defp maybe_add(args, flag, value), do: args ++ [flag, value]
end
