defmodule EmaWeb.CanvasChannel do
  use Phoenix.Channel

  alias Ema.Canvases

  @impl true
  def join("canvas:" <> canvas_id, _payload, socket) do
    case Canvases.get_canvas_with_elements(canvas_id) do
      {:ok, canvas} ->
        socket = assign(socket, :canvas_id, canvas_id)

        # Subscribe to live data topics so linked elements get pushed updates
        for el <- canvas.elements do
          if el.data_source && el.data_source != "" do
            :ok = Phoenix.PubSub.subscribe(Ema.PubSub, "canvas:data:#{el.id}")
          end
        end

        # Subscribe to domain PubSub topics for cross-domain pushes
        # NOTE: tasks context broadcasts on "task_events", not "tasks:updates"
        :ok = Phoenix.PubSub.subscribe(Ema.PubSub, "task_events")
        # TODO: proposals pipeline does not broadcast on PubSub yet — uses Endpoint.broadcast
        # :ok = Phoenix.PubSub.subscribe(Ema.PubSub, "proposals:pipeline")
        # TODO: focus module does not broadcast on PubSub yet (scaffolded, no GenServer)
        # :ok = Phoenix.PubSub.subscribe(Ema.PubSub, "focus:updates")

        send(self(), {:send_canvas, canvas})
        {:ok, socket}

      {:error, :not_found} ->
        {:error, %{reason: "canvas not found"}}
    end
  end

  @impl true
  def handle_in("element:create", params, socket) do
    canvas_id = socket.assigns.canvas_id

    attrs = %{
      element_type: params["element_type"],
      x: params["x"],
      y: params["y"],
      width: params["width"],
      height: params["height"],
      rotation: params["rotation"],
      z_index: params["z_index"],
      style: params["style"],
      text: params["text"],
      data_source: params["data_source"],
      data_config: params["data_config"],
      chart_config: params["chart_config"],
      refresh_interval: params["refresh_interval"],
      group_id: params["group_id"]
    }

    case Canvases.create_element(canvas_id, attrs) do
      {:ok, element} ->
        broadcast!(socket, "element:created", serialize_element(element))
        maybe_track_refresh(element)
        maybe_subscribe_data(element)
        {:reply, {:ok, serialize_element(element)}, socket}

      {:error, changeset} ->
        {:reply, {:error, %{errors: changeset_errors(changeset)}}, socket}
    end
  end

  @impl true
  def handle_in("element:update", %{"id" => id} = params, socket) do
    with {:ok, element} <- Canvases.get_element(id),
         {:ok, updated} <- Canvases.update_element(element, Map.drop(params, ["id"])) do
      broadcast!(socket, "element:updated", serialize_element(updated))
      maybe_track_refresh(updated)
      {:reply, {:ok, serialize_element(updated)}, socket}
    else
      {:error, :not_found} ->
        {:reply, {:error, %{reason: "element not found"}}, socket}

      {:error, changeset} ->
        {:reply, {:error, %{errors: changeset_errors(changeset)}}, socket}
    end
  end

  @impl true
  def handle_in("element:delete", %{"id" => id}, socket) do
    with {:ok, element} <- Canvases.get_element(id),
         {:ok, _} <- Canvases.delete_element(element) do
      Ema.Canvas.DataRefresher.untrack_element(id)
      broadcast!(socket, "element:deleted", %{id: id})
      {:reply, :ok, socket}
    else
      {:error, :not_found} ->
        {:reply, {:error, %{reason: "element not found"}}, socket}
    end
  end

  @impl true
  def handle_in("elements:reorder", %{"element_ids" => ids}, socket) do
    canvas_id = socket.assigns.canvas_id

    case Canvases.reorder_elements(canvas_id, ids) do
      {:ok, _} ->
        broadcast!(socket, "elements:reordered", %{element_ids: ids})
        {:reply, :ok, socket}

      {:error, reason} ->
        {:reply, {:error, %{reason: reason}}, socket}
    end
  end

  # Live data refresh from DataRefresher
  @impl true
  def handle_info({:data_refresh, element_id, data}, socket) do
    push(socket, "element:data_updated", %{element_id: element_id, data: data})
    {:noreply, socket}
  end

  # Domain event handlers — notify canvas clients when linked data changes
  # task_events PubSub broadcasts {:task_completed, %{...}}
  @impl true
  def handle_info({:task_completed, _payload}, socket), do: push_domain_event(socket, "tasks")

  def handle_info({:proposals, _stage, _proposal}, socket),
    do: push_domain_event(socket, "proposals")

  def handle_info({:session_started, _session}, socket), do: push_domain_event(socket, "focus")
  def handle_info({:session_ended, _session}, socket), do: push_domain_event(socket, "focus")

  def handle_info({:send_canvas, canvas}, socket) do
    elements = Enum.map(canvas.elements, &serialize_element/1)

    push(socket, "snapshot", %{
      id: canvas.id,
      name: canvas.name,
      canvas_type: canvas.canvas_type,
      viewport: canvas.viewport,
      settings: canvas.settings,
      elements: elements
    })

    {:noreply, socket}
  end

  # Catch-all for unhandled PubSub messages
  def handle_info(_msg, socket), do: {:noreply, socket}

  @impl true
  def terminate(_reason, socket) do
    canvas_id = socket.assigns[:canvas_id]
    Phoenix.PubSub.unsubscribe(Ema.PubSub, "task_events")

    if canvas_id do
      case Canvases.get_canvas_with_elements(canvas_id) do
        {:ok, canvas} ->
          for el <- canvas.elements do
            if el.data_source && el.data_source != "" do
              Phoenix.PubSub.unsubscribe(Ema.PubSub, "canvas:data:#{el.id}")
            end
          end

        _ ->
          :ok
      end
    end

    :ok
  end

  defp push_domain_event(socket, domain) do
    # Refresh all data-bound elements matching this domain
    canvas_id = socket.assigns.canvas_id

    case Canvases.get_canvas_with_elements(canvas_id) do
      {:ok, canvas} ->
        for el <- canvas.elements do
          if el.data_source && String.starts_with?(el.data_source, domain) do
            case Ema.Canvas.DataSource.fetch(el.data_source, el.data_config) do
              {:ok, data} ->
                push(socket, "element:data_updated", %{element_id: el.id, data: data})

              _ ->
                :ok
            end
          end
        end

      _ ->
        :ok
    end

    {:noreply, socket}
  end

  defp maybe_track_refresh(%{data_source: ds, refresh_interval: ri} = element)
       when is_binary(ds) and ds != "" and is_integer(ri) and ri > 0 do
    Ema.Canvas.DataRefresher.track_element(
      element.id,
      element.data_source,
      element.data_config,
      element.refresh_interval
    )
  end

  defp maybe_track_refresh(_element), do: :ok

  defp maybe_subscribe_data(%{data_source: ds} = element) when is_binary(ds) and ds != "" do
    Phoenix.PubSub.subscribe(Ema.PubSub, "canvas:data:#{element.id}")
  end

  defp maybe_subscribe_data(_element), do: :ok

  defp serialize_element(element) do
    %{
      id: element.id,
      element_type: element.element_type,
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      rotation: element.rotation,
      z_index: element.z_index,
      locked: element.locked,
      style: element.style,
      text: element.text,
      points: element.points,
      image_path: element.image_path,
      data_source: element.data_source,
      data_config: element.data_config,
      chart_config: element.chart_config,
      refresh_interval: element.refresh_interval,
      group_id: element.group_id,
      canvas_id: element.canvas_id
    }
  end

  defp changeset_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Regex.replace(~r"%{(\w+)}", msg, fn _, key ->
        opts |> Keyword.get(String.to_existing_atom(key), key) |> to_string()
      end)
    end)
  end
end
