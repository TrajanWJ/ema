defmodule EmaWeb.CampaignController do
  use EmaWeb, :controller

  alias Ema.Campaigns
  alias Ema.Campaigns.CampaignManager

  # ---------------------------------------------------------------------------
  # Campaign templates
  # ---------------------------------------------------------------------------

  def index(conn, _params) do
    campaigns = Campaigns.list_campaigns()
    json(conn, %{ok: true, campaigns: Enum.map(campaigns, &campaign_json/1)})
  end

  def show(conn, %{"id" => id}) do
    case Campaigns.get_campaign(id) do
      nil ->
        case CampaignManager.status(id) do
          {:ok, flow} -> json(conn, %{ok: true, campaign: flow_json(flow)})
          {:error, :not_found} -> conn |> put_status(:not_found) |> json(%{error: "Not found"})
        end

      campaign ->
        json(conn, %{ok: true, campaign: campaign_json(campaign)})
    end
  end

  def create(conn, params) do
    attrs = %{
      name: params["name"] || "Unnamed Campaign",
      description: params["description"],
      steps: params["steps"] || [],
      status: params["status"] || "draft"
    }

    case Campaigns.create_campaign(attrs) do
      {:ok, campaign} ->
        conn |> put_status(:created) |> json(%{ok: true, campaign: campaign_json(campaign)})

      {:error, changeset} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: format_errors(changeset)})
    end
  end

  def update(conn, %{"id" => id} = params) do
    case Campaigns.get_campaign(id) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "Not found"})

      campaign ->
        attrs = Map.take(params, ["name", "description", "steps", "status"])

        case Campaigns.update_campaign(campaign, attrs) do
          {:ok, updated} ->
            json(conn, %{ok: true, campaign: campaign_json(updated)})

          {:error, changeset} ->
            conn |> put_status(:unprocessable_entity) |> json(%{error: format_errors(changeset)})
        end
    end
  end

  def delete(conn, %{"id" => id}) do
    case Campaigns.get_campaign(id) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "Not found"})

      campaign ->
        Campaigns.delete_campaign(campaign)
        conn |> put_status(:no_content) |> send_resp(204, "")
    end
  end

  # ---------------------------------------------------------------------------
  # Campaign Runs
  # ---------------------------------------------------------------------------

  def start_run(conn, %{"id" => campaign_id} = params) do
    run_name = params["name"]

    case Campaigns.start_run(campaign_id, run_name) do
      {:ok, run} ->
        conn |> put_status(:created) |> json(%{ok: true, run: run_json(run)})

      {:error, reason} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def list_runs(conn, %{"id" => campaign_id}) do
    runs = Campaigns.list_runs_for_campaign(campaign_id)
    json(conn, %{ok: true, runs: Enum.map(runs, &run_json/1)})
  end

  def show_run(conn, %{"id" => id}) do
    case Campaigns.get_run(id) do
      nil -> conn |> put_status(:not_found) |> json(%{error: "Not found"})
      run -> json(conn, %{ok: true, run: run_json(run)})
    end
  end

  # ---------------------------------------------------------------------------
  # Legacy flow system
  # ---------------------------------------------------------------------------

  def advance(conn, %{"id" => id, "status" => new_status}) do
    case Campaigns.transition_campaign_by_id(id, new_status) do
      {:ok, campaign} ->
        json(conn, %{ok: true, campaign: campaign_json(campaign)})

      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{error: "Not found"})

      {:error, reason} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: reason})
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

  # ---------------------------------------------------------------------------
  # Serializers
  # ---------------------------------------------------------------------------

  defp campaign_json(c) do
    %{
      id: c.id,
      name: c.name,
      description: c.description,
      steps: c.steps,
      status: c.status,
      run_count: c.run_count,
      inserted_at: c.inserted_at,
      updated_at: c.updated_at
    }
  end

  defp run_json(r) do
    duration =
      if r.started_at && r.completed_at do
        DateTime.diff(r.completed_at, r.started_at, :second)
      else
        nil
      end

    %{
      id: r.id,
      campaign_id: r.campaign_id,
      name: r.name,
      status: r.status,
      step_statuses: r.step_statuses,
      started_at: r.started_at,
      completed_at: r.completed_at,
      duration_seconds: duration,
      inserted_at: r.inserted_at
    }
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

  defp format_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Enum.reduce(opts, msg, fn {_key, value}, acc ->
        String.replace(acc, "%{\#{key}}", to_string(value))
      end)
    end)
  end
end
