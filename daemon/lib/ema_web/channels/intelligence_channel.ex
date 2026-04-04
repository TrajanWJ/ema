defmodule EmaWeb.IntelligenceChannel do
  use Phoenix.Channel

  @impl true
  def join("intelligence:tokens", _payload, socket) do
    {:ok, socket}
  end

  @impl true
  def join("intelligence:vm", _payload, socket) do
    {:ok, socket}
  end

  @impl true
  def join("intelligence:" <> _rest, _payload, socket) do
    {:ok, socket}
  end
end
