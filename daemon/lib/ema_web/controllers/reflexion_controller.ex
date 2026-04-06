defmodule EmaWeb.ReflexionController do
  use EmaWeb, :controller

  alias Ema.Intelligence.ReflexionStore

  action_fallback(EmaWeb.FallbackController)

  def index(conn, params) do
    opts =
      []
      |> maybe_add(:agent, params["agent"])
      |> maybe_add(:domain, params["domain"])
      |> maybe_add(:project_slug, params["project_slug"])
      |> maybe_add(:limit, parse_int(params["limit"]))

    entries =
      ReflexionStore.list_recent(opts)
      |> Enum.map(&serialize/1)

    json(conn, %{entries: entries})
  end

  def create(conn, params) do
    attrs = %{
      agent: params["agent"],
      domain: params["domain"],
      project_slug: params["project_slug"],
      lesson: params["lesson"],
      outcome_status: params["outcome_status"] || params["status"]
    }

    with {:ok, entry} <- ReflexionStore.create_entry(attrs) do
      conn
      |> put_status(:created)
      |> json(%{entry: serialize(entry)})
    end
  end

  defp serialize(entry) do
    %{
      id: entry.id,
      agent: entry.agent,
      domain: entry.domain,
      project_slug: entry.project_slug,
      lesson: entry.lesson,
      outcome_status: entry.outcome_status,
      inserted_at: entry.inserted_at
    }
  end

  defp maybe_add(opts, _key, nil), do: opts
  defp maybe_add(opts, _key, ""), do: opts
  defp maybe_add(opts, key, value), do: Keyword.put(opts, key, value)

  defp parse_int(nil), do: nil
  defp parse_int(value) when is_integer(value), do: value

  defp parse_int(value) when is_binary(value) do
    case Integer.parse(value) do
      {parsed, _} -> parsed
      :error -> nil
    end
  end
end
