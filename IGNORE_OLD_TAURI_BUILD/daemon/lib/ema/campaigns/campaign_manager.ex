defmodule Ema.Campaigns.CampaignManager do
  @moduledoc """
  GenServer managing active campaign flows. Supervises state transitions,
  links executions to campaigns, and broadcasts flow events.
  """

  use GenServer
  require Logger

  alias Ema.Campaigns

  @active_states ~w(forming developing testing)

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def start_campaign(name, attrs \\ %{}) do
    GenServer.call(__MODULE__, {:start, name, attrs})
  end

  def advance(campaign_id, metadata \\ %{}) do
    GenServer.call(__MODULE__, {:advance, campaign_id, metadata})
  end

  def link_execution(campaign_id, execution_type, execution_id) do
    GenServer.cast(__MODULE__, {:link, campaign_id, execution_type, execution_id})
  end

  def status(campaign_id) do
    GenServer.call(__MODULE__, {:status, campaign_id})
  end

  def list_active do
    GenServer.call(__MODULE__, :list_active)
  end

  @impl true
  def init(_opts) do
    Logger.info("[CampaignManager] started")

    flows =
      @active_states
      |> Enum.flat_map(&Campaigns.list_flows_by_state/1)
      |> Map.new(fn flow -> {flow.id, flow} end)

    {:ok, %{flows: flows, executions: %{}}}
  end

  @impl true
  def handle_call({:start, name, attrs}, _from, state) do
    flow_attrs = %{
      campaign_id: Map.get(attrs, "campaign_id", campaign_identifier(name)),
      title: name,
      state_metadata: normalize_metadata(Map.get(attrs, "metadata", %{}))
    }

    case Campaigns.create_flow(flow_attrs) do
      {:ok, flow} ->
        Phoenix.PubSub.broadcast(Ema.PubSub, "campaigns:events", {:campaign_started, flow})
        {:reply, {:ok, flow}, put_in(state, [:flows, flow.id], flow)}

      {:error, _changeset} = error ->
        {:reply, error, state}
    end
  end

  @impl true
  def handle_call({:advance, campaign_id, metadata}, _from, state) do
    with {:ok, flow} <- fetch_flow(campaign_id, state),
         next_state <- next_flow_state(flow.state),
         {:ok, updated} <- Campaigns.transition(flow, next_state, normalize_metadata(metadata)) do
      Phoenix.PubSub.broadcast(
        Ema.PubSub,
        "campaigns:events",
        {:campaign_advanced, updated, flow.state, next_state}
      )

      {:reply, {:ok, updated}, update_flow_state(state, updated)}
    else
      {:error, _reason} = error ->
        {:reply, error, state}
    end
  end

  @impl true
  def handle_call({:status, campaign_id}, _from, state) do
    case fetch_flow(campaign_id, state) do
      {:ok, flow} -> {:reply, {:ok, flow}, state}
      {:error, _reason} = error -> {:reply, error, state}
    end
  end

  @impl true
  def handle_call(:list_active, _from, state) do
    {:reply, Map.values(state.flows), state}
  end

  @impl true
  def handle_cast({:link, campaign_id, execution_type, execution_id}, state) do
    executions =
      Map.update(state.executions, campaign_id, [{execution_type, execution_id}], fn existing ->
        [{execution_type, execution_id} | existing]
      end)

    Logger.debug("[CampaignManager] linked #{execution_type}:#{execution_id} to #{campaign_id}")
    {:noreply, %{state | executions: executions}}
  end

  defp fetch_flow(campaign_id, state) do
    case Map.get(state.flows, campaign_id) || Campaigns.get_flow(campaign_id) do
      nil -> {:error, :not_found}
      flow -> {:ok, flow}
    end
  end

  defp update_flow_state(state, %{state: "done"} = flow) do
    %{state | flows: Map.delete(state.flows, flow.id)}
  end

  defp update_flow_state(state, flow) do
    put_in(state, [:flows, flow.id], flow)
  end

  defp next_flow_state("forming"), do: "developing"
  defp next_flow_state("developing"), do: "testing"
  defp next_flow_state("testing"), do: "done"
  defp next_flow_state("done"), do: "done"

  defp campaign_identifier(name) do
    suffix = System.unique_integer([:positive])

    name
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9]+/u, "-")
    |> String.trim("-")
    |> Kernel.<>("-#{suffix}")
  end

  defp normalize_metadata(metadata) when is_map(metadata), do: metadata
  defp normalize_metadata(_metadata), do: %{}
end
