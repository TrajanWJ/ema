defmodule Ema.Harvesters.VaultHarvester do
  @moduledoc """
  VaultHarvester — scans the local vault for recently modified markdown notes,
  extracts actionable items (TODOs, questions, decisions, ideas), and seeds proposals.
  """

  use Ema.Harvesters.Base, name: "vault", interval: :timer.hours(4)

  require Logger

  alias Ema.Proposals

  @lookback_hours 24
  @max_notes_per_run 50
  @actionable_patterns [
    {~r/^[-*]\s*\[\s*\]\s*(.+)/m, "unchecked_task"},
    {~r/\bTODO[:\s]+(.+)/i, "todo"},
    {~r/\bDECISION[:\s]+(.+)/i, "decision"},
    {~r/\bIDEA[:\s]+(.+)/i, "idea"},
    {~r/\bQUESTION[:\s]+(.+)/i, "question"}
  ]

  @impl Ema.Harvesters.Base
  def harvester_name, do: "vault"

  @impl Ema.Harvesters.Base
  def default_interval, do: :timer.hours(4)

  @impl Ema.Harvesters.Base
  def harvest(_context) do
    vault_path = System.get_env("EMA_VAULT_PATH", Path.expand("~/vault"))

    case File.stat(vault_path) do
      {:error, reason} ->
        Logger.warning("[VaultHarvester] Vault not accessible at #{vault_path}: #{inspect(reason)}")
        {:ok, %{items_found: 0, seeds_created: 0, metadata: %{error: inspect(reason)}}}

      {:ok, _} ->
        cutoff = DateTime.add(DateTime.utc_now(), -@lookback_hours * 3600, :second)
        recent_notes = find_recent_notes(vault_path, cutoff)

        {items, seeds} =
          recent_notes
          |> Enum.take(@max_notes_per_run)
          |> Enum.reduce({0, 0}, fn note_path, {item_acc, seed_acc} ->
            {items_found, seeds_created} = process_note(note_path, vault_path)
            {item_acc + items_found, seed_acc + seeds_created}
          end)

        Logger.info("[VaultHarvester] Scanned #{length(recent_notes)} notes — #{items} items, #{seeds} seeds")
        {:ok, %{items_found: items, seeds_created: seeds,
                metadata: %{notes_scanned: length(recent_notes), vault_path: vault_path}}}
    end
  rescue
    e ->
      Logger.error("[VaultHarvester] Unexpected error: #{inspect(e)}")
      {:error, inspect(e)}
  end

  # ---------------------------------------------------------------------------
  # Private
  # ---------------------------------------------------------------------------

  defp find_recent_notes(vault_path, cutoff) do
    vault_path
    |> Path.join("**/*.md")
    |> Path.wildcard()
    |> Enum.filter(fn path ->
      case File.stat(path, time: :posix) do
        {:ok, %{mtime: mtime}} ->
          modified_at = DateTime.from_unix!(mtime)
          DateTime.compare(modified_at, cutoff) == :gt
        _ -> false
      end
    end)
  rescue
    _ -> []
  end

  defp process_note(note_path, vault_path) do
    with {:ok, content} <- File.read(note_path) do
      rel_path = Path.relative_to(note_path, vault_path)
      note_title = Path.basename(note_path, ".md")

      items =
        @actionable_patterns
        |> Enum.flat_map(fn {pattern, type} ->
          Regex.scan(pattern, content)
          |> Enum.map(fn [_, match] -> {type, String.trim(match)} end)
        end)
        |> Enum.uniq_by(fn {_type, text} -> text end)

      seeds_created =
        items
        |> Enum.take(3)  # max 3 proposals per note per run
        |> Enum.count(fn {type, text} ->
          create_seed(note_title, rel_path, type, text) == :ok
        end)

      {length(items), seeds_created}
    else
      _ -> {0, 0}
    end
  end

  defp create_seed(note_title, rel_path, type, text) do
    title = "#{label_for(type)}: #{String.slice(text, 0, 80)}"
    body = "From vault note: **#{note_title}** (`#{rel_path}`)\n\n> #{text}\n\nType: `#{type}`"

    case Proposals.create_proposal(%{
      title: title,
      body: body,
      summary: text,
      source: "vault_harvester",
      status: "pending",
      confidence: 0.5,
      proposal_type: "vault_#{type}"
    }) do
      {:ok, _} -> :ok
      _ -> :error
    end
  rescue
    _ -> :error
  end

  defp label_for("unchecked_task"), do: "Task"
  defp label_for("todo"), do: "TODO"
  defp label_for("decision"), do: "Decision"
  defp label_for("idea"), do: "Idea"
  defp label_for("question"), do: "Question"
  defp label_for(type), do: String.capitalize(type)
end
