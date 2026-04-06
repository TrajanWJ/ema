defmodule Ema.CLI.Commands.Space do
  @moduledoc "CLI commands for space management."

  alias Ema.CLI.Output

  @columns [
    {"ID", :id},
    {"Name", :name},
    {"Type", :space_type},
    {"Portable", :portable},
    {"Privacy", :ai_privacy},
    {"Updated", :updated_at}
  ]

  def handle([:list], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Spaces, :list_spaces, []) do
          {:ok, spaces} -> Output.render(spaces, @columns, json: opts[:json])
          {:error, reason} -> Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/spaces") do
          {:ok, body} -> Output.render(body["spaces"] || [], @columns, json: opts[:json])
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle([:show], parsed, transport, opts) do
    id = parsed.args.id

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Spaces, :get_space, [id]) do
          {:ok, nil} -> Output.error("Space #{id} not found")
          {:ok, space} -> Output.detail(space, json: opts[:json])
          {:error, reason} -> Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/spaces/#{id}") do
          {:ok, body} -> Output.detail(body["space"] || body, json: opts[:json])
          {:error, :not_found} -> Output.error("Space #{id} not found")
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  def handle([:create], parsed, transport, opts) do
    attrs = %{
      name: parsed.args.name,
      org_id: parsed.options[:org],
      space_type: parsed.options[:type],
      portable: parse_portable(parsed.options[:portable])
    }

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Spaces, :create_space, [attrs]) do
          {:ok, space} ->
            Output.success("Created space: #{space.name}")
            if opts[:json], do: Output.json(space)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        body = attrs |> Enum.reject(fn {_k, v} -> is_nil(v) end) |> Enum.into(%{}, fn {k, v} -> {to_string(k), v} end)

        case transport.post("/spaces", body) do
          {:ok, resp} ->
            space = resp["space"] || resp
            Output.success("Created space: #{space["name"]}")
            if opts[:json], do: Output.json(space)

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown space subcommand: #{inspect(sub)}")
  end

  defp parse_portable(nil), do: nil
  defp parse_portable(value) when value in [true, false], do: value

  defp parse_portable(value) when is_binary(value) do
    String.downcase(String.trim(value)) in ["1", "true", "yes", "y", "portable"]
  end
end
