defmodule EmaWeb.DispatchBoardChannel do
  use Phoenix.Channel

  alias Phoenix.Socket.Broadcast
  alias Ema.{Campaigns, Executions, Projects, Tasks}

  @tasks_topic "tasks:lobby"
  @campaigns_events_topic "campaigns:events"
  @campaigns_updates_topic "campaigns:updates"
  @executions_topic "executions"

  @impl true
  def join("dispatch_board:lobby", payload, socket) do
    send(self(), :subscribe)

    project_id = payload["project_id"]

    {:ok,
     %{
       context: initial_context(project_id),
       tasks: Tasks.list_tasks() |> Enum.map(&serialize_task/1),
       campaigns: Campaigns.list_campaigns() |> Enum.map(&serialize_campaign/1),
       executions: Executions.list_executions(limit: 100) |> Enum.map(&serialize_execution/1)
     }, assign(socket, :project_id, project_id)}
  end

  @impl true
  def handle_info(:subscribe, socket) do
    Phoenix.PubSub.subscribe(Ema.PubSub, @tasks_topic)
    Phoenix.PubSub.subscribe(Ema.PubSub, @campaigns_events_topic)
    Phoenix.PubSub.subscribe(Ema.PubSub, @campaigns_updates_topic)
    Phoenix.PubSub.subscribe(Ema.PubSub, @executions_topic)
    {:noreply, socket}
  end

  def handle_info(%Broadcast{topic: @tasks_topic, event: event, payload: payload}, socket)
      when event in ["task_created", "task_updated"] do
    push(socket, "task_updated", payload)
    {:noreply, socket}
  end

  def handle_info(%Broadcast{topic: @tasks_topic, event: "task_deleted", payload: payload}, socket) do
    push(socket, "task_deleted", payload)
    {:noreply, socket}
  end

  def handle_info({:campaign_started, flow}, socket) do
    case Campaigns.get_campaign(flow.campaign_id) do
      nil -> {:noreply, socket}
      campaign ->
        push(socket, "campaign_updated", serialize_campaign(campaign))
        {:noreply, socket}
    end
  end

  def handle_info({:campaign_advanced, campaign, _from_state, _to_state}, socket) do
    push(socket, "campaign_updated", serialize_campaign(campaign))
    {:noreply, socket}
  end

  def handle_info({:campaign_status_changed, campaign_id, _old_status, _new_status}, socket) do
    case Campaigns.get_campaign(campaign_id) do
      nil -> {:noreply, socket}
      campaign ->
        push(socket, "campaign_updated", serialize_campaign(campaign))
        {:noreply, socket}
    end
  end

  def handle_info({"execution:created", %Ema.Executions.Execution{} = execution}, socket) do
    push(socket, "execution_updated", %{execution: serialize_execution(execution)})
    {:noreply, socket}
  end

  def handle_info({"execution:updated", %Ema.Executions.Execution{} = execution}, socket) do
    push(socket, "execution_updated", %{execution: serialize_execution(execution)})
    {:noreply, socket}
  end

  def handle_info({"execution:completed", %{execution: execution}}, socket) do
    push(socket, "execution_updated", %{execution: serialize_execution(execution)})
    {:noreply, socket}
  end

  def handle_info({"execution:completed", %{execution: execution, signal: _signal}}, socket) do
    push(socket, "execution_updated", %{execution: serialize_execution(execution)})
    {:noreply, socket}
  end

  def handle_info(_msg, socket), do: {:noreply, socket}

  defp initial_context(nil), do: nil
  defp initial_context(project_id), do: Projects.build_context(project_id)

  defp serialize_task(task) do
    %{
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      source_type: task.source_type,
      source_id: task.source_id,
      effort: task.effort,
      due_date: task.due_date,
      recurrence: task.recurrence,
      sort_order: task.sort_order,
      completed_at: task.completed_at,
      metadata: task.metadata,
      project_id: task.project_id,
      goal_id: task.goal_id,
      responsibility_id: task.responsibility_id,
      parent_id: task.parent_id,
      created_at: task.inserted_at,
      updated_at: task.updated_at
    }
  end

  defp serialize_campaign(campaign) do
    flow = Campaigns.get_flow_by_campaign(campaign.id)

    %{
      id: campaign.id,
      project_id: campaign.project_id,
      name: campaign.name,
      description: campaign.description,
      status: campaign.status,
      flow_state: if(flow, do: flow.state, else: nil),
      run_count: campaign.run_count,
      step_count: length(campaign.steps || []),
      inserted_at: campaign.inserted_at,
      updated_at: campaign.updated_at
    }
  end

  defp serialize_execution(execution) do
    %{
      id: execution.id,
      title: execution.title,
      objective: execution.objective,
      mode: execution.mode,
      status: execution.status,
      project_slug: execution.project_slug,
      intent_slug: execution.intent_slug,
      intent_path: execution.intent_path,
      result_path: execution.result_path,
      requires_approval: execution.requires_approval,
      brain_dump_item_id: execution.brain_dump_item_id,
      proposal_id: execution.proposal_id,
      completed_at: execution.completed_at,
      inserted_at: execution.inserted_at,
      updated_at: execution.updated_at
    }
  end
end
