defmodule EmaWeb.WebhookController do
  use EmaWeb, :controller

  require Logger

  alias EmaWeb.AccessControl
  alias Ema.Integrations.GitHub.Webhook, as: GitHubWebhook
  alias Ema.Integrations.Slack.Router, as: SlackRouter

  # GitHub webhook — verifies HMAC signature, dispatches to handler
  def github(conn, params) do
    event_type = get_req_header(conn, "x-github-event") |> List.first()
    signature = get_req_header(conn, "x-hub-signature-256") |> List.first()

    case verify_github_signature(conn, signature) do
      :ok ->
        GitHubWebhook.handle_event(event_type, params)
        json(conn, %{ok: true})

      :unconfigured_secret ->
        Logger.warning("GitHub webhook received without a configured secret — refusing remote delivery")
        conn |> put_status(401) |> json(%{error: "missing_github_webhook_secret"})

      :error ->
        conn |> put_status(401) |> json(%{error: "invalid signature"})
    end
  end

  # Slack slash command
  def slack_command(conn, params) do
    response = SlackRouter.route_command(params)
    json(conn, response)
  end

  # Slack Events API
  def slack_event(conn, %{"type" => "url_verification", "challenge" => challenge}) do
    conn
    |> put_resp_content_type("text/plain")
    |> send_resp(200, challenge)
  end

  def slack_event(conn, params) do
    SlackRouter.route_event(params)
    json(conn, %{ok: true})
  end

  defp verify_github_signature(conn, signature) do
    secret = Ema.Settings.get("github_webhook_secret")

    cond do
      secret in [nil, ""] and AccessControl.local_request?(conn) ->
        :ok

      secret in [nil, ""] ->
        :unconfigured_secret

      is_nil(signature) ->
        :error

      true ->
        body = read_raw_body(conn)
        if body == "" do
          :error
        else
          expected =
            ("sha256=" <> :crypto.mac(:hmac, :sha256, secret, body)) |> Base.encode16(case: :lower)

          if secure_compare(signature, expected), do: :ok, else: :error
        end
    end
  end

  defp secure_compare(a, b) when byte_size(a) == byte_size(b), do: Plug.Crypto.secure_compare(a, b)
  defp secure_compare(_, _), do: false

  defp read_raw_body(conn) do
    case conn.private[:raw_body] do
      nil -> ""
      body when is_binary(body) -> body
      chunks when is_list(chunks) -> IO.iodata_to_binary(chunks)
    end
  end
end
