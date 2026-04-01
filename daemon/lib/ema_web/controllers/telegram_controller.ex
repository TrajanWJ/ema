defmodule EmaWeb.TelegramController do
  @moduledoc """
  Receives Telegram webhook payloads and forwards them to the
  appropriate agent's TelegramChannel GenServer.

  Note: Ema.Agents.TelegramChannel currently uses long-polling, not
  webhooks. This controller is a stub for future webhook mode.
  """

  use EmaWeb, :controller

  require Logger

  action_fallback EmaWeb.FallbackController

  def webhook(conn, params) do
    Logger.info("TelegramController: received webhook payload")
    Logger.debug("TelegramController: #{inspect(params)}")

    # TODO: When TelegramChannel supports webhook mode, forward the
    # update payload here instead of relying on long-polling.

    json(conn, %{status: "ok"})
  end
end
