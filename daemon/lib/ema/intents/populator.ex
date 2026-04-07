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
  alias Ema.Proposals
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
    Phoenix.PubSub.subscribe(Ema.PubSub, "ai:sessions")
    Phoenix.PubSub.subscribe(Ema.PubSub, "proposals:pipeline")
    Phoenix.PubSub.subscribe(Ema.PubSub, "intention_farmer:events")
    Phoenix.PubSub.subscribe(Ema.PubSub, "intents")

    # Periodic backfeed: harvest unprocessed intents into wiki pages
    schedule_backfeed()
    {:ok, %{}}
  end

  defp schedule_backfeed do
    Process.send_after(self(), :backfeed_harvested_intents, :timer.minutes(10))
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

  # ── Session Completed → Extract Intent ───────────────────────────

  def handle_info({:session_completed, session}, state) do
    handle_session_backfeed(session)
    {:noreply, state}
  end

  # ── Proposal Created → Check for Intent Linkage ─────────────────

  def handle_info({:proposals, :queued, proposal}, state) do
    handle_proposal_intent_link(proposal)
    {:noreply, state}
  end

  # ── IntentionFarmer Bootstrap Complete → Backfeed Harvested ──────

  def handle_info({:startup_bootstrap_complete, _payload}, state) do
    Task.start(fn -> backfeed_harvested_intents() end)
    {:noreply, state}
  end

  # ── Intent Created → Generate Proposal Seed ──────────────────────

  def handle_info({"intents:created", intent_data}, state) do
    maybe_create_proposal_seed(intent_data)
    {:noreply, state}
  end

  def handle_info({"intents:status_changed", intent_data}, state) do
    # When intent moves to "active" or "implementing", refresh its seed
    status = intent_data[:status] || intent_data["status"]
    if status in ["active", "implementing"] do
      maybe_create_proposal_seed(intent_data)
    end
    {:noreply, state}
  end

  # ── Periodic Backfeed Timer ─────────────────────────────────────

  def handle_info(:backfeed_harvested_intents, state) do
    Task.start(fn -> backfeed_harvested_intents() end)
    schedule_backfeed()
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

  # ── Session Backfeed ─────────────────────────────────────────────

  defp handle_session_backfeed(session) do
    # Extract intent from session metadata and create wiki page if new
    project_path = Map.get(session, :project_path) || Map.get(session, "project_path")
    title = Map.get(session, :title) || Map.get(session, "title") || "Session #{Map.get(session, :id, "unknown")}"

    fingerprint = "session:#{Map.get(session, :id) || Map.get(session, "id")}"

    unless Intents.get_intent_by_fingerprint(fingerprint) do
      project_id = if project_path, do: resolve_project_from_path(project_path)

      attrs = %{
        title: String.slice(title, 0, 120),
        description: "Extracted from coding session. Project: #{project_path || "unknown"}",
        level: 5,
        kind: "task",
        source_type: "wiki",
        source_fingerprint: fingerprint,
        provenance_class: "medium",
        status: "planned",
        project_id: project_id
      }

      case Intents.create_intent(attrs) do
        {:ok, intent} ->
          Logger.debug("[Populator] Created intent from session: #{intent.slug}")
          # IntentProjector will auto-create wiki page

        {:error, _} -> :ok
      end
    end
  rescue
    _ -> :ok
  end

  defp handle_proposal_intent_link(proposal) do
    # When a proposal reaches "queued", check if it should be linked to an intent
    title = Map.get(proposal, :title) || Map.get(proposal, "title") || ""

    # Try to find a matching intent by slug similarity
    slug = Ema.Executions.IntentFolder.slugify(String.slice(title, 0, 60))

    case Intents.get_intent_by_slug(slug) do
      %{id: intent_id} ->
        proposal_id = Map.get(proposal, :id) || Map.get(proposal, "id")
        if proposal_id do
          Intents.link_intent(intent_id, "proposal", to_string(proposal_id),
            role: "evidence",
            provenance: "system"
          )
        end

      nil -> :ok
    end
  rescue
    _ -> :ok
  end

  # ── Periodic Harvested Intent Backfeed ───────────────────────────

  defp backfeed_harvested_intents do
    # Read HarvestedIntent records that haven't been converted to intents yet
    import Ecto.Query

    harvested =
      try do
        if Code.ensure_loaded?(Ema.IntentionFarmer.HarvestedIntent) do
          Ema.Repo.all(
            from hi in Ema.IntentionFarmer.HarvestedIntent,
              where: hi.loaded == false,
              limit: 20,
              order_by: [desc: hi.inserted_at]
          )
        else
          []
        end
      rescue
        _ -> []
      end

    for hi <- harvested do
      fingerprint = "harvest:#{hi.id}"

      unless Intents.get_intent_by_fingerprint(fingerprint) do
        attrs = %{
          title: String.slice(hi.title || hi.content || "", 0, 120),
          description: hi.content,
          level: 4,
          kind: to_string(hi.intent_type || "task"),
          source_type: "wiki",
          source_fingerprint: fingerprint,
          provenance_class: "medium",
          status: "planned",
          project_id: hi.project_id
        }

        case Intents.create_intent(attrs) do
          {:ok, intent} ->
            Logger.info("[Populator] Backfed harvested intent → #{intent.slug}")
            # Mark as loaded
            try do
              hi
              |> Ecto.Changeset.change(%{loaded: true})
              |> Ema.Repo.update()
            rescue
              _ -> :ok
            end

          {:error, _} -> :ok
        end
      end
    end

    if length(harvested) > 0 do
      Logger.info("[Populator] Backfed #{length(harvested)} harvested intents")
    end
  rescue
    e -> Logger.debug("[Populator] Backfeed skipped: #{Exception.message(e)}")
  end

  # ── Intent → Proposal Seed ────────────────────────────────────────

  defp maybe_create_proposal_seed(intent_data) do
    title = intent_data[:title] || intent_data["title"] || ""
    slug = intent_data[:slug] || intent_data["slug"] || ""
    level = intent_data[:level] || intent_data["level"] || 4
    description = intent_data[:description] || intent_data["description"] || ""
    project_id = intent_data[:project_id] || intent_data["project_id"]
    kind = intent_data[:kind] || intent_data["kind"] || "task"

    # Only create seeds for actionable intents (level 3-5: feature/task/execution)
    if level >= 3 and String.length(title) > 5 do
      seed_name = "intent:#{slug}"

      # Check if seed already exists
      existing =
        try do
          import Ecto.Query
          Ema.Repo.one(
            from s in Ema.Proposals.Seed,
              where: s.name == ^seed_name,
              limit: 1
          )
        rescue
          _ -> nil
        end

      unless existing do
        prompt = """
        You are analyzing an intent from EMA's intent schematic.

        Intent: #{title}
        Level: #{level} (#{Ema.Intents.Intent.level_name(level)})
        Kind: #{kind}
        Description: #{description}

        Generate a concrete, actionable proposal to advance this intent.
        Consider: what is the smallest next step that would make measurable progress?
        Be specific about files to change, tests to write, or research to conduct.
        """

        case Proposals.create_seed(%{
               name: seed_name,
               prompt_template: String.trim(prompt),
               seed_type: "intent",
               schedule: "manual",
               active: true,
               project_id: project_id,
               metadata: %{"intent_slug" => slug, "intent_level" => level}
             }) do
          {:ok, seed} ->
            Logger.info("[Populator] Created proposal seed '#{seed.name}' from intent '#{slug}'")

          {:error, reason} ->
            Logger.debug("[Populator] Failed to create seed from intent: #{inspect(reason)}")
        end
      end
    end
  rescue
    _ -> :ok
  end

  defp resolve_project_from_path(nil), do: nil
  defp resolve_project_from_path(path) when is_binary(path) do
    # Try to match project by linked_path
    import Ecto.Query

    case Ema.Repo.one(
           from p in Ema.Projects.Project,
             where: not is_nil(p.linked_path) and p.linked_path == ^path,
             select: p.id,
             limit: 1
         ) do
      nil ->
        # Fallback: match by path suffix
        slug = path |> String.split("/") |> List.last()
        case Ema.Projects.get_project_by_slug(slug || "") do
          %{id: id} -> id
          nil -> nil
        end

      id -> id
    end
  rescue
    _ -> nil
  end
end
