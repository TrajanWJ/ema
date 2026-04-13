defmodule Ema.CLI.Commands.Babysitter do
  @moduledoc "CLI commands for babysitter system observability."

  alias Ema.CLI.{Helpers, Output}

  def handle([:state], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        events = apply(Ema.Babysitter.VisibilityHub, :all_events, [])
        config = apply(Ema.Babysitter.StreamTicker, :config, [])

        state = %{
          events: length(events),
          config: config,
          recent: Enum.take(events, 5)
        }

        if opts[:json], do: Output.json(state), else: print_state(state)

      Ema.CLI.Transport.Http ->
        case transport.get("/babysitter/state") do
          {:ok, body} ->
            state = Helpers.extract_record(body, "state")
            if opts[:json], do: Output.json(state), else: print_state(state)

          {:error, reason} ->
            Output.error(reason)
        end
    end
  rescue
    e -> Output.error(Exception.message(e))
  end

  def handle([:config], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        config = apply(Ema.Babysitter.StreamTicker, :config, [])
        if opts[:json], do: Output.json(config), else: Output.detail(config)

      Ema.CLI.Transport.Http ->
        case transport.get("/babysitter/state") do
          {:ok, body} ->
            config = body["config"] || body
            if opts[:json], do: Output.json(config), else: Output.detail(config)

          {:error, reason} ->
            Output.error(reason)
        end
    end
  rescue
    e -> Output.error(Exception.message(e))
  end

  def handle([:nudge], parsed, transport, _opts) do
    message = parsed.args.message

    case transport do
      Ema.CLI.Transport.Http ->
        case transport.post("/babysitter/nudge", %{"message" => message}) do
          {:ok, _} -> Output.success("Nudge sent")
          {:error, reason} -> Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Direct ->
        case Ema.CLI.Transport.Http.post("/babysitter/nudge", %{"message" => message}) do
          {:ok, _} -> Output.success("Nudge sent")
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle([:tick], _parsed, transport, _opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        apply(Ema.Babysitter.StreamTicker, :tick_now, [])
        Output.success("Tick triggered")

      Ema.CLI.Transport.Http ->
        case transport.post("/babysitter/tick") do
          {:ok, _} -> Output.success("Tick triggered")
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  rescue
    e -> Output.error(Exception.message(e))
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown babysitter subcommand: #{inspect(sub)}")
  end

  defp print_state(state) when is_map(state) do
    IO.puts("Babysitter State")
    IO.puts(String.duplicate("─", 40))

    Enum.each(state, fn {k, v} ->
      case v do
        list when is_list(list) ->
          IO.puts("  #{k}: #{length(list)} items")

        map when is_map(map) ->
          IO.puts("  #{k}:")
          Enum.each(map, fn {mk, mv} -> IO.puts("    #{mk}: #{inspect(mv)}") end)

        _ ->
          IO.puts("  #{k}: #{inspect(v)}")
      end
    end)
  end
end
