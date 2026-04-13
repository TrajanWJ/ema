defmodule EmaWeb.ChannelCase do
  use ExUnit.CaseTemplate

  using do
    quote do
      use Phoenix.ChannelTest
      import EmaWeb.ChannelCase

      @endpoint EmaWeb.Endpoint
    end
  end

  setup tags do
    Ema.DataCase.setup_sandbox(tags)
    :ok
  end
end
