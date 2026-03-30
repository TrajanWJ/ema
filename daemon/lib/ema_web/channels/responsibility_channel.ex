defmodule EmaWeb.ResponsibilityChannel do
  use Phoenix.Channel

  alias Ema.Responsibilities

  @impl true
  def join("responsibilities:lobby", _payload, socket) do
    responsibilities =
      Responsibilities.list_responsibilities()
      |> Enum.map(&serialize/1)

    {:ok, %{responsibilities: responsibilities}, socket}
  end

  @impl true
  def join("responsibilities:" <> project_id, _payload, socket) do
    responsibilities =
      Responsibilities.list_responsibilities(project_id: project_id)
      |> Enum.map(&serialize/1)

    {:ok, %{responsibilities: responsibilities}, socket}
  end

  defp serialize(resp) do
    %{
      id: resp.id,
      title: resp.title,
      description: resp.description,
      role: resp.role,
      cadence: resp.cadence,
      health: resp.health,
      active: resp.active,
      last_checked_at: resp.last_checked_at,
      recurrence_rule: resp.recurrence_rule,
      metadata: resp.metadata,
      project_id: resp.project_id,
      created_at: resp.inserted_at,
      updated_at: resp.updated_at
    }
  end
end
