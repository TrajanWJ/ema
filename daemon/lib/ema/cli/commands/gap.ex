defmodule Ema.CLI.Commands.Gap do
  @moduledoc "CLI commands for gap/friction tracking."

  alias Ema.CLI.Output

  @columns [
    {"ID", :id},
    {"Title", :title},
    {"Source", :source},
    {"Severity", :severity},
    {"Status", :status}
  ]

  def handle([:list], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Intelligence.GapScanner, :list_gaps, []) do
          {:ok, gaps} -> Output.render(gaps, @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/gaps") do
          {:ok, body} -> Output.render(body["gaps"] || [], @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end

  def handle([:resolve], parsed, transport, _opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Http ->
        case transport.post("/gaps/#{id}/resolve", %{}) do
          {:ok, _} -> Output.success("Resolved gap #{id}")
          {:error, reason} -> Output.error(inspect(reason))
        end

      _ ->
        Output.error("Gap resolve only supported via HTTP")
    end
  end

  def handle([:"create-task"], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Http ->
        case transport.post("/gaps/#{id}/create_task", %{}) do
          {:ok, resp} ->
            task = resp["task"] || resp
            Output.success("Created task from gap #{id}")
            if opts[:json], do: Output.json(task)
          {:error, reason} -> Output.error(inspect(reason))
        end

      _ ->
        Output.error("Gap create-task only supported via HTTP")
    end
  end

  def handle([:scan], _parsed, transport, _opts) do
    case transport do
      Ema.CLI.Transport.Http ->
        case transport.post("/gaps/scan", %{}) do
          {:ok, body} -> Output.success("Scan complete: #{body["count"] || "done"}")
          {:error, reason} -> Output.error(inspect(reason))
        end

      _ ->
        Output.error("Gap scan only supported via HTTP")
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown gap subcommand: #{inspect(sub)}")
  end
end
