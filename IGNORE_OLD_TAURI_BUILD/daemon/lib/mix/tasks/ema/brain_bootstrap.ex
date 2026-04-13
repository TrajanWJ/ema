defmodule Mix.Tasks.Ema.BrainBootstrap do
  use Mix.Task

  @shortdoc "Bootstrap Second Brain from EMA docs and vault"
  @moduledoc """
  Bootstrap the EMA Second Brain by ingesting all markdown files from:
    - ~/Projects/ema/docs/
    - The configured EMA vault path

  ## Usage

      mix ema.brain_bootstrap
      mix ema.brain_bootstrap --dry-run
      mix ema.brain_bootstrap --path /path/to/extra/docs

  ## Options

    - `--dry-run` — count files without inserting
    - `--path` — additional path to ingest (can be repeated)
    - `--reindex` — rebuild the FTS index after ingestion
  """

  def run(args) do
    {opts, _rest, _invalid} =
      OptionParser.parse(args,
        switches: [dry_run: :boolean, path: :keep, reindex: :boolean],
        aliases: [d: :dry_run, p: :path, r: :reindex]
      )

    dry_run = Keyword.get(opts, :dry_run, false)
    extra_paths = Keyword.get_values(opts, :path)
    reindex = Keyword.get(opts, :reindex, false)

    Mix.Task.run("app.start")

    if dry_run do
      Mix.shell().info("DRY RUN — no records will be created")
    end

    # Set extra paths in app env so Ingester.ingest_vault/0 picks them up
    if extra_paths != [] do
      Application.put_env(:ema, :brain_ingest_paths, extra_paths)
    end

    Mix.shell().info("Starting Second Brain bootstrap...")

    {:ok, stats} = Ema.SecondBrain.Ingester.ingest_vault()

    Mix.shell().info("""
    Bootstrap complete:
      Ingested : #{stats.ingested}
      Skipped  : #{stats.skipped}
      Errors   : #{length(stats.errors)}
    """)

    if stats.errors != [] do
      Mix.shell().info("Errors:")

      Enum.each(stats.errors, fn err ->
        Mix.shell().info("  #{inspect(err)}")
      end)
    end

    if reindex and not dry_run do
      Mix.shell().info("Rebuilding FTS index...")
      {:ok, indexed} = Ema.SecondBrain.Indexer.reindex_all()
      Mix.shell().info("FTS reindex complete: #{indexed} notes indexed")
    end
  end
end
