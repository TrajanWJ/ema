defmodule Ema.Context.Adapters.MemoryAdapter do
  @moduledoc "Memory truth adapter placeholder for typed memory entry retrieval."
  @behaviour Ema.Context.Adapter
  @impl true
  def fetch(_opts \\ []), do: []
end
