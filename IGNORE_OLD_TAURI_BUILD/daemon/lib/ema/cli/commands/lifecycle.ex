defmodule Ema.CLI.Commands.Lifecycle do
  @moduledoc "CLI commands for data lifecycle management — stats, archive, compact."

  alias Ema.CLI.Output

  def handle([:stats], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        stats = gather_stats_direct(transport)

        if opts[:json] do
          Output.json(stats)
        else
          print_stats(stats)
        end

      Ema.CLI.Transport.Http ->
        case transport.get("/lifecycle/stats") do
          {:ok, body} ->
            if opts[:json] do
              Output.json(body)
            else
              print_stats(body)
            end

          {:error, reason} ->
            Output.error("Failed to get lifecycle stats: #{inspect(reason)}")
        end
    end
  end

  def handle([:archive], parsed, transport, opts) do
    dry_run = parsed.flags[:dry_run] || false

    case transport do
      Ema.CLI.Transport.Direct ->
        if dry_run do
          counts = transport.call(Ema.Lifecycle.Archiver, :dry_run, [])

          case counts do
            {:ok, result} ->
              if opts[:json] do
                Output.json(result)
              else
                print_dry_run(result)
              end

            {:error, reason} ->
              Output.error(inspect(reason))
          end
        else
          case transport.call(Ema.Lifecycle.Archiver, :run_now, []) do
            {:ok, {:ok, result}} ->
              if opts[:json] do
                Output.json(result)
              else
                print_archive_result(result)
              end

            {:error, reason} ->
              Output.error(inspect(reason))
          end
        end

      Ema.CLI.Transport.Http ->
        if dry_run do
          case transport.get("/lifecycle/archive/preview") do
            {:ok, body} ->
              if opts[:json], do: Output.json(body), else: print_dry_run(body)

            {:error, reason} ->
              Output.error(inspect(reason))
          end
        else
          case transport.post("/lifecycle/archive", %{}) do
            {:ok, body} ->
              if opts[:json], do: Output.json(body), else: print_archive_result(body)

            {:error, reason} ->
              Output.error(inspect(reason))
          end
        end
    end
  end

  def handle([:compact], _parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Lifecycle.Compactor, :compact_now, []) do
          {:ok, {:ok, report}} ->
            if opts[:json] do
              Output.json(report)
            else
              print_compact_report(report)
            end

          {:error, reason} ->
            Output.error(inspect(reason))
        end

      Ema.CLI.Transport.Http ->
        case transport.post("/lifecycle/compact", %{}) do
          {:ok, body} ->
            if opts[:json], do: Output.json(body), else: print_compact_report(body)

          {:error, reason} ->
            Output.error(inspect(reason))
        end
    end
  end

  def handle(sub, _parsed, _transport, _opts) do
    Output.error("Unknown lifecycle subcommand: #{inspect(sub)}")
  end

  # --- Display helpers ---

  defp gather_stats_direct(transport) do
    table_stats =
      case transport.call(Ema.Lifecycle.Compactor, :table_stats, []) do
        {:ok, {:ok, stats}} -> stats
        _ -> %{}
      end

    eligible =
      case transport.call(Ema.Lifecycle.RetentionPolicy, :eligible_counts, []) do
        {:ok, counts} -> counts
        _ -> %{}
      end

    archive_sizes = scan_archive_sizes()

    %{
      table_stats: table_stats,
      eligible_for_archive: eligible,
      archive_sizes: archive_sizes
    }
  end

  defp scan_archive_sizes do
    base = Path.expand("~/.local/share/ema/archive")

    if File.dir?(base) do
      base
      |> File.ls!()
      |> Enum.filter(&File.dir?(Path.join(base, &1)))
      |> Map.new(fn dir ->
        dir_path = Path.join(base, dir)

        size =
          dir_path
          |> File.ls!()
          |> Enum.map(fn f -> File.stat!(Path.join(dir_path, f)).size end)
          |> Enum.sum()

        {dir, size}
      end)
    else
      %{}
    end
  end

  defp print_stats(stats) do
    IO.puts("EMA Data Lifecycle")
    IO.puts(String.duplicate("=", 50))

    table_stats = get_nested(stats, "table_stats")
    eligible = get_nested(stats, "eligible_for_archive")
    archive_sizes = get_nested(stats, "archive_sizes")

    if map_size(table_stats) > 0 do
      IO.puts("\nTable Row Counts:")
      IO.puts(String.duplicate("-", 40))

      table_stats
      |> Enum.sort_by(fn {_k, v} -> -v end)
      |> Enum.each(fn {table, count} ->
        IO.puts("  #{String.pad_trailing(to_string(table), 25)} #{count}")
      end)
    end

    if map_size(eligible) > 0 do
      IO.puts("\nEligible for Archive:")
      IO.puts(String.duplicate("-", 40))

      Enum.each(eligible, fn {entity, count} ->
        marker = if count > 0, do: " *", else: ""
        IO.puts("  #{String.pad_trailing(to_string(entity), 25)} #{count}#{marker}")
      end)
    end

    if map_size(archive_sizes) > 0 do
      IO.puts("\nArchive Sizes:")
      IO.puts(String.duplicate("-", 40))

      Enum.each(archive_sizes, fn {dir, size} ->
        IO.puts("  #{String.pad_trailing(to_string(dir), 25)} #{format_bytes(size)}")
      end)
    end
  end

  defp print_dry_run(counts) do
    IO.puts("Archive Preview (dry run)")
    IO.puts(String.duplicate("-", 40))

    total =
      Enum.reduce(counts, 0, fn {entity, count}, acc ->
        IO.puts("  #{String.pad_trailing(to_string(entity), 25)} #{count} records")
        acc + count
      end)

    IO.puts(String.duplicate("-", 40))
    IO.puts("  Total: #{total} records would be archived")
  end

  defp print_archive_result(result) do
    IO.puts("Archive Complete")
    IO.puts(String.duplicate("-", 40))

    total =
      Enum.reduce(result, 0, fn {entity, count}, acc ->
        if count > 0 do
          IO.puts("  #{String.pad_trailing(to_string(entity), 25)} #{count} archived")
        end

        acc + count
      end)

    IO.puts(String.duplicate("-", 40))
    IO.puts("  Total: #{total} records archived")
  end

  defp print_compact_report(report) do
    IO.puts("Compaction Complete")
    IO.puts(String.duplicate("-", 40))

    wal = get_nested(report, "wal_checkpoint")
    IO.puts("  WAL checkpoint: #{get_nested(wal, "status") || "done"}")

    db_size = report["db_file_size"] || report[:db_file_size] || 0
    IO.puts("  DB file size:   #{format_bytes(db_size)}")

    table_stats = get_nested(report, "table_stats")

    if map_size(table_stats) > 0 do
      total = table_stats |> Map.values() |> Enum.sum()
      IO.puts("  Total rows:     #{total}")
    end
  end

  defp get_nested(map, key) when is_map(map) do
    Map.get(map, key) || Map.get(map, String.to_existing_atom(key), %{})
  rescue
    ArgumentError -> %{}
  end

  defp get_nested(_, _), do: %{}

  defp format_bytes(bytes) when is_number(bytes) and bytes >= 1_048_576 do
    "#{Float.round(bytes / 1_048_576, 1)} MB"
  end

  defp format_bytes(bytes) when is_number(bytes) and bytes >= 1_024 do
    "#{Float.round(bytes / 1_024, 1)} KB"
  end

  defp format_bytes(bytes) when is_number(bytes), do: "#{bytes} B"
  defp format_bytes(_), do: "0 B"
end
