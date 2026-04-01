defmodule EmaWeb.DiscordWebhookController do
  @moduledoc """
  Receives Discord interaction webhooks (slash commands, components, etc.)
  and forwards them to the appropriate agent's DiscordChannel GenServer.

  Note: Ema.Agents.DiscordChannel currently uses HTTP polling, not the
  Gateway or interaction webhooks. This controller is a stub for future
  webhook/interaction mode.
  """

  use EmaWeb, :controller

  require Logger

  action_fallback EmaWeb.FallbackController

  def webhook(conn, params) do
    Logger.info("DiscordWebhookController: received webhook payload")
    Logger.debug("DiscordWebhookController: #{inspect(params)}")

    # TODO: When DiscordChannel supports interaction webhooks, forward
    # the payload here. Discord expects a 200 response within 3 seconds.

    json(conn, %{status: "ok"})
  end
end
