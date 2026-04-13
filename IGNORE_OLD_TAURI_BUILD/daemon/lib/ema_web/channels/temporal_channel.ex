defmodule EmaWeb.TemporalChannel do
  use Phoenix.Channel

  alias Ema.Temporal

  @impl true
  def join("temporal:dashboard", _payload, socket) do
    rhythms =
      Temporal.list_rhythms()
      |> Enum.map(fn r ->
        %{
          id: r.id,
          day_of_week: r.day_of_week,
          hour: r.hour,
          energy_level: r.energy_level,
          focus_quality: r.focus_quality,
          preferred_task_types: r.preferred_task_types,
          sample_count: r.sample_count,
          updated_at: r.updated_at
        }
      end)

    context = Temporal.current_context()

    recent_logs =
      Temporal.recent_logs(20)
      |> Enum.map(fn l ->
        %{
          id: l.id,
          energy_level: l.energy_level,
          focus_quality: l.focus_quality,
          activity_type: l.activity_type,
          source: l.source,
          logged_at: l.logged_at
        }
      end)

    {:ok,
     %{
       rhythms: rhythms,
       context: %{
         time_of_day: context.time_of_day,
         day_of_week: context.day_of_week,
         hour: context.hour,
         estimated_energy: context.estimated_energy,
         estimated_focus: context.estimated_focus,
         preferred_task_types: context.preferred_task_types,
         suggested_mode: context.suggested_mode,
         confidence: context.confidence
       },
       recent_logs: recent_logs
     }, socket}
  end
end
