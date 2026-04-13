defmodule EmaWeb.MetaMindChannel do
  use Phoenix.Channel

  @impl true
  def join("metamind:lobby", _payload, socket) do
    Phoenix.PubSub.subscribe(Ema.PubSub, "metamind:pipeline")

    {:ok, %{}, socket}
  end

  @impl true
  def join("metamind:" <> _rest, _payload, _socket) do
    {:error, %{reason: "unknown_topic"}}
  end

  # Pipeline stage events from Interceptor, Pipeline, Reviewer, Researcher
  # Shape: {:metamind, stage_atom, payload_map}
  @impl true
  def handle_info({:metamind, stage, payload}, socket) when is_atom(stage) and is_map(payload) do
    push(socket, to_string(stage), payload)
    {:noreply, socket}
  end

  def handle_info(_msg, socket) do
    {:noreply, socket}
  end
end
