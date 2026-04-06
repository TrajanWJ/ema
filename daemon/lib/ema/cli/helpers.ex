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
end
