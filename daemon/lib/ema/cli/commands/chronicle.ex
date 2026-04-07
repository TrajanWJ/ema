defmodule Ema.CLI.Commands.Chronicle do
  @moduledoc "CLI commands for the chronicle undo/audit system."

  alias Ema.CLI.{Helpers, Output}

  @columns [
    {"ID", :id},
    {"Entity", :entity_type},
    {"Entity ID", :entity_id},
    {"Action", :action},
    {"Actor", :actor_id},
    {"When", :inserted_at}
  ]

  def handle([:list], parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        filter =
          Helpers.compact_keyword([
            {:entity_type, parsed.options[:type]},
            {:action, parsed.options[:action]},
            {:actor_id, parsed.options[:actor]},
            {:limit, parse_int(parsed.options[:limit]) || 30}
          ])

        case transport.call(Ema.Chronicle.EventLog, :recent, [filter]) do
          {:ok, events} -> Output.render(events, @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        params =
          Helpers.compact_keyword([
            {:entity_type, parsed.options[:type]},
            {:action, parsed.options[:action]},
            {:actor_id, parsed.options[:actor]},
            {:limit, parsed.options[:limit] || "30"}
          ])

        case transport.get("/chronicle", params: params) do
          {:ok, body} ->
            Output.render(Helpers.extract_list(body, "events"), @columns, json: opts[:json])

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle([:history], parsed, transport, opts) do
    entity_type = parsed.args.entity_type
    entity_id = parsed.args.entity_id

    case transport do
      Ema.CLI.Transport.Direct ->
        limit = parse_int(parsed.options[:limit]) || 20

        case transport.call(Ema.Chronicle.EventLog, :history, [
               entity_type,
               entity_id,
               [limit: limit]
             ]) do
          {:ok, events} -> Output.render(events, @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        params = Helpers.compact_keyword([{:limit, parsed.options[:limit] || "20"}])

        case transport.get("/chronicle/history/#{entity_type}/#{entity_id}", params: params) do
          {:ok, body} ->
            Output.render(Helpers.extract_list(body, "events"), @columns, json: opts[:json])

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle([:show], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Chronicle.EventLog, :get_event, [id]) do
          {:ok, nil} -> Output.error("Event #{id} not found")
          {:ok, event} -> Output.detail(event, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/chronicle/#{id}") do
          {:ok, body} ->
            Output.detail(Helpers.extract_record(body, "event"), json: opts[:json])

          {:error, :not_found} ->
            Output.error("Event #{id} not found")

          {:error, reason} ->
            Output.error(reason)
        end
    end
  end

  def handle([:undo], parsed, transport, _opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Chronicle.Reverter, :undo, [id]) do
          {:ok, _} -> Output.success("Undone event #{id}")
          {:error, reason} -> Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/chronicle/#{id}/undo", %{}) do
          {:ok, _} -> Output.success("Undone event #{id}")
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown chronicle subcommand: #{inspect(sub)}")
  end

  defp parse_int(nil), do: nil

  defp parse_int(val) when is_binary(val) do
    case Integer.parse(val) do
      {n, _} -> n
      :error -> nil
    end
  end

  defp parse_int(val) when is_integer(val), do: val
end
