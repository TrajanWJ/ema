defmodule Ema.CLI.Commands.Onboarding do
  @moduledoc "CLI commands for onboarding status, readiness, and setup."

  alias Ema.CLI.Output

  def handle([:status], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Onboarding, :status, []) do
          {:ok, data} -> Output.detail(data, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/onboarding/status") do
          {:ok, body} -> Output.detail(body, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:readiness], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Onboarding, :readiness, []) do
          {:ok, data} -> Output.detail(data, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/onboarding/readiness") do
          {:ok, body} -> Output.detail(body, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:run], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Onboarding, :run, []) do
          {:ok, data} -> Output.detail(data, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/onboarding/run", %{}) do
          {:ok, body} -> Output.detail(body, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown onboarding subcommand: #{inspect(sub)}")
  end
end
