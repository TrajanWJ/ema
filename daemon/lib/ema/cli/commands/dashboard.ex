defmodule Ema.CLI.Commands.Dashboard do
  @moduledoc "CLI command for executive dashboard."

  alias Ema.CLI.Output

  def handle([], _parsed, transport, opts) do
    case transport.get("/dashboard/today") do
      {:ok, body} -> if opts[:json], do: Output.json(body), else: Output.detail(body)
      {:error, reason} -> Output.error(inspect(reason))
    end
  end
end
