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
    Logger.info("TelegramController: received webhook payload (stub)")
    Logger.debug("TelegramController: #{inspect(params)}")

    json(conn, %{status: "ok", note: "webhook mode for Telegram is currently not implemented"})
  end
end
