defmodule Ema.Intelligence.SessionMemoryWatcher do
  @moduledoc """
  GenServer that periodically scans for new/updated Claude sessions
  and extracts memory fragments from them.
  """

  use GenServer
  require Logger
  import Ecto.Query

  @poll_interval :timer.seconds(60)

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, %{}, name: __MODULE__)
  end

  @impl true
  def init(state) do
    schedule_poll()
    {:ok, Map.put(state, :last_scan, nil)}
  end

  @impl true
  def handle_info(:poll, state) do
    state = scan_new_sessions(state)
    schedule_poll()
    {:noreply, state}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  defp scan_new_sessions(state) do
    now = DateTime.utc_now()

    sessions =
      case state[:last_scan] do
        nil ->
          Ema.Intelligence.SessionMemory.list_sessions(limit: 50)

        since ->
          Ema.ClaudeSessions.ClaudeSession
          |> where([s], s.updated_at > ^since)
          |> order_by(desc: :last_active)
          |> limit(50)
          |> Ema.Repo.all()
      end

    for session <- sessions do
      existing =
        Ema.Intelligence.MemoryFragment
        |> where([f], f.session_id == ^session.id)
        |> Ema.Repo.aggregate(:count)

      if existing == 0 do
        case Ema.Intelligence.SessionMemory.extract_fragments_for_session(session.id) do
          {:ok, fragments} ->
            if length(fragments) > 0 do
              Logger.debug("Extracted #{length(fragments)} fragments from session #{session.id}")

              EmaWeb.Endpoint.broadcast("memory:live", "fragments_extracted", %{
                session_id: session.id,
                count: length(fragments)
              })
            end

          {:error, reason} ->
            Logger.warning("Failed to extract fragments from session #{session.id}: #{inspect(reason)}")
        end
      end
    end

    %{state | last_scan: now}
  end

  defp schedule_poll do
    Process.send_after(self(), :poll, @poll_interval)
  end
end
