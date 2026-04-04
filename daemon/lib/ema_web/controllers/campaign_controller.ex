defmodule EmaWeb.CampaignController do
  use EmaWeb, :controller

  alias Ema.Campaigns.CampaignManager

  def index(conn, _params) do
    flows = CampaignManager.list_active()
    json(conn, %{ok: true, campaigns: Enum.map(flows, &flow_json/1)})
  end

  def show(conn, %{"id" => id}) do
    case CampaignManager.status(id) do
      {:ok, flow} ->
        json(conn, %{ok: true, campaign: flow_json(flow)})

      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{error: "Not found"})
    end
  end

  def create(conn, params) do
    name = params["name"] || "Unnamed Campaign"
    attrs = Map.take(params, ["campaign_id", "metadata"])

    case CampaignManager.start_campaign(name, attrs) do
      {:ok, flow} ->
        conn |> put_status(:created) |> json(%{ok: true, campaign: flow_json(flow)})

      {:error, err} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(err)})
    end
  end

  def advance(conn, %{"id" => id} = params) do
    metadata = Map.get(params, "metadata", %{})

    case CampaignManager.advance(id, metadata) do
      {:ok, flow} ->
        json(conn, %{ok: true, campaign: flow_json(flow)})

      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{error: "Not found"})

      {:error, err} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(err)})
    end
  end

  defp flow_json(flow) do
    %{
      id: flow.id,
      campaign_id: flow.campaign_id,
      name: flow.title,
      state: flow.state,
      metadata: flow.state_metadata,
      inserted_at: flow.inserted_at,
      updated_at: flow.updated_at
    }
  end
end
