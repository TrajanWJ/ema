defmodule EmaWeb.NotesChannel do
  use Phoenix.Channel

  alias Ema.Notes

  @impl true
  def join("notes:updates", _payload, socket) do
    Phoenix.PubSub.subscribe(Ema.PubSub, "notes")
    notes = Notes.list_notes() |> Enum.map(&Notes.serialize/1)
    {:ok, %{notes: notes}, socket}
  end

  @impl true
  def handle_info({:note_created, note}, socket) do
    push(socket, "note_created", note)
    {:noreply, socket}
  end

  def handle_info({:note_updated, note}, socket) do
    push(socket, "note_updated", note)
    {:noreply, socket}
  end

  def handle_info({:note_deleted, note}, socket) do
    push(socket, "note_deleted", note)
    {:noreply, socket}
  end

  def handle_info(_msg, socket), do: {:noreply, socket}
end
