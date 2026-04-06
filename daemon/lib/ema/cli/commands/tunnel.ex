defmodule Ema.CLI.Commands.Tunnel do
  @moduledoc "CLI commands for network tunnels."

  alias Ema.CLI.{Helpers, Output}

  @columns [{"PID", :pid}, {"Host", :host}, {"Port", :port}, {"Status", :status}]

  def handle([:list], _parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.get("/tunnels") do
      {:ok, body} -> Output.render(Helpers.extract_list(body, "tunnels"), @columns, json: opts[:json])
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle([:create], parsed, _transport, opts) do
    body = Helpers.compact_map([{"host", parsed.args.host}, {"port", parsed.options[:port]}])

    case Ema.CLI.Transport.Http.post("/tunnels", body) do
      {:ok, resp} ->
        Output.success("Tunnel created")
        if opts[:json], do: Output.json(resp)

      {:error, reason} ->
        Output.error(inspect(reason))
    end
  end

  def handle([:delete], parsed, _transport, _opts) do
    case Ema.CLI.Transport.Http.delete("/tunnels/#{parsed.args.pid}") do
      {:ok, _} -> Output.success("Tunnel deleted")
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown tunnel subcommand: #{inspect(sub)}")
  end
end
