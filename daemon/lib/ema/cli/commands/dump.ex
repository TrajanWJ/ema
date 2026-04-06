defmodule Ema.CLI.Commands.Dump do
  @moduledoc "Quick brain dump — fastest path to capture a thought."

  alias Ema.CLI.Output

  def handle([], parsed, transport, opts) do
    thought = parsed.args.thought

    case transport do
      Ema.CLI.Transport.Direct ->
        attrs = %{content: thought, source: "cli"}

        case transport.call(Ema.BrainDump, :create_item, [attrs]) do
          {:ok, item} ->
            Output.success("Captured: #{String.slice(thought, 0, 60)}")
            if opts[:json], do: Output.json(item)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        body = %{"content" => thought, "source" => "text"}

        case transport.post("/brain-dump/items", body) do
          {:ok, _} -> Output.success("Captured: #{String.slice(thought, 0, 60)}")
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end
end
