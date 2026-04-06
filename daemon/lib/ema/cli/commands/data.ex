defmodule Ema.CLI.Commands.Data do
  @moduledoc "CLI commands for per-actor entity data."

  alias Ema.CLI.{Helpers, Output}

  @columns [
    {"Entity", :entity_type},
    {"ID", :entity_id},
    {"Actor", :actor_id},
    {"Key", :key},
    {"Value", :value}
  ]

  def handle([:get], parsed, transport, opts) do
    actor_id = parsed.options[:actor] || "human"

    with {:ok, {entity_type, entity_id}} <- Helpers.parse_entity_ref(parsed.args.entity) do
      case transport do
        Ema.CLI.Transport.Direct ->
          case transport.call(Ema.EntityData, :get, [entity_type, entity_id, actor_id, parsed.args.key]) do
            {:ok, nil} -> Output.error("No data for #{entity_type}:#{entity_id} #{parsed.args.key}")
            {:ok, row} -> Output.detail(row, json: opts[:json])
            {:error, reason} -> Output.error(inspect(reason))
          end

        Ema.CLI.Transport.Http ->
          params =
            Helpers.compact_keyword(
              entity_type: entity_type,
              entity_id: entity_id,
              actor_id: actor_id
            )

          case transport.get("/entity-data", params: params) do
            {:ok, body} ->
              rows = Helpers.extract_list(body, "entity_data")
              row = Enum.find(rows, fn item -> Map.get(item, "key", item[:key]) == parsed.args.key end)

              if row, do: Output.detail(row, json: opts[:json]), else: Output.error("No data for #{entity_type}:#{entity_id} #{parsed.args.key}")

            {:error, reason} ->
              Output.error(inspect(reason))
          end
      end
    else
      {:error, reason} -> Output.error(reason)
    end
  end

  def handle([:list], parsed, transport, opts) do
    actor_id = parsed.options[:actor] || "human"

    with {:ok, {entity_type, entity_id}} <- Helpers.parse_entity_ref(parsed.args.entity) do
      case transport do
        Ema.CLI.Transport.Direct ->
          case transport.call(Ema.EntityData, :list_for, [entity_type, entity_id, actor_id]) do
            {:ok, rows} -> Output.render(rows, @columns, json: opts[:json])
            {:error, reason} -> Output.error(inspect(reason))
          end

        Ema.CLI.Transport.Http ->
          params =
            Helpers.compact_keyword(
              entity_type: entity_type,
              entity_id: entity_id,
              actor_id: actor_id
            )

          case transport.get("/entity-data", params: params) do
            {:ok, body} -> Output.render(Helpers.extract_list(body, "entity_data"), @columns, json: opts[:json])
            {:error, reason} -> Output.error(inspect(reason))
          end
      end
    else
      {:error, reason} -> Output.error(reason)
    end
  end

  def handle([:set], parsed, transport, opts) do
    actor_id = parsed.options[:actor] || "human"
    value = Helpers.parse_cli_value(parsed.args.value)

    with {:ok, {entity_type, entity_id}} <- Helpers.parse_entity_ref(parsed.args.entity) do
      case transport do
        Ema.CLI.Transport.Direct ->
          case transport.call(Ema.EntityData, :set, [entity_type, entity_id, actor_id, parsed.args.key, value]) do
            {:ok, row} ->
              Output.success("Set #{parsed.args.key} on #{entity_type}:#{entity_id}")
              if opts[:json], do: Output.json(row)

            {:error, reason} ->
              Output.error(inspect(reason))
          end

        Ema.CLI.Transport.Http ->
          body = %{
            "entity_type" => entity_type,
            "entity_id" => entity_id,
            "actor_id" => actor_id,
            "key" => parsed.args.key,
            "value" => Jason.encode!(value)
          }

          case transport.post("/entity-data", body) do
            {:ok, body} ->
              Output.success("Set #{parsed.args.key} on #{entity_type}:#{entity_id}")
              if opts[:json], do: Output.json(Helpers.extract_record(body, "entity_data"))

            {:error, reason} ->
              Output.error(inspect(reason))
          end
      end
    else
      {:error, reason} -> Output.error(reason)
    end
  end

  def handle([:delete], parsed, transport, opts) do
    actor_id = parsed.options[:actor] || "human"

    with {:ok, {entity_type, entity_id}} <- Helpers.parse_entity_ref(parsed.args.entity) do
      case transport do
        Ema.CLI.Transport.Direct ->
          case transport.call(Ema.EntityData, :delete, [entity_type, entity_id, actor_id, parsed.args.key]) do
            {:ok, result} ->
              Output.success("Deleted #{parsed.args.key} from #{entity_type}:#{entity_id}")
              if opts[:json], do: Output.json(result)

            {:error, reason} ->
              Output.error(inspect(reason))
          end

        Ema.CLI.Transport.Http ->
          params =
            Helpers.compact_keyword(
              entity_type: entity_type,
              entity_id: entity_id,
              actor_id: actor_id,
              key: parsed.args.key
            )

          case transport.delete("/entity-data", params: params) do
            {:ok, body} ->
              Output.success("Deleted #{parsed.args.key} from #{entity_type}:#{entity_id}")
              if opts[:json], do: Output.json(body)

            {:error, reason} ->
              Output.error(inspect(reason))
          end
      end
    else
      {:error, reason} -> Output.error(reason)
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown data subcommand: #{inspect(sub)}")
  end
end
