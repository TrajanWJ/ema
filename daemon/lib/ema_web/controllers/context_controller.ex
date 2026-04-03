defmodule EmaWeb.ContextController do
  @moduledoc """
  API controller for DCC session context operations.
  """

  use EmaWeb, :controller
  action_fallback EmaWeb.FallbackController

  alias Ema.{BrainDump, Habits, Journal}
  alias Ema.Persistence.SessionStore
  alias Ema.Core.DccPrimitive

  # Original executive summary endpoint
  def executive_summary(conn, _params) do
    today = Date.utc_today() |> Date.to_iso8601()

    {:ok, entry} = Journal.get_or_create_entry(today)

    habits = Habits.list_active()
    today_logs = Habits.logs_for_date(today)
    completed_count = Enum.count(today_logs, & &1.completed)

    inbox_count = BrainDump.unprocessed_count()

    recent_captures =
      BrainDump.list_unprocessed()
      |> Enum.take(5)
      |> Enum.map(fn item -> %{content: item.content, source: item.source} end)

    content_snippet =
      if entry.content && String.length(entry.content) > 200 do
        String.slice(entry.content, 0, 200) <> "..."
      else
        entry.content
      end

    json(conn, %{
      date: today,
      one_thing: entry.one_thing,
      mood: entry.mood,
      energy: %{
        physical: entry.energy_p,
        mental: entry.energy_m,
        emotional: entry.energy_e
      },
      habits: %{
        completed: completed_count,
        total: length(habits)
      },
      inbox_count: inbox_count,
      recent_captures: recent_captures,
      journal_snippet: content_snippet
    })
  end

  @doc "GET /api/context — current session DCC"
  def index(conn, _params) do
    case SessionStore.current_session() do
      nil ->
        json(conn, %{session: nil})

      dcc ->
        json(conn, %{session: serialize_dcc(dcc)})
    end
  end

  @doc "GET /api/context/sessions — recent sessions"
  def sessions(conn, params) do
    limit = parse_int(params["limit"], 10)
    sessions = SessionStore.list_recent(limit)
    json(conn, %{sessions: Enum.map(sessions, &serialize_dcc/1)})
  end

  @doc "POST /api/context/crystallize — crystallize current session"
  def crystallize(conn, _params) do
    case SessionStore.current_session() do
      nil ->
        # Create a new session and crystallize it
        dcc = DccPrimitive.new()
        SessionStore.store(dcc.session_id, dcc)
        SessionStore.set_current(dcc.session_id)

        case SessionStore.crystallize(dcc.session_id) do
          {:ok, crystallized} ->
            json(conn, %{session: serialize_dcc(crystallized)})

          {:error, reason} ->
            conn |> put_status(422) |> json(%{error: to_string(reason)})
        end

      dcc ->
        case SessionStore.crystallize(dcc.session_id) do
          {:ok, crystallized} ->
            json(conn, %{session: serialize_dcc(crystallized)})

          {:error, reason} ->
            conn |> put_status(422) |> json(%{error: to_string(reason)})
        end
    end
  end

  defp serialize_dcc(%DccPrimitive{} = dcc) do
    DccPrimitive.to_map(dcc)
  end

  defp parse_int(nil, default), do: default
  defp parse_int(val, default) when is_binary(val) do
    case Integer.parse(val) do
      {n, _} -> n
      :error -> default
    end
  end
  defp parse_int(val, _default) when is_integer(val), do: val
end
