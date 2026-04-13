defmodule EmaWeb.LifecycleController do
  @moduledoc "REST endpoints for data lifecycle management."

  use EmaWeb, :controller

  alias Ema.Lifecycle.{Archiver, Compactor, RetentionPolicy}

  def stats(conn, _params) do
    {:ok, table_stats} = Compactor.table_stats()
    eligible = RetentionPolicy.eligible_counts()
    archive_sizes = scan_archive_sizes()

    json(conn, %{
      table_stats: table_stats,
      eligible_for_archive: eligible,
      archive_sizes: archive_sizes
    })
  end

  def archive_preview(conn, _params) do
    counts = Archiver.dry_run()
    json(conn, counts)
  end

  def archive(conn, _params) do
    {:ok, result} = Archiver.run_now()
    json(conn, result)
  end

  def compact(conn, _params) do
    {:ok, report} = Compactor.compact_now()
    json(conn, report)
  end

  defp scan_archive_sizes do
    base = Archiver.archive_dir()

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
end
