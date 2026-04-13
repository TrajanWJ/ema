defmodule EmaWeb.MemoryChannel do
  use Phoenix.Channel

  alias Ema.Intelligence.SessionMemory

  @impl true
  def join("memory:live", _payload, socket) do
    sessions = SessionMemory.list_sessions(limit: 30)

    data = %{
      sessions: Enum.map(sessions, &serialize_session/1),
      stats: SessionMemory.session_stats()
    }

    {:ok, data, socket}
  end

  @impl true
  def join("memory:" <> _rest, _payload, socket) do
    {:ok, socket}
  end

  defp serialize_session(s) do
    %{
      id: s.id,
      session_id: s.session_id,
      project_path: s.project_path,
      status: s.status,
      token_count: s.token_count,
      summary: s.summary,
      last_active: s.last_active,
      created_at: s.inserted_at
    }
  end
end
