defmodule Ema.IntentionFarmer.ImportCatalog do
  @moduledoc "Catalogs staged import files, writes manifests, and seeds ingest jobs."

  alias Ema.Ingestor
  alias Ema.IntentionFarmer.{Parser, SourceRegistry}

  defp catalog_dir, do: Path.join(Ema.Config.data_dir(), "import-manifests")

  def sync do
    File.mkdir_p!(catalog_dir())

    imports =
      SourceRegistry.sources()
      |> Map.get(:import_sources, [])
      |> Enum.map(&build_entry/1)
      |> Enum.reject(&is_nil/1)

    Enum.each(imports, &write_manifest/1)
    ensure_ingest_jobs(imports)
    imports
  end

  def list do
    File.mkdir_p!(catalog_dir())

    Path.wildcard(Path.join(catalog_dir(), "*.json"))
    |> Enum.map(fn path ->
      path
      |> File.read!()
      |> Jason.decode!()
    end)
    |> Enum.sort_by(&Map.get(&1, "source_uri", ""), :asc)
  end

  defp build_entry(path) do
    stat = File.stat!(path)

    with {:ok, parsed} <- Parser.parse_external_import(path) do
      hash = file_sha256(path)

      %{
        "id" => hash,
        "source_uri" => path,
        "file_name" => Path.basename(path),
        "file_hash" => hash,
        "size_bytes" => stat.size,
        "mtime" => mtime_iso8601(stat),
        "source_type" => "external_import",
        "provider_guess" => parsed.metadata["provider_guess"],
        "dataset_guess" => parsed.metadata["dataset_guess"],
        "archive" => Map.get(parsed.metadata, "archive", false),
        "entry_count" => Map.get(parsed.metadata, "entry_count"),
        "sample_entries" => Map.get(parsed.metadata, "sample_entries", []),
        "preview" => parsed.metadata["preview"],
        "intent_type" =>
          parsed.intents
          |> List.first()
          |> then(fn
            nil -> nil
            intent -> intent.intent_type
          end)
      }
    else
      _ -> nil
    end
  rescue
    _ -> nil
  end

  defp ensure_ingest_jobs(imports) do
    Enum.each(imports, fn entry ->
      _ =
        Ingestor.ensure_job(%{
          source_type: Map.get(entry, "dataset_guess") || "external_import",
          source_uri: entry["source_uri"],
          extracted_title: entry["file_name"],
          extracted_summary: entry["preview"],
          extracted_tags:
            ["imported", "external", entry["provider_guess"], entry["dataset_guess"]]
            |> Enum.reject(&is_nil/1)
        })
    end)
  end

  defp write_manifest(entry) do
    path = Path.join(catalog_dir(), "#{entry["id"]}.json")
    File.write!(path, Jason.encode_to_iodata!(entry, pretty: true))
  end

  defp file_sha256(path) do
    path
    |> File.stream!([], 2048)
    |> Enum.reduce(:crypto.hash_init(:sha256), fn chunk, acc ->
      :crypto.hash_update(acc, chunk)
    end)
    |> :crypto.hash_final()
    |> Base.encode16(case: :lower)
  end

  defp mtime_iso8601(%File.Stat{mtime: mtime}) when is_integer(mtime) do
    mtime
    |> DateTime.from_unix!()
    |> DateTime.to_iso8601()
  end

  defp mtime_iso8601(_), do: nil
end
