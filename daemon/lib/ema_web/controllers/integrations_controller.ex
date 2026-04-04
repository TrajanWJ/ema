defmodule EmaWeb.IntegrationsController do
  use EmaWeb, :controller

  alias Ema.Settings

  def status(conn, _params) do
    github_connected = Settings.get("github_token") not in [nil, ""]
    slack_connected = Settings.get("slack_bot_token") not in [nil, ""]

    json(conn, %{
      github: %{connected: github_connected},
      slack: %{connected: slack_connected},
      google_drive: %{connected: false}
    })
  end

  def github_connect(conn, %{"token" => token}) do
    case Settings.set("github_token", token) do
      {:ok, _} -> json(conn, %{ok: true})
      {:error, _} -> conn |> put_status(422) |> json(%{error: "failed to save token"})
    end
  end

  def github_connect(conn, _params) do
    conn |> put_status(400) |> json(%{error: "token required"})
  end

  def slack_connect(conn, %{"token" => token}) do
    case Settings.set("slack_bot_token", token) do
      {:ok, _} -> json(conn, %{ok: true})
      {:error, _} -> conn |> put_status(422) |> json(%{error: "failed to save token"})
    end
  end

  def slack_connect(conn, _params) do
    conn |> put_status(400) |> json(%{error: "token required"})
  end
end
