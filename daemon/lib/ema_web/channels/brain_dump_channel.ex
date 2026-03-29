defmodule EmaWeb.BrainDumpChannel do
  use Phoenix.Channel

  alias Ema.BrainDump

  @impl true
  def join("brain_dump:queue", _payload, socket) do
    items =
      BrainDump.list_items()
      |> Enum.map(fn item ->
        %{
          id: item.id,
          content: item.content,
          source: item.source,
          processed: item.processed,
          action: item.action,
          processed_at: item.processed_at,
          created_at: item.inserted_at,
          updated_at: item.updated_at
        }
      end)

    {:ok, %{items: items}, socket}
  end
end
