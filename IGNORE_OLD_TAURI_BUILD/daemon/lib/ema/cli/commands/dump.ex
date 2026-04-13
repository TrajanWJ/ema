defmodule Ema.CLI.Commands.Dump do
  @moduledoc "Quick brain dump — fastest path to capture a thought."

  alias Ema.CLI.{Helpers, Output}

  def handle([], parsed, transport, opts) do
    thought = parsed.args.thought

    attrs =
      Helpers.compact_map([
        {:content, thought},
        {:source, "shortcut"},
        {:project_id, parsed.options[:project]},
        {:space_id, parsed.options[:space]},
        {:actor_id, parsed.options[:actor]},
        {:container_type, container_type(parsed.options)},
        {:container_id, container_id(parsed.options)}
      ])

    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.BrainDump, :create_item, [attrs]) do
          {:ok, item} ->
            Output.success("Captured: #{String.slice(thought, 0, 60)}")
            if opts[:json], do: Output.json(item)

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        body =
          attrs
          |> Enum.into(%{}, fn {k, v} -> {to_string(k), v} end)
          |> Map.put("source", "text")

        case transport.post("/brain-dump/items", body) do
          {:ok, _} -> Output.success("Captured: #{String.slice(thought, 0, 60)}")
          {:error, reason} -> Output.error(inspect(reason))
        end
    end
  end

  defp container_type(options) do
    cond do
      options[:task] -> "task"
      options[:project] -> "project"
      options[:space] -> "space"
      true -> nil
    end
  end

  defp container_id(options) do
    options[:task] || options[:project] || options[:space]
  end
end
