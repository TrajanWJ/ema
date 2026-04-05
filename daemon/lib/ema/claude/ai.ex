defmodule Ema.Claude.AI do
  @moduledoc """
  Unified AI dispatch — routes through Bridge or Runner based on config.

  When `config :ema, :ai_backend` is `:bridge`, uses the multi-backend
  Bridge with smart routing. When `:runner` (default), uses the legacy
  single-backend Runner.
  """

  require Logger

  @doc """
  Run a prompt through the configured AI backend.

  Options are passed through to the underlying backend.
  """
  def run(prompt, opts \\ []) do
    case Application.get_env(:ema, :ai_backend, :runner) do
      :bridge ->
        case Ema.Claude.Bridge.run(prompt, opts) do
          {:ok, %{text: text}} -> parse_bridge_result(text)
          {:ok, result} -> {:ok, result}
          {:error, reason} -> maybe_fallback_to_codex(prompt, opts, reason)
        end

      _runner ->
        Ema.Claude.Runner.run(prompt, opts)
    end
  end

  defp maybe_fallback_to_codex(prompt, opts, reason) do
    if codex_fallback_allowed?(reason) do
      Logger.warning("AI.run: bridge failed, falling back to raw codex: #{inspect(reason)}")

      case run_via_raw_codex(prompt, opts) do
        {:ok, result} -> {:ok, result}
        {:error, codex_reason} -> {:error, %{bridge_error: reason, codex_error: codex_reason}}
      end
    else
      {:error, reason}
    end
  end

  defp codex_fallback_allowed?(reason) do
    text = inspect(reason)

    String.contains?(text, "401") or
      String.contains?(text, "expired") or
      String.contains?(text, "authenticate") or
      String.contains?(text, "OAuth token")
  end

  defp run_via_raw_codex(prompt, _opts) when is_binary(prompt) do
    case System.find_executable("script") do
      nil ->
        {:error, :script_not_found}

      script_path ->
        case System.find_executable("codex") do
          nil ->
            {:error, :codex_not_found}

          codex_path ->
            tmp = Path.join(System.tmp_dir!(), "ema-codex-prompt-#{System.unique_integer([:positive])}.txt")
            File.write!(tmp, prompt)

            shell_cmd = ~s(#{codex_path} exec --full-auto --skip-git-repo-check - < #{tmp})

            result =
              System.cmd("/bin/bash", ["-lc", shell_cmd],
                stderr_to_stdout: true,
                cd: File.cwd!(),
                env: []
              )

            File.rm(tmp)

            case result do
              {output, 0} ->
                parse_codex_output(output)

              {output, code} ->
                {:error, %{exit_code: code, output: String.slice(output || "", -2000, 2000)}}
            end
        end
    end
  end

  defp parse_codex_output(output) when is_binary(output) do
    trimmed = String.trim(output)

    case Regex.scan(~r/\{(?:[^{}]|(?R))*\}/Us, trimmed) do
      matches when is_list(matches) and matches != [] ->
        json = matches |> List.last() |> List.first()

        case Jason.decode(json) do
          {:ok, parsed} -> {:ok, parsed}
          {:error, _} -> {:ok, %{"raw" => trimmed}}
        end

      _ ->
        {:ok, %{"raw" => trimmed}}
    end
  end

  defp parse_bridge_result(text) when is_binary(text) do
    case Jason.decode(text) do
      {:ok, parsed} -> {:ok, parsed}
      {:error, _} -> {:ok, %{"raw" => text}}
    end
  end

  defp parse_bridge_result(_), do: {:ok, %{}}
end
