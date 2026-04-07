defmodule Ema.CLI.Commands.Voice do
  @moduledoc "CLI commands for voice sessions."

  alias Ema.CLI.{Helpers, Output}

  @columns [{"ID", :id}, {"Status", :status}, {"Created", :inserted_at}]

  def handle([:list], _parsed, transport, opts) do
    case transport.get("/voice/sessions") do
      {:ok, body} -> Output.render(Helpers.extract_list(body, "sessions"), @columns, json: opts[:json])
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle([:create], _parsed, transport, opts) do
    case transport.post("/voice/sessions") do
      {:ok, resp} ->
        Output.success("Voice session created")
        if opts[:json], do: Output.json(resp)

      {:error, reason} ->
        Output.error(inspect(reason))
    end
  end

  def handle([:end_session], parsed, transport, _opts) do
    case transport.delete("/voice/sessions/#{parsed.args.id}") do
      {:ok, _} -> Output.success("Voice session ended")
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown voice subcommand: #{inspect(sub)}")
  end
end
