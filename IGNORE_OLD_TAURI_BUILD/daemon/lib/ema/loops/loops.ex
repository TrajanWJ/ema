defmodule Ema.Loops do
  @moduledoc """
  Loops -- outbound actions waiting for a response with escalation.

  Each loop represents one open thread (DM, email, sent materials, etc.).
  The Escalator GenServer ages loops and bumps their `escalation_level`
  on a schedule. CLI / REST surface the open and at-risk lists so the
  human can close, touch, or force-close them.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Loops.Loop

  # ── List / Query ──

  def list_loops(opts \\ []) do
    Loop
    |> maybe_filter_status(opts[:status])
    |> maybe_filter_actor(opts[:actor_id])
    |> maybe_filter_project(opts[:project_id])
    |> maybe_filter_min_level(opts[:min_level])
    |> order_by([l], desc: l.escalation_level, asc: l.opened_on)
    |> Repo.all()
  end

  def list_open(opts \\ []) do
    list_loops(Keyword.put(opts, :status, "open"))
  end

  def list_at_risk do
    list_loops(status: "open", min_level: 1)
  end

  def get_loop(id), do: Repo.get(Loop, id)
  def get_loop!(id), do: Repo.get!(Loop, id)

  @doc "Find an existing open loop matching the same target + loop_type."
  def find_open_dup(loop_type, target) when is_binary(loop_type) and is_binary(target) do
    Loop
    |> where([l], l.status == "open" and l.loop_type == ^loop_type and l.target == ^target)
    |> limit(1)
    |> Repo.one()
  end

  def find_open_dup(_, _), do: nil

  # ── Create / Touch / Close ──

  @doc """
  Open a loop. If an open loop already exists for this `loop_type` + `target`,
  the existing loop is touched (touch_count incremented, follow_up_text updated)
  and returned instead of creating a duplicate.
  """
  def open_loop(attrs) do
    loop_type = attrs[:loop_type] || attrs["loop_type"]
    target = attrs[:target] || attrs["target"]

    case find_open_dup(loop_type, target) do
      %Loop{} = existing ->
        touch_loop(existing, follow_up_text: attrs[:follow_up_text] || attrs["follow_up_text"])

      nil ->
        do_create(attrs)
    end
  end

  defp do_create(attrs) do
    id = generate_id()
    today = Date.utc_today()

    full =
      attrs
      |> normalize_keys()
      |> Map.put(:id, id)
      |> Map.put_new(:opened_on, today)
      |> Map.put_new(:status, "open")
      |> Map.put_new(:touch_count, 1)
      |> Map.put_new(:escalation_level, 0)
      |> derive_channel()

    result =
      %Loop{}
      |> Loop.changeset(full)
      |> Repo.insert()

    with {:ok, loop} <- result do
      broadcast(:loop_opened, loop)
      {:ok, loop}
    end
  end

  @doc "Bump touch_count on an open loop. Resets ageing? No -- aging stays based on opened_on."
  def touch_loop(%Loop{} = loop, opts \\ []) do
    follow_up = Keyword.get(opts, :follow_up_text)

    attrs =
      %{touch_count: (loop.touch_count || 1) + 1}
      |> maybe_put(:follow_up_text, follow_up)

    with {:ok, updated} <- loop |> Loop.changeset(attrs) |> Repo.update() do
      broadcast(:loop_touched, updated)
      {:ok, updated}
    end
  end

  @doc "Close a loop with a status (closed | parked | killed) and a reason."
  def close_loop(%Loop{} = loop, opts) do
    status = Keyword.get(opts, :status, "closed")
    reason = Keyword.get(opts, :reason)
    closed_by = Keyword.get(opts, :closed_by, "human")

    attrs = %{
      status: status,
      closed_on: Date.utc_today(),
      closed_by: closed_by,
      closed_reason: reason
    }

    with {:ok, updated} <- loop |> Loop.changeset(attrs) |> Repo.update() do
      broadcast(:loop_closed, updated)
      {:ok, updated}
    end
  end

  def update_loop(%Loop{} = loop, attrs) do
    loop
    |> Loop.changeset(normalize_keys(attrs))
    |> Repo.update()
  end

  def delete_loop(%Loop{} = loop), do: Repo.delete(loop)

  # ── Escalation ──

  @doc """
  Recompute escalation_level for all open loops. Returns
  `{updated_count, by_level_map}` so callers can log a summary.
  """
  def escalate_all do
    open = list_open()
    today = Date.utc_today()

    {updated, counts} =
      Enum.reduce(open, {0, %{0 => 0, 1 => 0, 2 => 0, 3 => 0}}, fn loop, {n, acc} ->
        new_level = Loop.escalation_for_age(Loop.age_days(loop))

        n2 =
          if new_level > (loop.escalation_level || 0) do
            attrs = %{escalation_level: new_level, last_escalated: today}

            case loop |> Loop.changeset(attrs) |> Repo.update() do
              {:ok, updated} ->
                broadcast(:loop_escalated, updated)
                n + 1

              {:error, _} ->
                n
            end
          else
            n
          end

        {n2, Map.update(acc, new_level, 1, &(&1 + 1))}
      end)

    {updated, counts}
  end

  # ── Stats ──

  def stats do
    open = list_open()
    today = Date.utc_today()

    closed_today_count =
      Loop
      |> where([l], l.closed_on == ^today and l.status != "open")
      |> Repo.aggregate(:count, :id)

    counts = Enum.frequencies_by(open, &(&1.escalation_level || 0))
    oldest = open |> Enum.map(&Loop.age_days/1) |> Enum.max(fn -> 0 end)

    %{
      open: length(open),
      closed_today: closed_today_count,
      by_level: Map.merge(%{0 => 0, 1 => 0, 2 => 0, 3 => 0}, counts),
      oldest_age_days: oldest
    }
  end

  # ── Private helpers ──

  defp maybe_filter_status(query, nil), do: query
  defp maybe_filter_status(query, status), do: where(query, [l], l.status == ^status)

  defp maybe_filter_actor(query, nil), do: query
  defp maybe_filter_actor(query, actor_id), do: where(query, [l], l.actor_id == ^actor_id)

  defp maybe_filter_project(query, nil), do: query
  defp maybe_filter_project(query, project_id), do: where(query, [l], l.project_id == ^project_id)

  defp maybe_filter_min_level(query, nil), do: query

  defp maybe_filter_min_level(query, level) when is_integer(level) do
    where(query, [l], l.escalation_level >= ^level)
  end

  defp maybe_filter_min_level(query, level) when is_binary(level) do
    case Integer.parse(level) do
      {n, _} -> maybe_filter_min_level(query, n)
      :error -> query
    end
  end

  defp maybe_put(map, _key, nil), do: map
  defp maybe_put(map, key, value), do: Map.put(map, key, value)

  defp normalize_keys(attrs) when is_map(attrs) do
    Enum.reduce(attrs, %{}, fn
      {k, v}, acc when is_atom(k) -> Map.put(acc, k, v)
      {k, v}, acc when is_binary(k) -> Map.put(acc, String.to_atom(k), v)
    end)
  end

  defp derive_channel(%{channel: c} = attrs) when is_binary(c) and c != "", do: attrs

  defp derive_channel(%{loop_type: type} = attrs) when is_binary(type) do
    Map.put(attrs, :channel, infer_channel(type))
  end

  defp derive_channel(attrs), do: attrs

  defp infer_channel("email_sent"), do: "email"
  defp infer_channel("dm_sent"), do: "dm"
  defp infer_channel("materials_sent"), do: "email"
  defp infer_channel("connection_request_sent"), do: "social"
  defp infer_channel("comment_posted"), do: "social"
  defp infer_channel("debrief_next_step"), do: "in-person"
  defp infer_channel("dp_offer_sent"), do: "email"
  defp infer_channel("lead_sourced"), do: "internal"
  defp infer_channel(other), do: other |> String.replace_suffix("_sent", "") |> String.replace("_", "-")

  defp generate_id do
    today = Date.utc_today() |> Date.to_iso8601()
    rand = :crypto.strong_rand_bytes(3) |> Base.encode16(case: :lower)
    "loop_#{today}_#{rand}"
  end

  defp broadcast(event, %Loop{} = loop) do
    Phoenix.PubSub.broadcast(Ema.PubSub, "loops:lobby", {event, loop})
  end
end
