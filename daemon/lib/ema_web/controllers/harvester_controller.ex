defmodule EmaWeb.HarvesterController do
  @moduledoc """
  Stub controller for harvester status and manual trigger endpoints.
  Harvesters (Git, Session, Vault, Usage, BrainDump) are designed but not yet implemented.
  """

  use EmaWeb, :controller

  action_fallback EmaWeb.FallbackController

  # GET /api/harvesters
  def index(conn, _params) do
    json(conn, %{
      harvesters: [
        %{name: "git", status: "idle", last_run: nil},
        %{name: "session", status: "idle", last_run: nil},
        %{name: "vault", status: "idle", last_run: nil},
        %{name: "usage", status: "idle", last_run: nil},
        %{name: "brain_dump", status: "idle", last_run: nil}
      ]
    })
  end

  # GET /api/harvesters/recent
  def recent(conn, _params) do
    json(conn, %{events: []})
  end

  # POST /api/harvesters/:name/run
  def run(conn, %{"name" => name}) do
    json(conn, %{ok: true, harvester: name, message: "Harvester queued"})
  end
end
