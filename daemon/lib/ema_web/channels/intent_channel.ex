defmodule EmaWeb.IntentChannel do
  use Phoenix.Channel

  alias Ema.Intelligence.IntentMap
  alias Ema.Intents

  @impl true
  def join("intent:live", _payload, socket) do
    # Subscribe to new Intents PubSub topic so we can forward events
    Phoenix.PubSub.subscribe(Ema.PubSub, "intents")

    # Merge old nodes + new intents for initial payload
    old_nodes = IntentMap.list_nodes() |> Enum.map(&IntentMap.serialize/1)
    new_intents = Intents.list_intents() |> Enum.map(&Intents.serialize/1)
    merged = (old_nodes ++ new_intents) |> Enum.uniq_by(& &1.id)

    {:ok, %{nodes: merged}, socket}
  end

  @impl true
  def join("intent:" <> _rest, _payload, socket) do
    {:ok, socket}
  end

  # Handle "get_tree" from clients — try new system first
  @impl true
  def handle_in("get_tree", %{"project_id" => project_id}, socket) do
    tree =
      case Intents.tree(project_id: project_id) do
        [] -> IntentMap.tree(project_id)
        new_tree -> Enum.map(new_tree, &Intents.serialize_tree/1)
      end

    {:reply, {:ok, %{tree: tree}}, socket}
  end

  def handle_in("get_tree", _params, socket) do
    tree = Intents.tree() |> Enum.map(&Intents.serialize_tree/1)
    {:reply, {:ok, %{tree: tree}}, socket}
  end

  # Forward new Intents PubSub events to old channel subscribers
  @impl true
  def handle_info({"intents:created", intent_data}, socket) do
    push(socket, "node_created", intent_data)
    {:noreply, socket}
  end

  def handle_info({"intents:status_changed", intent_data}, socket) do
    push(socket, "node_updated", intent_data)
    {:noreply, socket}
  end

  def handle_info(_msg, socket) do
    {:noreply, socket}
  end
end
