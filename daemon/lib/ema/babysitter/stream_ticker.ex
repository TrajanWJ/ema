defmodule Ema.Babysitter.StreamTicker do
  @moduledoc """
  Stream-of-consciousness ticker for the #babysitter-live Discord channel.

  Every tick it actively polls the DB, recent PubSub events, git state,
  and running processes to synthesize a rich, narrative-style status post.

  Not a log dump — a living picture of what the system is actually doing.
  """

  use GenServer
  require Logger
  import Ecto.Query
  alias Ema.Babysitter.{ChannelTopology, TickPolicy}
  alias Ema.Babysitter.AnomalyScorer

  @default_interval_ms 15_000
  @setting_key "babysitter.tick_interval_ms"

  @tick_count_key :babysitter_tick_count

  # --- Public API ---

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def tick_now, do: GenServer.cast(__MODULE__, :tick_now)

  def set_interval(ms) when is_integer(ms) and ms > 0 do
    GenServer.call(__MODULE__, {:set_interval, ms})
  end

  def config, do: GenServer.call(__MODULE__, :config)

  # --- GenServer ---

  @impl true
  def init(_opts) do
    runtime = TickPolicy.runtime(:live) |> maybe_apply_legacy_interval()
    interval = runtime.current_ms
    tick_count = :persistent_term.get(@tick_count_key, 0)
    timer = schedule_tick(interval)
    now = DateTime.utc_now()

    state = %{
      interval_ms: interval,
      timer: timer,
      started_at: now,
      last_tick_at: now,
      tick_count: tick_count,
      last_git_sha: nil,
      last_delivery: nil,
      runtime: runtime
    }

    {:ok, state}
  end

  @impl true
  def handle_call({:set_interval, ms}, _from, state) do
    Ema.Settings.set(@setting_key, to_string(ms))
    TickPolicy.configure_stream(:live, %{mode: :manual, manual_ms: ms})
    if state.timer, do: Process.cancel_timer(state.timer)
    runtime = TickPolicy.refresh_runtime(state.runtime)
    timer = schedule_tick(runtime.current_ms)
    {:reply, :ok, %{state | interval_ms: runtime.current_ms, timer: timer, runtime: runtime}}
  end

  def handle_call(:config, _from, state) do
    {:reply,
     %{
       interval_ms: state.interval_ms,
       last_tick_at: state.last_tick_at,
       tick_count: state.tick_count,
       runtime: TickPolicy.describe(state.runtime),
       stream: ChannelTopology.live_stream()
     }, state}
  end

  @impl true
  def handle_cast(:tick_now, state) do
    new_state = do_tick(state)
    if state.timer, do: Process.cancel_timer(state.timer)
    timer = schedule_tick(new_state.runtime.current_ms)
    {:noreply, %{new_state | timer: timer}}
  end

  @impl true
  def handle_info(:tick, state) do
    new_state = do_tick(state)
    timer = schedule_tick(new_state.runtime.current_ms)
    {:noreply, %{new_state | timer: timer}}
  end

  # --- Core tick ---

  defp do_tick(state) do
    now = DateTime.utc_now()
    tick_n = state.tick_count + 1
    :persistent_term.put(@tick_count_key, tick_n)

    snapshot = gather_snapshot(state)
    runtime = TickPolicy.advance(state.runtime, tick_signals(snapshot))

    delivery =
      snapshot
      |> build_delivery(tick_n, state.started_at, now, runtime.current_ms)
      |> maybe_post_delivery(state.last_delivery)

    session_snap =
      safe(fn -> Ema.Babysitter.SessionObserver.snapshot() end, %{
        sessions: [],
        stalled: [],
        just_completed: []
      })

    safe(fn -> AnomalyScorer.score_and_dispatch(snapshot.recent_events || [], session_snap) end)

    %{
      state
      | last_tick_at: now,
        tick_count: tick_n,
        last_git_sha: snapshot.git_sha,
        last_delivery: delivery,
        interval_ms: runtime.current_ms,
        runtime: runtime
    }
  end

  # --- Data gathering ---

  defp gather_snapshot(state) do
    # Run all queries, tolerate any individual failure
    %{
      tasks: safe(fn -> query_tasks() end),
      proposals: safe(fn -> query_proposals() end),
      sessions: safe(fn -> query_sessions() end),
      projects: safe(fn -> query_projects() end),
      recent_events:
        safe(fn -> Ema.Babysitter.VisibilityHub.drain_since(state.last_tick_at) end, []),
      session_snapshot:
        safe(
          fn -> Ema.Babysitter.SessionObserver.snapshot() end,
          %{sessions: [], stalled: [], just_completed: []}
        ),
      heartbeat: safe(fn -> Ema.Intelligence.VmMonitor.heartbeat_snapshot() end),
      git_sha: safe(fn -> git_head_sha() end),
      git_recent: safe(fn -> git_recent_commits(3) end, []),
      memory_mb: safe(fn -> process_memory_mb() end),
      uptime_s: safe(fn -> uptime_seconds() end)
    }
  end

  defp query_tasks do
    now = DateTime.utc_now()
    one_hour_ago = DateTime.add(now, -3600, :second)

    total = Ema.Repo.aggregate(Ema.Tasks.Task, :count)

    by_status =
      Ema.Repo.all(
        from t in Ema.Tasks.Task,
          group_by: t.status,
          select: {t.status, count(t.id)}
      )
      |> Map.new()

    recent =
      Ema.Repo.all(
        from t in Ema.Tasks.Task,
          where: t.inserted_at >= ^one_hour_ago,
          order_by: [desc: t.inserted_at],
          limit: 5,
          select: {t.title, t.status, t.inserted_at}
      )

    %{total: total, by_status: by_status, recent: recent}
  end

  defp query_proposals do
    now = DateTime.utc_now()
    one_hour_ago = DateTime.add(now, -3600, :second)

    total = Ema.Repo.aggregate(Ema.Proposals.Proposal, :count)

    by_stage =
      Ema.Repo.all(
        from p in Ema.Proposals.Proposal,
          group_by: p.pipeline_stage,
          select: {p.pipeline_stage, count(p.id)}
      )
      |> Map.new()

    recent =
      Ema.Repo.all(
        from p in Ema.Proposals.Proposal,
          where: p.inserted_at >= ^one_hour_ago,
          order_by: [desc: p.inserted_at],
          limit: 3,
          select: {p.title, p.pipeline_stage, p.status}
      )

    %{total: total, by_stage: by_stage, recent: recent}
  end

  defp query_sessions do
    active =
      Ema.Repo.all(
        from s in Ema.ClaudeSessions.ClaudeSession,
          where: s.status == "active",
          order_by: [desc: s.last_active],
          limit: 5,
          select: {s.session_id, s.project_path, s.last_active, s.token_count, s.tool_calls}
      )

    total = Ema.Repo.aggregate(Ema.ClaudeSessions.ClaudeSession, :count)

    active_count =
      Ema.Repo.aggregate(
        from(s in Ema.ClaudeSessions.ClaudeSession, where: s.status == "active"),
        :count
      )

    %{total: total, active_count: active_count, active: active}
  end

  defp query_projects do
    total = Ema.Repo.aggregate(Ema.Projects.Project, :count)

    by_status =
      Ema.Repo.all(
        from p in Ema.Projects.Project,
          group_by: p.status,
          select: {p.status, count(p.id)}
      )
      |> Map.new()

    active =
      Ema.Repo.all(
        from p in Ema.Projects.Project,
          where: p.status in ["active", "incubating"],
          order_by: [desc: p.updated_at],
          limit: 5,
          select: {p.name, p.status}
      )

    %{total: total, by_status: by_status, active: active}
  end

  defp git_head_sha do
    case System.cmd("git", ["-C", ema_repo_path(), "rev-parse", "--short", "HEAD"],
           stderr_to_stdout: false
         ) do
      {sha, 0} -> String.trim(sha)
      _ -> nil
    end
  end

  defp git_recent_commits(n) do
    case System.cmd("git", ["-C", ema_repo_path(), "log", "--oneline", "-#{n}"],
           stderr_to_stdout: false
         ) do
      {out, 0} ->
        out |> String.trim() |> String.split("\n") |> Enum.map(&String.trim/1)

      _ ->
        []
    end
  end

  defp process_memory_mb do
    {:memory, _bytes} = :erlang.process_info(self(), :memory)
    system_mem = :erlang.memory(:total)
    Float.round(system_mem / 1_048_576, 1)
  end

  defp uptime_seconds do
    {uptime_ms, _} = :erlang.statistics(:wall_clock)
    div(uptime_ms, 1000)
  end

  defp ema_repo_path do
    Application.get_env(:ema, :repo_path, "/home/trajan/Projects/ema")
  end

  # --- Rendering ---

  @doc false
  def build_delivery(snap, tick_n, started_at, now, interval_ms) do
    degraded_summary? = repeated_degraded_summary?(snap)

    %{
      message: render(snap, tick_n, started_at, now, interval_ms),
      signature: delivery_signature(snap),
      degraded_summary?: degraded_summary?,
      reason:
        cond do
          degraded_summary? -> "host heartbeat degraded summary changed"
          has_recent_activity?(snap) -> "recent activity changed"
          true -> "state changed"
        end
    }
  end

  @doc false
  def delivery_decision(nil, %{reason: reason}), do: {:post, reason}

  def delivery_decision(last_delivery, %{signature: signature, degraded_summary?: true})
      when is_map(last_delivery) and last_delivery.signature == signature do
    {:skip, "repeated degraded summary"}
  end

  def delivery_decision(last_delivery, %{signature: signature})
      when is_map(last_delivery) and last_delivery.signature == signature do
    {:skip, "no state change"}
  end

  def delivery_decision(_last_delivery, %{reason: reason}), do: {:post, reason}

  defp render(snap, tick_n, started_at, now, interval_ms) do
    time_str = Calendar.strftime(now, "%H:%M:%S UTC")
    uptime_str = format_uptime(snap.uptime_s)
    interval_str = format_interval(interval_ms)

    lines = []

    # Header
    lines =
      lines ++
        ["⚡ **tick ##{tick_n}** · #{time_str} · uptime #{uptime_str} · every #{interval_str}"]

    # Host heartbeat
    host_section = render_host_heartbeat(snap.heartbeat)
    lines = if host_section, do: lines ++ [host_section], else: lines

    # Git state
    lines = lines ++ [render_git(snap)]

    # Live sessions
    lines = lines ++ [render_sessions(snap.sessions)]

    # Tasks
    lines = lines ++ [render_tasks(snap.tasks)]

    # Proposals
    lines = lines ++ [render_proposals(snap.proposals)]

    # Projects
    lines = lines ++ [render_projects(snap.projects)]

    # Recent PubSub events (since last tick)
    events_section = render_events(snap.recent_events)
    lines = if events_section, do: lines ++ [events_section], else: lines

    # Operator next step
    next_section = render_operator_focus(snap)
    lines = if next_section, do: lines ++ [next_section], else: lines

    # Memory
    mem_str = if snap.memory_mb, do: "#{snap.memory_mb} MB BEAM", else: "?"

    lines =
      lines ++
        [
          "-# 🔧 #{mem_str} · started #{Calendar.strftime(started_at, "%H:%M UTC")} · EMA host babysitter live"
        ]

    Enum.join(lines, "\n")
  end

  defp render_git(%{git_sha: nil, git_recent: []}), do: "📦 **git** — unavailable"

  defp render_git(%{git_sha: sha, git_recent: commits}) do
    sha_str = if sha, do: "`#{sha}`", else: "?"

    commits_str =
      commits
      |> Enum.map(fn c ->
        [_sha | rest] = String.split(c, " ", parts: 2)
        "  └ #{List.first(rest) || c}"
      end)
      |> Enum.join("\n")

    "📦 **git** HEAD #{sha_str}\n#{commits_str}"
  end

  defp render_sessions(nil), do: "🤖 **Claude sessions** — unavailable"

  defp render_sessions(%{active_count: 0, total: total}) do
    "🤖 **Claude sessions** — #{total} total, none active"
  end

  defp render_sessions(%{active_count: n, total: total, active: sessions}) do
    session_lines =
      sessions
      |> Enum.map(fn {_id, path, last_active, tokens, tools} ->
        proj = path |> String.split("/") |> List.last() |> truncate(30)
        ago = seconds_ago(last_active)
        tok_str = if tokens, do: " #{format_tokens(tokens)} tok", else: ""
        tool_str = if tools && tools > 0, do: " #{tools} calls", else: ""
        "  └ `#{proj}`#{tok_str}#{tool_str} · #{ago}"
      end)
      |> Enum.join("\n")

    "🤖 **Claude sessions** — #{n} active / #{total} total\n#{session_lines}"
  end

  defp render_tasks(nil), do: "📋 **tasks** — unavailable"
  defp render_tasks(%{total: 0}), do: "📋 **tasks** — empty"

  defp render_tasks(%{total: total, by_status: by_status, recent: recent}) do
    status_str =
      by_status
      |> Enum.sort_by(fn {_s, n} -> -n end)
      |> Enum.map(fn {s, n} -> "#{status_emoji(s)} #{n} #{s}" end)
      |> Enum.join(" · ")

    recent_str =
      recent
      |> Enum.map(fn {title, status, _at} ->
        "  └ #{status_emoji(status)} #{truncate(title, 45)}"
      end)
      |> Enum.join("\n")

    "📋 **tasks** — #{total} total · #{status_str}\n#{recent_str}"
  end

  defp render_proposals(nil), do: "💡 **proposals** — unavailable"
  defp render_proposals(%{total: 0}), do: "💡 **proposals** — none queued"

  defp render_proposals(%{total: total, by_stage: by_stage, recent: recent}) do
    stage_str =
      by_stage
      |> Enum.reject(fn {s, _} -> is_nil(s) end)
      |> Enum.sort_by(fn {_s, n} -> -n end)
      |> Enum.map(fn {s, n} -> "#{n} #{s}" end)
      |> Enum.join(" → ")

    recent_str =
      recent
      |> Enum.map(fn {title, stage, _status} ->
        "  └ #{truncate(title, 45)} [#{stage || "queued"}]"
      end)
      |> Enum.join("\n")

    "💡 **proposals** — #{total} total · pipeline: #{stage_str}\n#{recent_str}"
  end

  defp render_projects(nil), do: "🏗️ **projects** — unavailable"
  defp render_projects(%{total: 0}), do: "🏗️ **projects** — none"

  defp render_projects(%{total: total, by_status: by_status, active: active}) do
    status_str =
      by_status
      |> Enum.sort_by(fn {_s, n} -> -n end)
      |> Enum.map(fn {s, n} -> "#{n} #{s || "unknown"}" end)
      |> Enum.join(" · ")

    active_str =
      active
      |> Enum.map(fn {name, status} ->
        "  └ #{truncate(name, 45)} [#{status}]"
      end)
      |> Enum.join("\n")

    "🏗️ **projects** — #{total} total · #{status_str}\n#{active_str}"
  end

  defp render_events([]), do: nil

  defp render_events(events) when length(events) > 0 do
    lines =
      events
      |> Enum.take(-8)
      |> Enum.map(fn %{category: cat, topic: topic, event: event} ->
        cat_icon = category_icon(cat)
        payload_str = summarize_event(event)
        "  #{cat_icon} `#{topic}` #{payload_str}"
      end)
      |> Enum.join("\n")

    "🔔 **since last tick** (#{length(events)} events)\n#{lines}"
  end

  defp render_host_heartbeat(nil), do: nil

  defp render_host_heartbeat(heartbeat) do
    backend = if heartbeat[:backend_available] || heartbeat[:openclaw_up], do: "up", else: "down"
    latency = if is_integer(heartbeat[:latency_ms]), do: "#{heartbeat.latency_ms}ms", else: "?"
    narrative = heartbeat[:narrative] || "host state unavailable"

    "💓 **host heartbeat** — #{narrative}\n  └ backend #{backend} · status #{heartbeat[:status] || "unknown"} / #{heartbeat[:heartbeat_state] || "unknown"} · trend #{heartbeat[:trend] || "?"} · latency #{latency}"
  end

  defp render_operator_focus(snap) do
    stalled = get_in(snap, [:session_snapshot, :stalled]) || []
    completed = get_in(snap, [:session_snapshot, :just_completed]) || []
    active_sessions = get_in(snap, [:sessions, :active_count]) || 0
    queued_proposals = get_in(snap, [:proposals, :total]) || 0

    pending_tasks =
      snap.tasks
      |> Map.get(:by_status, %{})
      |> Map.take(["proposed", "in_progress", "active", "blocked"])
      |> Map.values()
      |> Enum.sum()

    recommendation =
      cond do
        stalled != [] ->
          names = stalled |> Enum.take(3) |> Enum.map(&session_name/1) |> Enum.join(", ")
          "inspect stalled sessions: #{names}"

        completed != [] ->
          names = completed |> Enum.take(3) |> Enum.map(&session_name/1) |> Enum.join(", ")
          "harvest finished session output: #{names}"

        pending_tasks > 0 and active_sessions == 0 ->
          "spawn or resume an agent run against the pending task queue"

        queued_proposals > 0 ->
          "push queued proposals through approval / execution"

        active_sessions > 0 ->
          "monitor live sessions and harvest meaningful deltas"

        true ->
          "system is calm; keep watching for new work or drift"
      end

    "🧭 **operator next** — #{recommendation}"
  end

  defp session_name(%{project_path: path}) when is_binary(path) do
    path |> String.split("/") |> List.last() |> truncate(30)
  end

  defp session_name(%{path: path}) when is_binary(path) do
    path |> String.split("/") |> List.last() |> truncate(30)
  end

  defp session_name(_), do: "unknown"

  # --- Helpers ---

  defp summarize_event({tag, payload}) when is_map(payload) do
    name =
      Map.get(payload, :name) || Map.get(payload, :title) || Map.get(payload, :message) ||
        Map.get(payload, :summary) || Map.get(payload, :id)

    "#{tag} #{truncate(to_string(name), 40)}"
  end

  defp summarize_event({tag, payload}) when is_binary(payload),
    do: "#{tag} #{truncate(payload, 40)}"

  defp summarize_event(other), do: truncate(inspect(other, limit: 2), 60)

  defp category_icon(:sessions), do: "🤖"
  defp category_icon(:pipeline), do: "⚙️"
  defp category_icon(:build), do: "🏗️"
  defp category_icon(:intelligence), do: "🧠"
  defp category_icon(:system), do: "🔧"
  defp category_icon(:control), do: "🎛️"
  defp category_icon(_), do: "❓"

  defp status_emoji("done"), do: "✅"
  defp status_emoji("active"), do: "🔄"
  defp status_emoji("proposed"), do: "💭"
  defp status_emoji("blocked"), do: "🚫"
  defp status_emoji("in_progress"), do: "⚡"
  defp status_emoji(_), do: "·"

  defp seconds_ago(nil), do: "?"

  defp seconds_ago(%DateTime{} = dt) do
    diff = DateTime.diff(DateTime.utc_now(), dt, :second)

    cond do
      diff < 60 -> "#{diff}s ago"
      diff < 3600 -> "#{div(diff, 60)}m ago"
      true -> "#{div(diff, 3600)}h ago"
    end
  end

  defp seconds_ago(_), do: "?"

  defp format_tokens(nil), do: "0"
  defp format_tokens(n) when n >= 1000, do: "#{Float.round(n / 1000, 1)}k"
  defp format_tokens(n), do: "#{n}"

  defp format_uptime(nil), do: "?"
  defp format_uptime(s) when s < 60, do: "#{s}s"
  defp format_uptime(s) when s < 3600, do: "#{div(s, 60)}m"
  defp format_uptime(s), do: "#{div(s, 3600)}h #{rem(div(s, 60), 60)}m"

  defp format_interval(ms) when ms < 1000, do: "#{ms}ms"
  defp format_interval(ms) when ms < 60_000, do: "#{div(ms, 1000)}s"
  defp format_interval(ms), do: "#{div(ms, 60_000)}m"

  defp truncate(nil, _), do: ""
  defp truncate(s, max) when byte_size(s) <= max, do: s
  defp truncate(s, max), do: String.slice(s, 0, max - 1) <> "…"

  defp post_to_discord(message) do
    channel_id = ChannelTopology.live_stream().channel_id

    Phoenix.PubSub.broadcast(
      Ema.PubSub,
      "discord:outbound:#{channel_id}",
      {:post, message}
    )
  end

  defp safe(fun, default \\ nil) do
    fun.()
  rescue
    e ->
      Logger.warning("[StreamTicker] gather failed: #{inspect(e)}")
      default
  end

  defp schedule_tick(interval_ms) do
    Process.send_after(self(), :tick, interval_ms)
  end

  defp read_interval do
    case Ema.Settings.get(@setting_key) do
      nil -> @default_interval_ms
      val when is_binary(val) -> String.to_integer(val)
      val when is_integer(val) -> val
    end
  end

  defp maybe_apply_legacy_interval(runtime) do
    case Ema.Settings.get(@setting_key) do
      nil ->
        runtime

      _ ->
        legacy_ms = read_interval() |> max(runtime.min_ms) |> min(runtime.max_ms)

        runtime
        |> Map.put(:mode, "manual")
        |> Map.put(:manual_ms, legacy_ms)
        |> Map.put(:current_ms, legacy_ms)
        |> Map.put(:reason, "legacy manual interval")
    end
  end

  defp tick_signals(snapshot) do
    pending_tasks =
      snapshot.tasks
      |> Map.get(:by_status, %{})
      |> Map.take(["proposed", "in_progress", "active", "blocked"])
      |> Map.values()
      |> Enum.sum()

    %{
      event_count: length(snapshot.recent_events || []),
      recent_event_count: length(snapshot.recent_events || []),
      active_sessions: get_in(snapshot, [:sessions, :active_count]) || 0,
      pending_tasks: pending_tasks
    }
  end

  defp maybe_post_delivery(delivery, last_delivery) do
    case delivery_decision(last_delivery, delivery) do
      {:post, reason} ->
        post_to_discord(delivery.message)
        Logger.info("[StreamTicker] posted #{reason}")
        delivery

      {:skip, reason} ->
        Logger.info("[StreamTicker] skipped post: #{reason}")
        last_delivery || delivery
    end
  end

  defp delivery_signature(snapshot) do
    %{
      git_sha: snapshot.git_sha,
      git_recent: snapshot.git_recent || [],
      tasks: normalize_tasks(snapshot.tasks),
      proposals: normalize_proposals(snapshot.proposals),
      sessions: normalize_sessions(snapshot.sessions),
      projects: normalize_projects(snapshot.projects),
      events: normalize_events(snapshot.recent_events),
      heartbeat: normalize_live_heartbeat()
    }
  end

  defp normalize_tasks(nil), do: nil

  defp normalize_tasks(tasks) do
    %{
      total: tasks.total,
      by_status: tasks.by_status || %{},
      recent: Enum.map(tasks.recent || [], fn {title, status, _at} -> {title, status} end)
    }
  end

  defp normalize_proposals(nil), do: nil

  defp normalize_proposals(proposals) do
    %{
      total: proposals.total,
      by_stage: proposals.by_stage || %{},
      recent:
        Enum.map(proposals.recent || [], fn {title, stage, status} -> {title, stage, status} end)
    }
  end

  defp normalize_sessions(nil), do: nil

  defp normalize_sessions(sessions) do
    %{
      total: sessions.total,
      active_count: sessions.active_count,
      active:
        Enum.map(sessions.active || [], fn {id, path, _last_active, tokens, tools} ->
          {id, path, tokens, tools}
        end)
    }
  end

  defp normalize_projects(nil), do: nil

  defp normalize_projects(projects) do
    %{
      total: projects.total,
      by_status: projects.by_status || %{},
      active: projects.active || []
    }
  end

  defp normalize_events(events) do
    events
    |> List.wrap()
    |> Enum.take(-8)
    |> Enum.map(fn %{category: category, topic: topic, event: event} ->
      {category, topic, summarize_event(event)}
    end)
  end

  defp normalize_live_heartbeat do
    heartbeat = safe(fn -> Ema.Intelligence.VmMonitor.heartbeat_snapshot() end)

    if heartbeat do
      %{
        status: heartbeat.status,
        heartbeat_state: heartbeat.heartbeat_state,
        trend: heartbeat.trend,
        backend_available: heartbeat.backend_available || heartbeat.openclaw_up,
        narrative: heartbeat.narrative,
        notes: heartbeat.notes || []
      }
    else
      nil
    end
  end

  defp repeated_degraded_summary?(_snapshot) do
    case normalize_live_heartbeat() do
      %{status: status, heartbeat_state: heartbeat_state}
      when status in ["degraded", "offline"] or heartbeat_state in ["degraded", "backing_up"] ->
        true

      _ ->
        false
    end
  end

  defp has_recent_activity?(snapshot) do
    List.wrap(snapshot.recent_events) != []
  end
end
