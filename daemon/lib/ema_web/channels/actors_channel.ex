defmodule EmaWeb.ActorsChannel do
  use EmaWeb, :channel

  @impl true
  def join("actors:lobby", _payload, socket) do
    actors = Ema.Actors.list_actors()

    serialized =
      Enum.map(actors, fn a ->
        %{
          id: a.id,
          slug: a.slug,
          name: a.name,
          actor_type: a.actor_type,
          phase: a.phase,
          status: a.status
        }
      end)

    {:ok, %{actors: serialized}, socket}
  end

  def join("actors:" <> _rest, _payload, socket) do
    {:ok, socket}
  end

  @impl true
  def handle_in(_event, _payload, socket) do
    {:noreply, socket}
  end
end
