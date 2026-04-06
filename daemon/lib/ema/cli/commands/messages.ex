defmodule Ema.CLI.Commands.Messages do
  @moduledoc "CLI commands for message hub."

  alias Ema.CLI.{Helpers, Output}

  @columns [{"ID", :id}, {"From", :sender}, {"Content", :content}, {"Time", :inserted_at}]

  def handle([:list], _parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.get("/messages") do
      {:ok, body} -> Output.render(Helpers.extract_list(body, "messages"), @columns, json: opts[:json])
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle([:conversations], _parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.get("/messages/conversations") do
      {:ok, body} -> if opts[:json], do: Output.json(body), else: Output.detail(body)
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle([:send], parsed, _transport, _opts) do
    body = %{"content" => parsed.args.content, "recipient" => parsed.options[:to]}

    case Ema.CLI.Transport.Http.post("/messages/send", body) do
      {:ok, _} -> Output.success("Message sent")
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown messages subcommand: #{inspect(sub)}")
  end
end
