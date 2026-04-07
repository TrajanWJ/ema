defmodule Ema.CLI.Commands.Vm do
  @moduledoc "CLI commands for VM health, containers, and system checks."

  alias Ema.CLI.Output

  def handle([:health], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Vm, :health, []) do
          {:ok, data} -> Output.detail(data, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/vm/health") do
          {:ok, body} -> Output.detail(body, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:containers], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Vm, :containers, []) do
          {:ok, data} -> Output.detail(data, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/vm/containers") do
          {:ok, body} -> Output.detail(body, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:check], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Vm, :check, []) do
          {:ok, data} -> Output.detail(data, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/vm/check", %{}) do
          {:ok, body} -> Output.detail(body, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown vm subcommand: #{inspect(sub)}")
  end
end
