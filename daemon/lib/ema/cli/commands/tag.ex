defmodule Ema.CLI.Commands.Tag do
  @moduledoc "CLI commands for universal entity tagging."

  alias Ema.CLI.{Helpers, Output}

  @columns [
    {"Entity", :entity_type},
    {"ID", :entity_id},
    {"Tag", :tag},
    {"Actor", :actor_id},
    {"Namespace", :namespace}
  ]

  def handle([:list], parsed, transport, opts) do
    with {:ok, {entity_type, entity_id}} <- Helpers.parse_entity_ref(parsed.args.entity) do
      case transport do
        Ema.CLI.Transport.Direct ->
          case transport.call(Ema.Tags, :list_for, [entity_type, entity_id]) do
            {:ok, tags} -> Output.render(tags, @columns, json: opts[:json])
            {:error, reason} -> Output.error(inspect(reason))
          end

        Ema.CLI.Transport.Http ->
          params = Helpers.compact_keyword(entity_type: entity_type, entity_id: entity_id)

          case transport.get("/tags", params: params) do
            {:ok, body} ->
              Output.render(Helpers.extract_list(body, "tags"), @columns, json: opts[:json])

            {:error, reason} ->
              Output.error(inspect(reason))
          end
      end
    else
      {:error, reason} -> Output.error(reason)
    end
  end

  def handle([:add], parsed, transport, opts) do
    actor_id = parsed.options[:actor] || "human"
    namespace = parsed.options[:namespace] || "default"

    with {:ok, {entity_type, entity_id}} <- Helpers.parse_entity_ref(parsed.args.entity) do
      case transport do
        Ema.CLI.Transport.Direct ->
          case transport.call(Ema.Tags, :tag, [
                 entity_type,
                 entity_id,
                 parsed.args.tag,
                 actor_id,
                 namespace
               ]) do
            {:ok, tag} ->
              Output.success("Tagged #{entity_type}:#{entity_id} with #{parsed.args.tag}")
              if opts[:json], do: Output.json(tag)

            {:error, reason} ->
              Output.error(inspect(reason))
          end

        Ema.CLI.Transport.Http ->
          body = %{
            "entity_type" => entity_type,
            "entity_id" => entity_id,
            "tag" => parsed.args.tag,
            "actor_id" => actor_id,
            "namespace" => namespace
          }

          case transport.post("/tags", body) do
            {:ok, body} ->
              Output.success("Tagged #{entity_type}:#{entity_id} with #{parsed.args.tag}")
              if opts[:json], do: Output.json(Helpers.extract_record(body, "tag"))

            {:error, reason} ->
              Output.error(inspect(reason))
          end
      end
    else
      {:error, reason} -> Output.error(reason)
    end
  end

  def handle([:remove], parsed, transport, opts) do
    actor_id = parsed.options[:actor] || "human"

    with {:ok, {entity_type, entity_id}} <- Helpers.parse_entity_ref(parsed.args.entity) do
      case transport do
        Ema.CLI.Transport.Direct ->
          case transport.call(Ema.Tags, :untag, [
                 entity_type,
                 entity_id,
                 parsed.args.tag,
                 actor_id
               ]) do
            {:ok, result} ->
              Output.success("Removed tag #{parsed.args.tag} from #{entity_type}:#{entity_id}")
              if opts[:json], do: Output.json(result)

            {:error, reason} ->
              Output.error(inspect(reason))
          end

        Ema.CLI.Transport.Http ->
          params =
            Helpers.compact_keyword(
              entity_type: entity_type,
              entity_id: entity_id,
              tag: parsed.args.tag,
              actor_id: actor_id
            )

          case transport.delete("/tags", params: params) do
            {:ok, body} ->
              Output.success("Removed tag #{parsed.args.tag} from #{entity_type}:#{entity_id}")
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
    Output.error("Unknown tag subcommand: #{inspect(sub)}")
  end
end
