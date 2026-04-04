defmodule Ema.Campaigns do
  @moduledoc """
  Context module for campaign lifecycle management.
  Provides CRUD + state-machine transitions for Campaign.Flow.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Campaigns.Flow

  # ---------------------------------------------------------------------------
  # CRUD
  # ---------------------------------------------------------------------------

  def list_flows do
    Flow |> order_by(desc: :inserted_at) |> Repo.all()
  end

  def list_flows_by_state(state) do
    Flow
    |> where([f], f.state == ^state)
    |> order_by(desc: :inserted_at)
    |> Repo.all()
  end

  def get_flow(id), do: Repo.get(Flow, id)
  def get_flow!(id), do: Repo.get!(Flow, id)

  def get_flow_by_campaign(campaign_id) do
    Repo.get_by(Flow, campaign_id: campaign_id)
  end

  @doc """
  Creates a new campaign flow, always starting in the `forming` state.
  Required attrs: campaign_id. Optional: title, state_metadata.
  """
  def create_flow(attrs) do
    %Flow{}
    |> Flow.creation_changeset(attrs)
    |> Repo.insert()
  end

  def update_flow(%Flow{} = flow, attrs) do
    flow
    |> Flow.changeset(attrs)
    |> Repo.update()
  end

  def delete_flow(%Flow{} = flow) do
    Repo.delete(flow)
  end

  # ---------------------------------------------------------------------------
  # State machine
  # ---------------------------------------------------------------------------

  @doc """
  Transitions a flow to `new_state`. Returns {:ok, flow} or {:error, changeset}.
  Metadata is recorded alongside the transition in state_history.
  """
  def transition(%Flow{} = flow, new_state, metadata \\ %{}) do
    flow
    |> Flow.transition_changeset(new_state, metadata)
    |> Repo.update()
  end

  @doc """
  Convenience: looks up by id and transitions.
  Returns {:error, :not_found} if the flow doesn't exist.
  """
  def transition_by_id(id, new_state, metadata \\ %{}) do
    case get_flow(id) do
      nil  -> {:error, :not_found}
      flow -> transition(flow, new_state, metadata)
    end
  end

  @doc "Returns the full state history for a flow."
  def history(%Flow{} = flow), do: flow.state_history

  @doc "Returns the human-readable summary of how long the flow spent in each state."
  def state_durations(%Flow{} = flow) do
    flow.state_history
    |> Enum.map(fn entry ->
      entered = parse_dt(entry["entered_at"])
      exited  = if entry["exited_at"], do: parse_dt(entry["exited_at"]), else: DateTime.utc_now()

      diff_sec = DateTime.diff(exited, entered, :second)

      %{
        state:      entry["state"],
        entered_at: entered,
        exited_at:  if(entry["exited_at"], do: exited, else: nil),
        duration_s: diff_sec
      }
    end)
  end

  # ---------------------------------------------------------------------------
  # Private
  # ---------------------------------------------------------------------------

  defp parse_dt(iso_string) do
    {:ok, dt, _} = DateTime.from_iso8601(iso_string)
    dt
  end

  # ---------------------------------------------------------------------------
  # Campaign Templates (new system — separate from Flow state machine)
  # ---------------------------------------------------------------------------

  alias Ema.Campaigns.Campaign
  alias Ema.Campaigns.CampaignRun

  def list_campaigns do
    Campaign
    |> order_by(desc: :inserted_at)
    |> Repo.all()
  end

  def get_campaign(id), do: Repo.get(Campaign, id)
  def get_campaign!(id), do: Repo.get!(Campaign, id)

  def create_campaign(attrs) do
    %Campaign{}
    |> Campaign.changeset(attrs)
    |> Repo.insert()
  end

  def update_campaign(%Campaign{} = campaign, attrs) do
    campaign
    |> Campaign.changeset(attrs)
    |> Repo.update()
  end

  def delete_campaign(%Campaign{} = campaign) do
    Repo.delete(campaign)
  end

  # ---------------------------------------------------------------------------
  # Campaign status transitions
  # ---------------------------------------------------------------------------

  @doc """
  Transitions the campaign's status field and broadcasts the update.
  Uses Campaign.Flow.valid_transition?/2 to validate the transition.
  """
  def transition_campaign(%Campaign{} = campaign, new_status) do
    current = campaign.status

    if Flow.valid_transition?(current, new_status) do
      with {:ok, updated} <- update_campaign(campaign, %{status: new_status}) do
        Phoenix.PubSub.broadcast(
          Ema.PubSub,
          "campaigns:updates",
          {:campaign_status_changed, updated.id, current, new_status}
        )

        {:ok, updated}
      end
    else
      {:error, "invalid transition from #{current} to #{new_status}"}
    end
  end

  def transition_campaign_by_id(id, new_status) do
    case get_campaign(id) do
      nil -> {:error, :not_found}
      campaign -> transition_campaign(campaign, new_status)
    end
  end

  # ---------------------------------------------------------------------------
  # Campaign Runs
  # ---------------------------------------------------------------------------

  def list_runs_for_campaign(campaign_id) do
    CampaignRun
    |> where([r], r.campaign_id == ^campaign_id)
    |> order_by(desc: :inserted_at)
    |> Repo.all()
  end

  def get_run(id), do: Repo.get(CampaignRun, id)
  def get_run!(id), do: Repo.get!(CampaignRun, id)

  def start_run(campaign_id, run_name \\ nil) do
    campaign = get_campaign!(campaign_id)

    run_number = campaign.run_count + 1
    name = run_name || "#{campaign.name} run ##{run_number}"

    step_statuses =
      campaign.steps
      |> Enum.map(fn step -> {step["id"], %{"status" => "pending", "result" => nil}} end)
      |> Map.new()

    now = DateTime.utc_now() |> DateTime.truncate(:second)

    with {:ok, run} <-
           Repo.insert(
             CampaignRun.changeset(%CampaignRun{}, %{
               campaign_id: campaign_id,
               name: name,
               status: "running",
               step_statuses: step_statuses,
               started_at: now
             })
           ),
         {:ok, _campaign} <- update_campaign(campaign, %{run_count: run_number}) do
      initial_steps =
        Enum.filter(campaign.steps, fn step ->
          deps = step["dependencies"] || []
          deps == []
        end)

      Enum.each(initial_steps, &dispatch_step(&1, run, campaign))

      Phoenix.PubSub.broadcast(Ema.PubSub, "campaigns:runs", {:run_started, run})
      {:ok, run}
    end
  end

  def step_completed(run_id, step_id, result) do
    run = get_run!(run_id)
    campaign = get_campaign!(run.campaign_id)

    updated_statuses =
      Map.update(run.step_statuses, step_id, %{}, fn s ->
        Map.merge(s, %{"status" => "completed", "result" => result})
      end)

    {:ok, run} =
      run
      |> CampaignRun.changeset(%{step_statuses: updated_statuses})
      |> Repo.update()

    next_steps = find_ready_steps(campaign.steps, step_id, updated_statuses)
    Enum.each(next_steps, &dispatch_step(&1, run, campaign))

    if all_steps_done?(updated_statuses) do
      complete_run(run)
    else
      {:ok, run}
    end
  end

  defp dispatch_step(step, run, _campaign) do
    updated_statuses =
      Map.update(run.step_statuses, step["id"], %{}, fn s ->
        Map.put(s, "status", "running")
      end)

    {:ok, updated_run} =
      run
      |> CampaignRun.changeset(%{step_statuses: updated_statuses})
      |> Repo.update()

    Phoenix.PubSub.broadcast(
      Ema.PubSub,
      "campaigns:runs",
      {:step_started, updated_run, step["id"]}
    )

    Task.start(fn ->
      Process.sleep(1_000)
      step_completed(run.id, step["id"], "Step '#{step["label"]}' completed (mock)")
    end)
  end

  defp find_ready_steps(steps, completed_step_id, updated_statuses) do
    Enum.filter(steps, fn step ->
      deps = step["dependencies"] || []
      has_dep = Enum.member?(deps, completed_step_id)

      if has_dep do
        all_deps_done =
          Enum.all?(deps, fn dep_id ->
            get_in(updated_statuses, [dep_id, "status"]) == "completed"
          end)

        step_not_started = get_in(updated_statuses, [step["id"], "status"]) == "pending"
        all_deps_done && step_not_started
      else
        false
      end
    end)
  end

  defp all_steps_done?(step_statuses) do
    Enum.all?(step_statuses, fn {_id, s} ->
      s["status"] in ["completed", "failed"]
    end)
  end

  defp complete_run(run) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    result =
      run
      |> CampaignRun.changeset(%{status: "completed", completed_at: now})
      |> Repo.update()

    case result do
      {:ok, r} ->
        Phoenix.PubSub.broadcast(Ema.PubSub, "campaigns:runs", {:run_completed, r})
        {:ok, r}

      error ->
        error
    end
  end
end
