defmodule EmaWeb.IntentsChannel do
  use Phoenix.Channel

  alias Ema.Intents

  @impl true
  def join("intents:lobby", _payload, socket) do
    Phoenix.PubSub.subscribe(Ema.PubSub, "intents")

    summary = Intents.status_summary()
    {:ok, %{summary: summary}, socket}
  end

  @impl true
  def join("intents:" <> _rest, _payload, socket) do
    Phoenix.PubSub.subscribe(Ema.PubSub, "intents")
    {:ok, socket}
  end

  # Relay PubSub events to WebSocket clients
  @impl true
  def handle_info({"intents:created", serialized}, socket) do
    push(socket, "intent_created", %{intent: serialized})
    {:noreply, socket}
  end

  def handle_info({"intents:status_changed", serialized}, socket) do
    push(socket, "intent_status_changed", %{intent: serialized})
    {:noreply, socket}
  end

  def handle_info({"intents:linked", payload}, socket) do
    push(socket, "intent_linked", payload)
    {:noreply, socket}
  end

  def handle_info(_msg, socket), do: {:noreply, socket}

  # Client requests
  @impl true
  def handle_in("get_tree", params, socket) do
    opts = []
    opts = if params["project_id"], do: [project_id: params["project_id"]] ++ opts, else: opts

    tree =
      Intents.tree(opts)
      |> Enum.map(&Intents.serialize_tree/1)

    {:reply, {:ok, %{tree: tree}}, socket}
  end

  def handle_in("get_intent", %{"id" => id}, socket) do
    case Intents.get_intent_detail(id) do
      nil ->
        {:reply, {:error, %{reason: "not_found"}}, socket}

      detail ->
        {:reply, {:ok, %{intent: detail}}, socket}
    end
  end

  def handle_in("create", %{"intent" => attrs}, socket) do
    case Intents.create_intent(attrs) do
      {:ok, intent} ->
        {:reply, {:ok, %{intent: Intents.serialize(intent)}}, socket}

      {:error, changeset} ->
        {:reply, {:error, %{reason: inspect(changeset.errors)}}, socket}
    end
  end
end
