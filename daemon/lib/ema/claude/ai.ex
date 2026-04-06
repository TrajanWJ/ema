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
    task_type = Keyword.get(opts, :task_type, :general)
    requested_provider = requested_provider(opts, task_type)
    use_tmux_fallback = Keyword.get(opts, :tmux_fallback, false)

    case requested_provider do
      :codex ->
        case Ema.Claude.CodexRunner.run(prompt, opts) do
          {:ok, result} ->
            {:ok,
             attach_routing_metadata(result, %{
               requested_provider: "codex-local",
               actual_provider: "codex-local",
               backend: "codex_runner",
               task_type: task_type,
               model: Keyword.get(opts, :model)
             })}

          {:error, reason} = error ->
            cond do
              use_tmux_fallback and Ema.Claude.OAuthCoderRunner.available?() ->
                with {:ok, result} <- Ema.Claude.OAuthCoderRunner.run(:codex, prompt, opts) do
                  {:ok,
                   attach_routing_metadata(result, %{
                     requested_provider: "codex-local",
                     actual_provider: "codex-local",
                     backend: "oauth_coder_tmux",
                     transport: "tmux",
                     fallback_from: "codex_runner",
                     fallback_reason: inspect(reason),
                     task_type: task_type,
                     model: Keyword.get(opts, :model)
                   })}
                end

              Keyword.get(opts, :allow_fallback, true) ->
              Logger.warning("[AI] Codex unavailable, falling back to Claude: #{inspect(reason)}")

              with {:ok, result} <- run_claude_backend(prompt, opts) do
                {:ok,
                 attach_routing_metadata(result, %{
                   requested_provider: "codex-local",
                   actual_provider: "claude-local",
                   fallback_from: "codex-local",
                   fallback_reason: inspect(reason),
                   backend: backend_name(),
                   task_type: task_type,
                   model: Keyword.get(opts, :model)
                 })}
              end
              true ->
                error
            end
        end

      :claude ->
        if use_tmux_fallback and Ema.Claude.OAuthCoderRunner.available?() do
          with {:ok, result} <- Ema.Claude.OAuthCoderRunner.run(:claude, prompt, opts) do
            {:ok,
             attach_routing_metadata(result, %{
               requested_provider: "claude-local",
               actual_provider: "claude-local",
               backend: "oauth_coder_tmux",
               transport: "tmux",
               task_type: task_type,
               model: Keyword.get(opts, :model)
             })}
          end
        else
          with {:ok, result} <- run_claude_backend(prompt, opts) do
            {:ok,
             attach_routing_metadata(result, %{
               requested_provider: "claude-local",
               actual_provider: "claude-local",
               backend: backend_name(),
               task_type: task_type,
               model: Keyword.get(opts, :model)
             })}
          end
        end
    end
  end

  defp run_claude_backend(prompt, opts) do
    case Application.get_env(:ema, :ai_backend, :runner) do
      :bridge ->
        case Ema.Claude.Bridge.run(prompt, opts) do
          {:ok, %{text: text}} ->
            parse_bridge_result(text)

          {:ok, result} ->
            {:ok, result}

          {:error, reason} ->
            Logger.warning("[AI] Bridge failed (#{inspect(reason)}), falling back to Runner (claude CLI)")
            Ema.Claude.Runner.run(prompt, opts)
        end

      _runner ->
        Ema.Claude.Runner.run(prompt, opts)
    end
  end

  defp requested_provider(opts, task_type) do
    provider_hint = Keyword.get(opts, :provider) || Keyword.get(opts, :provider_id)

    cond do
      provider_hint in [:codex, "codex", :codex_local, "codex-local"] -> :codex
      task_type == :code_generation -> :codex
      true -> :claude
    end
  end

  defp attach_routing_metadata(result, metadata) when is_map(result) do
    Map.put(result, "_ema", stringify_map(metadata))
  end

  defp attach_routing_metadata(result, metadata) do
    %{"result" => to_string(result), "_ema" => stringify_map(metadata)}
  end

  defp stringify_map(map) do
    map
    |> Enum.reject(fn {_k, v} -> is_nil(v) end)
    |> Map.new(fn {k, v} -> {to_string(k), v} end)
  end

  defp backend_name do
    case Application.get_env(:ema, :ai_backend, :runner) do
      :bridge -> "bridge"
      _ -> "runner"
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
