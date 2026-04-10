defmodule Ema.Context.Adapter do
  @moduledoc "Behaviour for context source adapters."
  @callback fetch(keyword()) :: list(map())
end
