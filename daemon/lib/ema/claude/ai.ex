defmodule Ema.Claude.AI do
  @moduledoc """
  Unified AI dispatch — routes through Bridge or Runner based on config.

  When `config :ema, :ai_backend` is `:bridge`, uses the multi-backend
  Bridge with smart routing. When `:runner` (default), uses the legacy
  single-backend Runner.
  """

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
          {:error, _} = error -> error
        end

      _runner ->
        Ema.Claude.Bridge.run(prompt, opts)
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
