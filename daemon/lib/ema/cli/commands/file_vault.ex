defmodule Ema.CLI.Commands.FileVault do
  @moduledoc "CLI commands for file vault."

  alias Ema.CLI.{Helpers, Output}

  @columns [{"ID", :id}, {"Name", :name}, {"Size", :size}, {"Created", :inserted_at}]

  def handle([:list], _parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.get("/file-vault") do
      {:ok, body} -> Output.render(Helpers.extract_list(body, "files"), @columns, json: opts[:json])
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle([:show], parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.get("/file-vault/#{parsed.args.id}") do
      {:ok, body} -> Output.detail(Helpers.extract_record(body, "file"), json: opts[:json])
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle([:delete], parsed, _transport, _opts) do
    case Ema.CLI.Transport.Http.delete("/file-vault/#{parsed.args.id}") do
      {:ok, _} -> Output.success("File deleted")
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown file-vault subcommand: #{inspect(sub)}")
  end
end
