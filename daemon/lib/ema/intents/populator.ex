defmodule Ema.Intents.Populator do
  @moduledoc """
  Subscribes to PubSub events and auto-creates/updates intents from domain events.

  Listens to:
  - vault:changes (note_created/note_updated) → syncs wiki intent pages to DB
  - brain_dump:item_created → level 4-5 task intent
  - executions:completed → updates linked intent phase/status
  """

  use GenServer
  require Logger

  alias Ema.Intents
  alias Ema.SecondBrain.VaultWatcher

  @intent_wiki_prefix "wiki/Intents/"

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    Phoenix.PubSub.subscribe(Ema.PubSub, "brain_dump")
    Phoenix.PubSub.subscribe(Ema.PubSub, "executions")
    Phoenix.PubSub.subscribe(Ema.PubSub, "vault:changes")
    {:ok, %{}}
  end

  # ── Wiki Intent Page → DB Intent ────────────────────────────────

  @impl true
  def handle_info({event, %{file_path: path} = note}, state)
      when event in [:note_created, :note_updated] and is_binary(path) do
    if intent_wiki_page?(path) do
      handle_wiki_intent(note, event)
    end

    {:noreply, state}
  end

  # ── Brain Dump → Intent ──────────────────────────────────────────

  def handle_info({:brain_dump, :item_created, item}, state) do
    handle_brain_dump(item)
    {:noreply, state}
  end

  # ── Execution Completed → Update Intent ──────────────────────────

  def handle_info({"execution:completed", %{execution: execution}}, state) do
    handle_execution_completed(execution)
    {:noreply, state}
  end

  def handle_info({"execution:completed", %{execution: execution, signal: _signal}}, state) do
    handle_execution_completed(execution)
    {:noreply, state}
  end

  # Catch-all for other messages on subscribed topics
  def handle_info(_msg, state), do: {:noreply, state}

  # ── Handlers ─────────────────────────────────────────────────────

  defp intent_wiki_page?(path) do
    String.starts_with?(path, @intent_wiki_prefix) and
      String.ends_with?(path, ".md") and
      not String.ends_with?(path, "_index.md")
  end

  defp handle_wiki_intent(note, event) do
    vault_root = Ema.SecondBrain.vault_root()
    full_path = Path.join(vault_root, note.file_path)

    case File.read(full_path) do
      {:ok, content} ->
        fm = VaultWatcher.parse_frontmatter(content)
        sync_wiki_intent_to_db(note, fm, content, event)

      {:error, reason} ->
        Logger.warning("[Populator] Could not read wiki intent #{note.file_path}: #{reason}")
    end
  end

  defp sync_wiki_intent_to_db(note, fm, content, event) do
    level = fm["intent_level"]

    unless is_integer(level) do
      # Not an intent page (no intent_level frontmatter) — skip
      :ok
    else
      fingerprint = "wiki:#{note.file_path}"
      title = fm["title"] || note.title || Path.basename(note.file_path, ".md")

      # Extract description from first non-frontmatter paragraph
      description =
        content
        |> String.replace(~r/\A---.*?---\n*/s, "")
        |> String.replace(~r/^#[^\n]*\n*/m, "")
        |> String.split("\n\n", parts: 2)
        |> List.first()
        |> Kernel.||("")
        |> String.trim()
        |> String.slice(0, 500)

      attrs = %{
        title: title,
        description: description,
        level: level,
        kind: to_string(fm["intent_kind"] || "task"),
        source_type: "wiki",
        source_fingerprint: fingerprint,
        status: to_string(fm["intent_status"] || "planned"),
        priority: fm["intent_priority"] || 3,
        project_id: resolve_project_id(fm["project"]),
        provenance_class: "high"
      }

      case Intents.get_intent_by_fingerprint(fingerprint) do
        nil ->
          case Intents.create_intent(attrs) do
            {:ok, intent} ->
              Intents.link_intent(intent.id, "vault_note", note.id,
                role: "origin",
                provenance: "manual"
              )

              Logger.info("[Populator] Created intent '#{title}' from wiki page #{note.file_path}")

            {:error, reason} ->
              Logger.warning("[Populator] Failed to create intent from wiki: #{inspect(reason)}")
          end

        existing when event == :note_updated ->
          update_attrs = Map.drop(attrs, [:source_type, :source_fingerprint])

          case Intents.update_intent(existing, update_attrs) do
            {:ok, _} ->
              Logger.debug("[Populator] Updated intent '#{title}' from wiki page")

            {:error, reason} ->
              Logger.warning("[Populator] Failed to update intent from wiki: #{inspect(reason)}")
          end

        _existing ->
          :ok
      end
    end
  end

  defp resolve_project_id(nil), do: nil
  defp resolve_project_id(slug) when is_binary(slug) do
    case Ema.Projects.get_project_by_slug(slug) do
      %{id: id} -> id
      nil -> nil
    end
  end

  defp handle_brain_dump(item) do
    fingerprint = "brain_dump:#{item.id}"

    if Intents.get_intent_by_fingerprint(fingerprint) do
      :ok
    else
      title = String.slice(item.content || "", 0, 120)

      attrs = %{
        title: title,
        description: item.content,
        level: 4,
        kind: "task",
        source_type: "brain_dump",
        source_fingerprint: fingerprint,
        provenance_class: "medium",
        status: "planned",
        project_id: item.project_id
      }

      case Intents.create_intent(attrs) do
        {:ok, intent} ->
          Intents.link_intent(intent.id, "brain_dump", item.id,
            role: "origin",
            provenance: "manual"
          )

          Logger.debug("[Populator] Created intent #{intent.id} from brain_dump #{item.id}")

        {:error, reason} ->
          Logger.warning("[Populator] Failed to create intent from brain_dump: #{inspect(reason)}")
      end
    end
  end

  defp handle_execution_completed(execution) do
    case find_or_attach_intent_for_execution(execution) do
      nil ->
        Logger.debug("[Populator] No intent linked to execution #{execution.id}")

      intent ->
        new_phase = min(intent.phase + 1, 5)
        new_status = if execution.status == "completed", do: "researched", else: intent.status

        case Intents.update_intent(intent, %{phase: new_phase, status: new_status}) do
          {:ok, _updated} ->
            Logger.debug("[Populator] Updated intent #{intent.id} from execution #{execution.id}")

          {:error, reason} ->
            Logger.warning("[Populator] Failed to update intent: #{inspect(reason)}")
        end
    end
  end

  defp find_intent_for_execution(execution_id) do
    import Ecto.Query

    case Ema.Repo.one(
           from l in Ema.Intents.IntentLink,
             where: l.linkable_type == "execution" and l.linkable_id == ^execution_id,
             select: l.intent_id,
             limit: 1
         ) do
      nil -> nil
      intent_id -> Intents.get_intent(intent_id)
    end
  end

  defp find_or_attach_intent_for_execution(execution) do
    case find_intent_for_execution(execution.id) do
      nil ->
        execution
        |> find_intent_from_execution_anchor()
        |> case do
          nil ->
            nil

          intent ->
            _ =
              Intents.link_intent(intent.id, "execution", execution.id,
                role: "derived",
                provenance: "execution"
              )

            intent
        end

      intent ->
        intent
    end
  end

  defp find_intent_from_execution_anchor(%{brain_dump_item_id: item_id})
       when is_binary(item_id) and item_id != "" do
    import Ecto.Query

    case Ema.Repo.one(
           from l in Ema.Intents.IntentLink,
             where: l.linkable_type == "brain_dump" and l.linkable_id == ^item_id,
             select: l.intent_id,
             limit: 1
         ) do
      nil -> nil
      intent_id -> Intents.get_intent(intent_id)
    end
  end

  defp find_intent_from_execution_anchor(%{intent_slug: slug}) when is_binary(slug) and slug != "" do
    Intents.get_intent_by_slug(slug)
  end

  defp find_intent_from_execution_anchor(_), do: nil
end
