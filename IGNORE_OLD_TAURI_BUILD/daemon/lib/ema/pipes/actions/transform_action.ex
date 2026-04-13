defmodule Ema.Pipes.Actions.TransformAction do
  @moduledoc """
  Pipes Action: Data Transformation.

  Pure data manipulation — no external calls. Applies a list of operations
  to the pipe payload.

  ## Operation Types

    - `set`      — set `field` to literal `value`
    - `copy`     — copy value from `source` field to `field`
    - `delete`   — remove `field` from payload
    - `template` — render `template` string with {{var}} interpolation and store at `field`
    - `rename`   — rename `source` field to `field` (copy + delete)

  ## Config Keys

    - `operations` — list of operation maps

  ## Example Pipe Config

      %{
        action_id: "transform",
        config: %{
          "operations" => [
            %{"type" => "copy",     "source" => "claude_output", "field" => "summary"},
            %{"type" => "set",      "field" => "status",         "value" => "processed"},
            %{"type" => "template", "field" => "title",          "template" => "Summary: {{project_name}}"},
            %{"type" => "delete",   "field" => "raw_input"}
          ]
        }
      }
  """

  require Logger

  @doc "Apply transformation operations to payload."
  def execute(payload, config) do
    operations = get_operations(config)

    result =
      Enum.reduce_while(operations, payload, fn op, acc ->
        case apply_operation(op, acc) do
          {:ok, updated} -> {:cont, updated}
          {:error, reason} -> {:halt, {:error, reason}}
        end
      end)

    case result do
      {:error, reason} -> {:error, reason}
      updated_payload -> {:ok, updated_payload}
    end
  end

  # ── Private ──────────────────────────────────────────────────────────────────

  defp get_operations(config) when is_map(config) do
    config["operations"] || config[:operations] || []
  end

  defp get_operations(_), do: []

  defp apply_operation(%{"type" => "set"} = op, payload) do
    field = op["field"] || op[:field]
    value = op["value"] || op[:value]

    if field do
      {:ok, Map.put(payload, field, value)}
    else
      {:error, {:invalid_operation, "set requires 'field'"}}
    end
  end

  defp apply_operation(%{"type" => "copy"} = op, payload) do
    field = op["field"] || op[:field]
    source = op["source"] || op[:source]

    if field && source do
      value = payload[source] || payload[String.to_atom(source)]
      {:ok, Map.put(payload, field, value)}
    else
      {:error, {:invalid_operation, "copy requires 'field' and 'source'"}}
    end
  end

  defp apply_operation(%{"type" => "delete"} = op, payload) do
    field = op["field"] || op[:field]

    if field do
      {:ok, Map.delete(payload, field)}
    else
      {:error, {:invalid_operation, "delete requires 'field'"}}
    end
  end

  defp apply_operation(%{"type" => "template"} = op, payload) do
    field = op["field"] || op[:field]
    template = op["template"] || op[:template] || ""

    if field do
      rendered =
        Regex.replace(~r/\{\{(\w+)\}\}/, template, fn _, key ->
          val = payload[key] || payload[String.to_atom(key)]
          to_string(val || "")
        end)

      {:ok, Map.put(payload, field, rendered)}
    else
      {:error, {:invalid_operation, "template requires 'field'"}}
    end
  rescue
    e -> {:error, {:template_render_failed, Exception.message(e)}}
  end

  defp apply_operation(%{"type" => "rename"} = op, payload) do
    field = op["field"] || op[:field]
    source = op["source"] || op[:source]

    if field && source do
      value = payload[source] || payload[String.to_atom(source)]
      updated = payload |> Map.put(field, value) |> Map.delete(source)
      {:ok, updated}
    else
      {:error, {:invalid_operation, "rename requires 'field' and 'source'"}}
    end
  end

  defp apply_operation(%{"type" => type}, _payload) do
    {:error, {:unknown_operation_type, type}}
  end

  defp apply_operation(op, _payload) do
    Logger.warning("[TransformAction] Invalid operation: #{inspect(op)}")
    {:error, {:invalid_operation, "missing 'type' key"}}
  end
end
