defmodule Ema.CLI.Commands.Reflexion do
  @moduledoc "CLI commands for reflexion memory."

  alias Ema.CLI.{Helpers, Output}

  @columns [{"ID", :id}, {"Type", :type}, {"Content", :content}, {"Created", :inserted_at}]

  def handle([:list], _parsed, transport, opts) do
    case transport.get("/reflexion/entries") do
      {:ok, body} -> Output.render(Helpers.extract_list(body, "entries"), @columns, json: opts[:json])
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle([:create], parsed, transport, opts) do
    body = Helpers.compact_map([
      {"content", parsed.args.content},
      {"type", parsed.options[:type] || "observation"}
    ])

    case transport.post("/reflexion/entries", body) do
      {:ok, resp} ->
        Output.success("Reflexion entry created")
        if opts[:json], do: Output.json(resp)

      {:error, reason} ->
        Output.error(inspect(reason))
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown reflexion subcommand: #{inspect(sub)}")
  end
end
