defmodule Ema.CLI.Transport do
  @moduledoc """
  Transport behaviour for CLI commands.
  Resolved at startup: Direct (in-node) when BEAM is reachable, Http fallback otherwise.
  """

  @type result :: {:ok, term()} | {:error, term()}
  @type opts :: keyword()

  @callback call(module :: atom(), function :: atom(), args :: [term()]) :: result()

  @doc "Resolve the best available transport"
  @spec resolve(keyword()) :: module()
  def resolve(opts \\ []) do
    host = Keyword.get(opts, :host)

    cond do
      host != nil ->
        Ema.CLI.Transport.Http

      direct_available?() ->
        Ema.CLI.Transport.Direct

      true ->
        Ema.CLI.Transport.Http
    end
  end

  defp direct_available? do
    case :erlang.whereis(Ema.Repo) do
      :undefined -> false
      pid when is_pid(pid) -> true
    end
  rescue
    _ -> false
  end
end
