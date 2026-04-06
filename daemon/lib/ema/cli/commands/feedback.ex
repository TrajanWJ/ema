defmodule Ema.CLI.Commands.Feedback do
  @moduledoc "CLI commands for feedback stream."

  alias Ema.CLI.{Helpers, Output}

  @columns [{"ID", :id}, {"Type", :type}, {"Message", :message}, {"Time", :inserted_at}]

  def handle([:list], _parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.get("/feedback") do
      {:ok, body} -> Output.render(Helpers.extract_list(body, "feedback"), @columns, json: opts[:json])
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle([:status], _parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.get("/feedback/status") do
      {:ok, body} -> if opts[:json], do: Output.json(body), else: Output.detail(body)
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle([:emit], parsed, _transport, _opts) do
    body = Helpers.compact_map([
      {"message", parsed.args.message},
      {"type", parsed.options[:type] || "info"}
    ])

    case Ema.CLI.Transport.Http.post("/feedback/emit", body) do
      {:ok, _} -> Output.success("Feedback emitted")
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown feedback subcommand: #{inspect(sub)}")
  end
end
