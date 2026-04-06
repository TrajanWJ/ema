defmodule Ema.CLI.Commands.Config do
  @moduledoc "CLI commands for settings/config."

  alias Ema.CLI.{Helpers, Output}

  def handle([:view], _parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.get("/settings") do
      {:ok, body} ->
        settings = Helpers.extract_record(body, "settings")
        if opts[:json], do: Output.json(settings), else: Output.detail(settings)

      {:error, reason} ->
        Output.error(inspect(reason))
    end
  end

  def handle([:set], parsed, _transport, opts) do
    key = parsed.args.key
    value = parsed.args.value

    case Ema.CLI.Transport.Http.put("/settings", %{key => value}) do
      {:ok, resp} ->
        Output.success("Set #{key} = #{value}")
        if opts[:json], do: Output.json(resp)

      {:error, reason} ->
        Output.error(inspect(reason))
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown config subcommand: #{inspect(sub)}")
  end
end
