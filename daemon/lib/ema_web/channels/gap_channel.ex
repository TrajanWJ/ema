defmodule EmaWeb.GapChannel do
  use Phoenix.Channel

  alias Ema.Intelligence.GapInbox

  @impl true
  def join("gaps:live", _payload, socket) do
    gaps = GapInbox.list_gaps() |> Enum.map(&serialize/1)
    counts = GapInbox.gap_counts()
    {:ok, %{gaps: gaps, counts: counts}, socket}
  end

  @impl true
  def join("gaps:" <> _rest, _payload, socket) do
    {:ok, socket}
  end

  defp serialize(gap) do
    %{
      id: gap.id,
      source: gap.source,
      gap_type: gap.gap_type,
      title: gap.title,
      description: gap.description,
      severity: gap.severity,
      project_id: gap.project_id,
      file_path: gap.file_path,
      line_number: gap.line_number,
      status: gap.status,
      created_at: gap.inserted_at
    }
  end
end
