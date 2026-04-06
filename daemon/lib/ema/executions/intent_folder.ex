defmodule Ema.Executions.IntentFolder do
  @moduledoc "Manages .superman/intents/<slug>/ lifecycle."

  def slugify(text) do
    text
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9\s-]/, "")
    |> String.replace(~r/\s+/, "-")
    |> String.replace(~r/-+/, "-")
    |> String.trim("-")
    |> String.slice(0, 60)
  end

  def create(project_path, slug, content) do
    dir = Path.join([project_path, ".superman", "intents", slug])

    with :ok <- File.mkdir_p(dir),
         :ok <- File.write(Path.join(dir, "intent.md"), "# Intent\n\n#{content}\n") do
      :ok
    end
  end

  def write_result(project_path, slug, result_summary) do
    ensure_dir(project_path, slug)
    path = intent_path(project_path, slug, "result.md")
    now = DateTime.utc_now() |> DateTime.to_iso8601()
    File.write(path, "# Result\n\n**Written:** #{now}\n\n#{result_summary}\n")
  end

  def append_log(project_path, slug, execution_id, mode, result_summary) do
    ensure_dir(project_path, slug)
    path = intent_path(project_path, slug, "execution-log.md")
    now = DateTime.utc_now() |> DateTime.to_iso8601()
    entry = "\n---\n\n## #{now} — #{execution_id}\n\n**Mode:** #{mode}\n\n#{result_summary}\n"
    File.write(path, entry, [:append])
  end

  def read_status(project_path, slug) do
    path = intent_path(project_path, slug, "status.json")

    case File.read(path) do
      {:ok, data} -> {:ok, Jason.decode!(data)}
      {:error, reason} -> {:error, reason}
    end
  end

  def exists?(project_path, slug) do
    File.dir?(Path.join([project_path, ".superman", "intents", slug]))
  end

  defp intent_path(project_path, slug, filename),
    do: Path.join([project_path, ".superman", "intents", slug, filename])

  defp ensure_dir(project_path, slug),
    do: File.mkdir_p(Path.join([project_path, ".superman", "intents", slug]))
end
