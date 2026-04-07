defmodule Ema.CLI.Output do
  @moduledoc "Output formatting for CLI — Owl tables for humans, Jason for machines."

  @type format :: :table | :json | :detail

  @doc "Render data based on global flags"
  def render(data, columns, opts \\ []) do
    if opts[:json] do
      json(data)
    else
      table(data, columns, opts)
    end
  end

  @doc "Print data as JSON"
  def json(data) do
    data
    |> normalize_for_json()
    |> Jason.encode!(pretty: true)
    |> IO.puts()
  end

  @doc "Print data as an Owl table"
  def table([], _columns, _opts) do
    IO.puts("(no results)")
  end

  def table(rows, columns, _opts) when is_list(rows) do
    table_rows =
      Enum.map(rows, fn row ->
        Map.new(columns, fn {label, key} ->
          {label, row |> get_field(key) |> format_value()}
        end)
      end)

    Owl.IO.puts(
      Owl.Table.new(table_rows,
        padding_x: 1,
        sort_columns: :asc,
        border_style: :solid_rounded,
        truncate_lines: true,
        max_column_widths: fn _col -> 40 end
      )
    )
  end

  def table(data, _columns, _opts), do: detail(data)

  @doc "Print a single record as key-value pairs"
  def detail(record, opts \\ []) do
    if opts[:json] do
      json(record)
    else
      record
      |> normalize_record()
      |> Enum.each(fn {key, value} ->
        label = key |> to_string() |> String.pad_trailing(16)
        IO.puts("  #{label} #{format_value(value)}")
      end)
    end
  end

  @doc "Print success message"
  def success(msg) do
    Owl.IO.puts(Owl.Data.tag(msg, :green))
  end

  @doc "Print error message to stderr"
  def error(msg) do
    IO.puts(:stderr, IO.ANSI.red() <> "Error: #{msg}" <> IO.ANSI.reset())
  end

  @doc "Print warning"
  def warn(msg) do
    Owl.IO.puts(Owl.Data.tag(msg, :yellow))
  end

  @doc "Print info"
  def info(msg) do
    IO.puts(msg)
  end

  # -- Private --

  defp get_field(row, key) when is_map(row) do
    Map.get(row, key) || Map.get(row, to_string(key))
  end

  defp get_field(row, key) when is_struct(row) do
    case Map.fetch(row, key) do
      {:ok, val} -> val
      :error -> nil
    end
  end

  defp format_value(nil), do: "-"
  defp format_value(true), do: "yes"
  defp format_value(false), do: "no"
  defp format_value(%DateTime{} = dt), do: format_relative(dt)

  defp format_value(%NaiveDateTime{} = dt),
    do: format_relative(DateTime.from_naive!(dt, "Etc/UTC"))

  defp format_value(val) when is_binary(val), do: String.slice(val, 0, 80)
  defp format_value(val) when is_list(val), do: Enum.join(val, ", ")
  defp format_value(val) when is_map(val), do: Jason.encode!(val)
  defp format_value(val), do: to_string(val)

  defp format_relative(%DateTime{} = dt) do
    diff = DateTime.diff(DateTime.utc_now(), dt, :second)

    cond do
      diff < 60 -> "#{diff}s ago"
      diff < 3600 -> "#{div(diff, 60)}m ago"
      diff < 86400 -> "#{div(diff, 3600)}h ago"
      true -> "#{div(diff, 86400)}d ago"
    end
  end

  defp normalize_record(record) when is_struct(record) do
    record
    |> Map.from_struct()
    |> Map.delete(:__meta__)
    |> Enum.sort_by(fn {k, _} -> to_string(k) end)
  end

  defp normalize_record(record) when is_map(record) do
    Enum.sort_by(record, fn {k, _} -> to_string(k) end)
  end

  defp normalize_for_json(data) when is_list(data) do
    Enum.map(data, &normalize_for_json/1)
  end

  defp normalize_for_json(%Ecto.Association.NotLoaded{}), do: nil

  defp normalize_for_json(%{__struct__: _} = struct) do
    struct
    |> Map.from_struct()
    |> Map.delete(:__meta__)
    |> normalize_for_json()
  end

  defp normalize_for_json(map) when is_map(map) do
    Map.new(map, fn {k, v} -> {k, normalize_for_json(v)} end)
  end

  defp normalize_for_json(tuple) when is_tuple(tuple) do
    tuple
    |> Tuple.to_list()
    |> Enum.map(&normalize_for_json/1)
  end

  defp normalize_for_json(other), do: other
end
