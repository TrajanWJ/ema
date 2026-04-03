defmodule EmaWeb.IntentChannel do
  use Phoenix.Channel

  alias Ema.Intelligence.IntentMap

  @impl true
  def join("intent:live", _payload, socket) do
    nodes = IntentMap.list_nodes() |> Enum.map(&IntentMap.serialize/1)
    {:ok, %{nodes: nodes}, socket}
  end

  @impl true
  def join("intent:" <> _rest, _payload, socket) do
    {:ok, socket}
  end
end
