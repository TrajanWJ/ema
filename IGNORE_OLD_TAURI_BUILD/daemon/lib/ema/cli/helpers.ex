defmodule Ema.CLI.Helpers do
  @moduledoc "Shared helpers for CLI command modules."

  @doc "Extract a list from an API response envelope."
  def extract_list(body, key) when is_map(body) do
    Map.get(body, key) || Map.get(body, "data") || [body]
  end

  def extract_list(body, _key) when is_list(body), do: body

  @doc "Extract a single record from an API response envelope."
  def extract_record(body, key) when is_map(body) do
    Map.get(body, key) || Map.get(body, "data") || body
  end

  @doc "Build a map, skipping nil values."
  def compact_map(pairs) do
    pairs
    |> Enum.reject(fn {_k, v} -> is_nil(v) end)
    |> Map.new()
  end

  @doc "Build a keyword list, skipping nil values."
  def compact_keyword(pairs) do
    Enum.reject(pairs, fn {_k, v} -> is_nil(v) end)
  end

  @doc "Parse an entity reference like task:123 or project:ema."
  def parse_entity_ref(ref) when is_binary(ref) do
    case String.split(ref, ":", parts: 2) do
      [entity_type, entity_id] when entity_type != "" and entity_id != "" ->
        {:ok, {entity_type, entity_id}}

      _ ->
        {:error, "Expected entity ref like task:123"}
    end
  end

  @doc "Parse a JSON-ish CLI value. Falls back to the raw string."
  def parse_cli_value(value) when is_binary(value) do
    trimmed = String.trim(value)

    case Jason.decode(trimmed) do
      {:ok, decoded} -> decoded
      {:error, _} -> value
    end
  end
end
