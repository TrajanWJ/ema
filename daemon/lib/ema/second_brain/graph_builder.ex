defmodule Ema.SecondBrain.GraphBuilder do
  @moduledoc """
  Builds and maintains the vault link graph.
  Parses markdown content for [[wikilinks]] and creates vault_links entries.
  Listens to PubSub events for incremental updates.
  """

  use GenServer
  require Logger

  alias Ema.SecondBrain
  alias Ema.SecondBrain.{Note, Link}
  alias Ema.Repo

  import Ecto.Query

  # Matches [[wikilink]] and [[wikilink|display text]]
  @wikilink_regex ~r/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def rebuild do
    GenServer.cast(__MODULE__, :rebuild)
  end

  def rebuild_note(note_id) do
    GenServer.cast(__MODULE__, {:rebuild_note, note_id})
  end

  @doc "Parse wikilinks from markdown content. Returns list of link_text strings."
  def parse_wikilinks(content) when is_binary(content) do
    @wikilink_regex
    |> Regex.scan(content)
    |> Enum.map(fn [_full, link_text] -> String.trim(link_text) end)
    |> Enum.uniq()
  end

  def parse_wikilinks(_), do: []

  # --- Server Callbacks ---

  @impl true
  def init(_opts) do
    Phoenix.PubSub.subscribe(Ema.PubSub, "vault:changes")
    send(self(), :initial_build)
    {:ok, %{}}
  end

  @impl true
  def handle_info(:initial_build, state) do
    do_rebuild()
    {:noreply, state}
  end

  @impl true
  def handle_info({:note_created, note}, state) do
    do_rebuild_note(note.id)
    {:noreply, state}
  end

  @impl true
  def handle_info({:note_updated, note}, state) do
    do_rebuild_note(note.id)
    {:noreply, state}
  end

  @impl true
  def handle_info({:note_deleted, _note}, state) do
    # Full rebuild on delete to clean up orphaned links
    do_rebuild()
    {:noreply, state}
  end

  @impl true
  def handle_info({:note_moved, note}, state) do
    do_rebuild_note(note.id)
    {:noreply, state}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  @impl true
  def handle_cast(:rebuild, state) do
    do_rebuild()
    {:noreply, state}
  end

  @impl true
  def handle_cast({:rebuild_note, note_id}, state) do
    do_rebuild_note(note_id)
    {:noreply, state}
  end

  # --- Private ---

  defp do_rebuild do
    Logger.info("GraphBuilder: full rebuild starting")
    notes = Repo.all(Note)

    # Delete all existing links
    Repo.delete_all(Link)

    # Rebuild links for each note
    Enum.each(notes, fn note ->
      build_links_for_note(note, notes)
    end)

    Phoenix.PubSub.broadcast(Ema.PubSub, "vault:graph", :graph_updated)
    Logger.info("GraphBuilder: full rebuild complete (#{length(notes)} notes)")
  end

  defp do_rebuild_note(note_id) do
    case Repo.get(Note, note_id) do
      nil ->
        :ok

      note ->
        # Delete existing outgoing links for this note
        Link
        |> where([l], l.source_note_id == ^note_id)
        |> Repo.delete_all()

        all_notes = Repo.all(Note)
        build_links_for_note(note, all_notes)
        Phoenix.PubSub.broadcast(Ema.PubSub, "vault:graph", :graph_updated)
    end
  end

  defp build_links_for_note(note, all_notes) do
    case SecondBrain.read_note_content(note.file_path) do
      {:ok, content} ->
        # Strip frontmatter before parsing
        body = strip_frontmatter(content)
        wikilinks = parse_wikilinks(body)

        Enum.each(wikilinks, fn link_text ->
          target = resolve_link(link_text, all_notes)
          context = extract_context(body, link_text)

          SecondBrain.create_link(%{
            link_text: link_text,
            link_type: "wikilink",
            context: context,
            source_note_id: note.id,
            target_note_id: target && target.id
          })
        end)

      {:error, _} ->
        :ok
    end
  end

  defp resolve_link(link_text, notes) do
    # Try exact path match first, then title match
    Enum.find(notes, fn n ->
      n.file_path == link_text ||
        n.file_path == "#{link_text}.md" ||
        n.title == link_text
    end)
  end

  defp extract_context(content, link_text) do
    # Find the sentence/line containing the link
    content
    |> String.split(~r/\n/, trim: true)
    |> Enum.find(fn line -> String.contains?(line, "[[#{link_text}") end)
    |> case do
      nil -> nil
      line -> String.slice(line, 0, 200)
    end
  end

  defp strip_frontmatter(content) do
    case Regex.run(~r/\A---\n.*?\n---\n(.*)/s, content) do
      [_, body] -> body
      _ -> content
    end
  end
end
