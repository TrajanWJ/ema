defmodule Ema.CLI.Commands.Temporal do
  @moduledoc "CLI commands for temporal intelligence — rhythm, timing, history."

  alias Ema.CLI.{Helpers, Output}

  def handle([:rhythm], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Temporal, :rhythm, []) do
          {:ok, data} -> Output.detail(data, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/temporal/rhythm") do
          {:ok, body} -> Output.detail(body, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:now], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Temporal, :now, []) do
          {:ok, data} -> Output.detail(data, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/temporal/now") do
          {:ok, body} -> Output.detail(body, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:"best-time"], parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        args = if parsed.options[:activity], do: [parsed.options[:activity]], else: []

        case transport.call(Ema.Temporal, :best_time, args) do
          {:ok, data} -> Output.detail(data, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        params = Helpers.compact_keyword([{:activity, parsed.options[:activity]}])

        case transport.get("/temporal/best-time", params: params) do
          {:ok, body} -> Output.detail(body, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:log], parsed, transport, _opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        attrs =
          Helpers.compact_map([
            {:activity, parsed.args.activity},
            {:energy, parsed.options[:energy]},
            {:mood, parsed.options[:mood]},
            {:notes, parsed.options[:notes]}
          ])

        case transport.call(Ema.Temporal, :log, [attrs]) do
          {:ok, _} -> Output.success("Temporal log recorded")
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        body =
          Helpers.compact_map([
            {"activity", parsed.args.activity},
            {"energy", parsed.options[:energy]},
            {"mood", parsed.options[:mood]},
            {"notes", parsed.options[:notes]}
          ])

        case transport.post("/temporal/log", body) do
          {:ok, _} -> Output.success("Temporal log recorded")
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:history], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Temporal, :history, []) do
          {:ok, data} -> Output.detail(data, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/temporal/history") do
          {:ok, body} -> Output.detail(body, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown temporal subcommand: #{inspect(sub)}")
  end
end
