defmodule Ema.CLI.Commands.Quality do
  @moduledoc "CLI commands for quality monitoring."

  alias Ema.CLI.Output

  def handle([:report], _parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.get("/quality/report") do
      {:ok, body} -> if opts[:json], do: Output.json(body), else: Output.detail(body)
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle([:friction], _parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.get("/quality/friction") do
      {:ok, body} -> if opts[:json], do: Output.json(body), else: Output.detail(body)
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle([:gradient], _parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.get("/quality/gradient") do
      {:ok, body} -> if opts[:json], do: Output.json(body), else: Output.detail(body)
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle([:budget], _parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.get("/quality/budget") do
      {:ok, body} -> if opts[:json], do: Output.json(body), else: Output.detail(body)
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle([:threats], _parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.get("/quality/threats") do
      {:ok, body} -> if opts[:json], do: Output.json(body), else: Output.detail(body)
      {:error, reason} -> Output.error(inspect(reason))
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown quality subcommand: #{inspect(sub)}")
  end
end
