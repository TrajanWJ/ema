defmodule Ema.CLI.Commands.Config do
  @moduledoc "CLI commands for app settings and container config."

  alias Ema.CLI.{Helpers, Output}

  @columns [{"Container", :container_type}, {"ID", :container_id}, {"Key", :key}, {"Value", :value}]

  def handle([:view], _parsed, _transport, opts) do
    case Ema.CLI.Transport.Http.get("/settings") do
      {:ok, body} ->
        settings = Helpers.extract_record(body, "settings")
        if opts[:json], do: Output.json(settings), else: Output.detail(settings)

      {:error, reason} ->
        Output.error(inspect(reason))
    end
  end

  def handle([:list], parsed, transport, opts) do
    with {:ok, {container_type, container_id}} <- Helpers.parse_entity_ref(parsed.args.entity) do
      case transport do
        Ema.CLI.Transport.Direct ->
          case transport.call(Ema.ContainerConfig, :list_for, [container_type, container_id]) do
            {:ok, rows} -> Output.render(rows, @columns, json: opts[:json])
            {:error, reason} -> Output.error(inspect(reason))
          end

        Ema.CLI.Transport.Http ->
          params = Helpers.compact_keyword(container_type: container_type, container_id: container_id)

          case transport.get("/container-config", params: params) do
            {:ok, body} -> Output.render(Helpers.extract_list(body, "container_config"), @columns, json: opts[:json])
            {:error, reason} -> Output.error(inspect(reason))
          end
      end
    else
      {:error, reason} -> Output.error(reason)
    end
  end

  def handle([:get], parsed, transport, opts) do
    with {:ok, {container_type, container_id}} <- Helpers.parse_entity_ref(parsed.args.entity) do
      case transport do
        Ema.CLI.Transport.Direct ->
          case transport.call(Ema.ContainerConfig, :get, [container_type, container_id, parsed.args.key]) do
            {:ok, nil} -> Output.error("No config for #{parsed.args.entity} #{parsed.args.key}")
            {:ok, row} -> Output.detail(row, json: opts[:json])
            {:error, reason} -> Output.error(inspect(reason))
          end

        Ema.CLI.Transport.Http ->
          params = Helpers.compact_keyword(container_type: container_type, container_id: container_id)

          case transport.get("/container-config", params: params) do
            {:ok, body} ->
              row =
                body
                |> Helpers.extract_list("container_config")
                |> Enum.find(fn item -> Map.get(item, "key", item[:key]) == parsed.args.key end)

              if row, do: Output.detail(row, json: opts[:json]), else: Output.error("No config for #{parsed.args.entity} #{parsed.args.key}")

            {:error, reason} ->
              Output.error(inspect(reason))
          end
      end
    else
      {:error, reason} -> Output.error(reason)
    end
  end

  def handle([:set], parsed, transport, opts) do
    value = Helpers.parse_cli_value(parsed.args.value)

    with {:ok, {container_type, container_id}} <- Helpers.parse_entity_ref(parsed.args.entity) do
      case transport do
        Ema.CLI.Transport.Direct ->
          case transport.call(Ema.ContainerConfig, :set, [container_type, container_id, parsed.args.key, value]) do
            {:ok, row} ->
              Output.success("Set #{parsed.args.key} on #{parsed.args.entity}")
              if opts[:json], do: Output.json(row)

            {:error, reason} ->
              Output.error(inspect(reason))
          end

        Ema.CLI.Transport.Http ->
          body = %{
            "container_type" => container_type,
            "container_id" => container_id,
            "key" => parsed.args.key,
            "value" => Jason.encode!(value)
          }

          case transport.post("/container-config", body) do
            {:ok, body} ->
              Output.success("Set #{parsed.args.key} on #{parsed.args.entity}")
              if opts[:json], do: Output.json(Helpers.extract_record(body, "container_config"))

            {:error, reason} ->
              Output.error(inspect(reason))
          end
      end
    else
      {:error, reason} -> Output.error(reason)
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown config subcommand: #{inspect(sub)}")
  end
end
