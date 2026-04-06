defmodule Ema.CLI.Commands.Integration do
  @moduledoc "CLI commands for third-party integrations."

  alias Ema.CLI.Output

  def handle([:status], _parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.get("/integrations/status") do
      {:ok, body} -> if opts[:json], do: Output.json(body), else: Output.detail(body)
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle([:github], _parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.post("/integrations/github/connect") do
      {:ok, resp} ->
        Output.success("GitHub connected")
        if opts[:json], do: Output.json(resp)

      {:error, reason} ->
        Output.error(inspect(reason))
    end
  end

  def handle([:slack], _parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.post("/integrations/slack/connect") do
      {:ok, resp} ->
        Output.success("Slack connected")
        if opts[:json], do: Output.json(resp)

      {:error, reason} ->
        Output.error(inspect(reason))
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown integration subcommand: #{inspect(sub)}")
  end
end
