defmodule EmaWeb.VaultChannel do
  use Phoenix.Channel

  alias Ema.SecondBrain

  @impl true
  def join("vault:files", _payload, socket) do
    notes =
      SecondBrain.list_notes()
      |> Enum.map(&serialize_note/1)

    {:ok, %{notes: notes}, socket}
  end

  @impl true
  def join("vault:graph", _payload, socket) do
    Phoenix.PubSub.subscribe(Ema.PubSub, "vault:changes")
    graph = SecondBrain.get_full_graph()
    {:ok, graph, socket}
  end

  @impl true
  def handle_info({event, data}, socket) when event in [:note_created, :note_updated, :note_deleted, :note_moved] do
    push(socket, Atom.to_string(event), %{data: serialize_change(data)})
    {:noreply, socket}
  end

  def handle_info(_msg, socket) do
    {:noreply, socket}
  end

  defp serialize_change(%{id: _} = note) do
    serialize_note(note)
  end

  defp serialize_change(other), do: other

  defp serialize_note(note) do
    %{
      id: note.id,
      file_path: note.file_path,
      title: note.title,
      space: note.space,
      tags: note.tags,
      word_count: note.word_count,
      created_at: note.inserted_at,
      updated_at: note.updated_at
    }
  end
end
