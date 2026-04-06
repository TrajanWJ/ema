defmodule Ema.Stream.Manager do
  @moduledoc """
  EMA stream-of-consciousness manager.

  Context-rich, cadence-controlled posting to Discord stream channels.

  Channels and cadences:
    - #system-heartbeat   — every 5min, narrative state, silent if all-clear
    - #pipeline-flow      — every 20min or on state change, skips if no transitions
    - #agent-thoughts     — every 10min, org-scoped sessions only, skips if idle
    - #intent-stream      — every 15min or on new intent, skips if empty
    - #memory-writes      — event-driven only, skips if nothing written
    - #intelligence-layer — every 40min, synthesized observations, skips if nothing to say
    - #babysitter-digest  — adaptive 10-40min, single-channel synthesis
  """

  use GenServer

  require Logger
  import Ecto.Query

  alias Ema.Feedback.Broadcast
  alias Ema.Babysitter.SessionObserver
  alias Ema.Claude.ExecutionBridge
  alias Ema.Pipes.PipeRun

  # Cadence: how many ticks between emissions (base tick = 5 min)
  # 5 min
  @base_tick_ms 5 * 60 * 1_000
  # every tick (5 min)
  @heartbeat_every 1
  # every 20 min
  @pipeline_every 4
  # every 10 min
  @agent_thoughts_every 2
  # every 15 min
  @intent_stream_every 3
  # every 40 min
  @intelligence_every 8
  # every 20 min (adaptive: skips if quiet)
  @digest_every 4

  # 1 hour
  @incident_window_ms 3_600_000

  # Degrade state tracking
  # N consecutive degraded checks before escalation
  @degrade_threshold 3

  # Public API

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def tick_now(server \\ __MODULE__) do
    GenServer.cast(server, :tick_now)
  end

  def snapshot(server \\ __MODULE__) do
    GenServer.call(server, :snapshot)
  end

  def record_incident(description, server \\ __MODULE__) when is_binary(description) do
    GenServer.cast(server, {:record_incident, description})
  end

  def record_transition(from, to, label, server \\ __MODULE__) do
    GenServer.cast(server, {:record_transition, from, to, label})
  end

  def record_intent(intent, server \\ __MODULE__) when is_binary(intent) do
    GenServer.cast(server, {:record_intent, intent})
  end

  def record_thought(session_id, summary, server \\ __MODULE__) do
    GenServer.cast(server, {:record_thought, session_id, summary})
  end

  def record_memory_write(entry, tags \\ [], server \\ __MODULE__) do
    GenServer.cast(server, {:record_memory_write, entry, tags})
  end

  # GenServer callbacks

  @impl true
  def init(opts) do
    tick_ms = Keyword.get(opts, :tick_ms, @base_tick_ms)
    timer_ref = schedule_tick(tick_ms)

    state = %{
      tick_ms: tick_ms,
      timer_ref: timer_ref,
      tick_count: 0,
      started_at: DateTime.utc_now(),
      # Queues — cleared after emit
      pending_transitions: [],
      pending_intents: [],
      pending_thoughts: %{},
      pending_memory_writes: [],
      # Rolling logs
      incidents: [],
      # Degrade tracking
      consecutive_degraded: 0,
      degrade_started_at: nil,
      last_known_status: :ok,
      # Digest state
      digest_events: [],
      last_digest_at: nil,
      digest_has_content: false
    }

    Logger.info("[Stream.Manager] Started, base_tick=#{tick_ms}ms")
    {:ok, state}
  end

  @impl true
  def handle_call(:snapshot, _from, state) do
    {:reply, Map.delete(state, :timer_ref), state}
  end

  @impl true
  def handle_cast(:tick_now, state) do
    {:noreply, run_tick(state)}
  end

  def handle_cast({:record_incident, desc}, state) do
    now = DateTime.utc_now()
    incident = %{at: now, description: desc}
    incidents = [incident | state.incidents] |> Enum.take(100)
    # Wire incident as high-urgency activity into the babysitter monitor
    maybe_record_activity("babysitter-alerts", %{source: "incident", body: desc, urgent: true})
    {:noreply, %{state | incidents: incidents}}
  end

  def handle_cast({:record_transition, from, to, label}, state) do
    transition = %{from: from, to: to, label: label, at: DateTime.utc_now()}
    {:noreply, %{state | pending_transitions: [transition | state.pending_transitions]}}
  end

  def handle_cast({:record_intent, intent}, state) do
    {:noreply, %{state | pending_intents: [intent | state.pending_intents]}}
  end

  def handle_cast({:record_thought, session_id, summary}, state) do
    thoughts = Map.put(state.pending_thoughts, session_id, summary)

    # Wire real activity into babysitter monitor — session emitted a thought (significant activity)
    maybe_record_activity(session_id, %{source: "agent_thought", body: summary, weight: 2.0})
    {:noreply, %{state | pending_thoughts: thoughts}}
  end

  def handle_cast({:record_memory_write, entry, tags}, state) do
    write = %{entry: entry, tags: tags, at: DateTime.utc_now()}
    # Emit immediately to #memory-writes
    emit_memory_write_now(write)
    writes = [write | state.pending_memory_writes] |> Enum.take(50)
    {:noreply, %{state | pending_memory_writes: writes, digest_has_content: true}}
  end

  @impl true
  def handle_info(:tick, state) do
    new_state = run_tick(state)
    timer_ref = schedule_tick(state.tick_ms)
    {:noreply, %{new_state | timer_ref: timer_ref}}
  end

  # --- Tick logic ---

  defp run_tick(state) do
    tick = state.tick_count + 1
    now = DateTime.utc_now()

    Logger.debug("[Stream.Manager] Tick ##{tick}")

    # Collect system state once per tick (shared across channels)
    sys = collect_system_state()
    state = update_degrade_tracking(state, sys, now)

    # Per-channel cadence gates
    state =
      if rem(tick, @heartbeat_every) == 0,
        do: emit_heartbeat(state, sys, now, tick),
        else: state

    state =
      if rem(tick, @agent_thoughts_every) == 0,
        do: emit_agent_thoughts(state, sys),
        else: state

    state =
      if rem(tick, @intent_stream_every) == 0,
        do: emit_intent_stream(state),
        else: state

    state =
      if rem(tick, @pipeline_every) == 0,
        do: emit_pipeline_flow(state),
        else: state

    state =
      if rem(tick, @intelligence_every) == 0,
        do: emit_intelligence_layer(state, sys, now),
        else: state

    state =
      if rem(tick, @digest_every) == 0 or state.digest_has_content,
        do: emit_digest(state, sys, now),
        else: state

    %{state | tick_count: tick}
  end

  # --- System state collection ---

  defp collect_system_state do
    gateway_status = check_gateway_status()
    {session_count, active_sessions, last_task} = get_session_stats()
    {active_tasks, queued_proposals, pipe_run_failures} = get_pipeline_stats()
    vm_status = get_vm_status()

    %{
      gateway_status: gateway_status,
      session_count: session_count,
      active_sessions: active_sessions,
      last_task: last_task,
      active_tasks: active_tasks,
      queued_proposals: queued_proposals,
      pipe_run_failures: pipe_run_failures,
      vm_status: vm_status,
      collected_at: DateTime.utc_now()
    }
  end

  defp update_degrade_tracking(state, sys, now) do
    degraded? = sys.vm_status in [:degraded, :backing_up, :offline]

    cond do
      degraded? and state.consecutive_degraded == 0 ->
        %{state | consecutive_degraded: 1, degrade_started_at: now, last_known_status: :degraded}

      degraded? ->
        %{
          state
          | consecutive_degraded: state.consecutive_degraded + 1,
            last_known_status: :degraded
        }

      not degraded? and state.last_known_status == :degraded ->
        duration =
          if state.degrade_started_at,
            do: DateTime.diff(now, state.degrade_started_at, :minute),
            else: 0

        Logger.info("[Stream.Manager] System recovered after #{duration}m degraded")
        %{state | consecutive_degraded: 0, degrade_started_at: nil, last_known_status: :ok}

      true ->
        %{state | consecutive_degraded: 0}
    end
  end

  # --- Channel emitters ---

  defp emit_heartbeat(state, sys, now, tick) do
    degraded? = state.consecutive_degraded > 0
    all_clear? = not degraded? and sys.active_tasks == 0 and sys.queued_proposals == 0

    msg =
      if all_clear? and tick > 1 do
        # Quiet confirmation when nothing's wrong — suppress if very recent post
        nil
      else
        build_heartbeat_msg(sys, state, now, tick)
      end

    if msg, do: Broadcast.emit(:system_heartbeat, msg)

    # Track for digest
    digest_event =
      if degraded?, do: "🟠 DEGRADED (#{state.consecutive_degraded} checks)", else: nil

    add_digest_event(state, digest_event)
  end

  defp build_heartbeat_msg(sys, state, now, tick) do
    ts = format_time(now)
    status_line = format_vm_status(sys.vm_status, state)

    lines = [
      "#{status_icon(sys.vm_status)} **Heartbeat ##{tick}** · #{ts}",
      status_line,
      "Gateway: #{sys.gateway_status}  ·  Sessions: #{sys.session_count}  ·  Queue: #{sys.queued_proposals} proposals"
    ]

    lines =
      if sys.active_tasks > 0,
        do: lines ++ ["Active tasks: #{sys.active_tasks}"],
        else: lines

    lines =
      if length(sys.pipe_run_failures) > 0 do
        fail_ids = sys.pipe_run_failures |> Enum.take(3) |> Enum.join(", ")
        lines ++ ["⚠️ Pipe failures: #{fail_ids} — investigate"]
      else
        lines
      end

    lines =
      if state.degrade_started_at do
        since = DateTime.diff(now, state.degrade_started_at, :minute)
        lines ++ ["-# degraded #{since}m · #{state.consecutive_degraded} consecutive checks"]
      else
        lines
      end

    Enum.join(lines, "\n")
  end

  defp emit_agent_thoughts(state, sys) do
    # Org-scoped sessions only — filter to Trajan's org
    org_sessions = sys.active_sessions |> Enum.filter(&org_session?/1)

    if Enum.empty?(org_sessions) and map_size(state.pending_thoughts) == 0 do
      # Nothing to report — silent
      state
    else
      ts = format_time(DateTime.utc_now())
      lines = ["🤖 **Agent Activity** · #{ts}", ""]

      session_lines =
        org_sessions
        |> Enum.map(fn s ->
          "  └ #{s.id}: #{s.tokens}k tokens · last tool: #{s.last_tool}"
        end)

      thought_lines =
        state.pending_thoughts
        |> Enum.map(fn {session_id, summary} ->
          "  └ #{session_id}: #{summary}"
        end)

      completion_lines =
        if length(thought_lines) > 0, do: ["", "Recent reasoning:"] ++ thought_lines, else: []

      all_lines =
        lines ++
          if(length(session_lines) > 0,
            do: ["Active sessions (#{length(org_sessions)}):"] ++ session_lines,
            else: []
          ) ++ completion_lines

      msg = Enum.join(all_lines, "\n")
      Broadcast.emit(:agent_thoughts, msg)

      %{state | pending_thoughts: %{}, digest_has_content: true}
    end
  end

  defp emit_intent_stream(state) do
    if Enum.empty?(state.pending_intents) do
      # Nothing declared — stay silent
      state
    else
      ts = format_time(DateTime.utc_now())

      intent_lines =
        state.pending_intents
        |> Enum.reverse()
        |> Enum.map(&"  └ #{&1}")
        |> Enum.join("\n")

      msg = "🎯 **Intent Snapshot** · #{ts}\n\nDeclared intents:\n#{intent_lines}"
      Broadcast.emit(:intent_stream, msg)

      %{state | pending_intents: [], digest_has_content: true}
    end
  end

  defp emit_pipeline_flow(state) do
    if Enum.empty?(state.pending_transitions) do
      # Nothing new — stay silent
      state
    else
      ts = format_time(DateTime.utc_now())

      lines =
        state.pending_transitions
        |> Enum.reverse()
        |> Enum.map(fn t ->
          time = format_time(t.at)
          "  └ `#{time}` **#{t.label}**: #{t.from} → #{t.to}"
        end)
        |> Enum.join("\n")

      msg = "⚙️ **Pipeline transitions** · #{ts}\n\n#{lines}"
      Broadcast.emit(:pipeline_flow, msg)

      %{state | pending_transitions: [], digest_has_content: true}
    end
  end

  defp emit_intelligence_layer(state, sys, now) do
    cutoff = DateTime.add(now, -@incident_window_ms, :millisecond)

    recent_incidents =
      state.incidents
      |> Enum.filter(fn i -> DateTime.compare(i.at, cutoff) != :lt end)

    # Build observations from available state
    observations = build_observations(sys, state, recent_incidents, now)

    if Enum.empty?(observations) do
      state
    else
      ts = format_time(now)
      obs_lines = observations |> Enum.map(&"  └ #{&1}") |> Enum.join("\n")

      recommendations = build_recommendations(sys, state)

      rec_lines =
        if Enum.empty?(recommendations),
          do: "",
          else:
            "\n\nRecommendation:\n" <>
              (recommendations |> Enum.map(&"  └ #{&1}") |> Enum.join("\n"))

      msg = "🧠 **Intelligence Snapshot** · #{ts}\n\nPatterns detected:\n#{obs_lines}#{rec_lines}"
      Broadcast.emit(:intelligence_layer, msg)

      %{state | digest_has_content: true}
    end
  end

  defp emit_memory_write_now(write) do
    ts = format_time(write.at)
    tags = write.tags |> Enum.join(", ")
    tag_str = if tags != "", do: " — tagged: #{tags}", else: ""

    msg = "📝 **Memory write** · #{ts}\n\n  └ \"#{write.entry}\"#{tag_str}"
    Broadcast.emit(:memory_writes, msg)
  end

  defp emit_digest(state, sys, now) do
    ts = format_time(now)

    last_digest_ago =
      if state.last_digest_at,
        do: DateTime.diff(now, state.last_digest_at, :minute),
        else: nil

    # Skip if recent and nothing changed
    if last_digest_ago && last_digest_ago < 10 && not state.digest_has_content do
      state
    else
      window_str =
        case last_digest_ago do
          nil -> "session start"
          n -> "#{n}m"
        end

      status_emoji =
        case {state.consecutive_degraded, length(sys.pipe_run_failures)} do
          {d, _} when d > @degrade_threshold -> "🔴"
          {d, _} when d > 0 -> "🟠"
          {_, f} when f > 0 -> "🟡"
          _ -> "🟢"
        end

      degrade_line =
        if state.consecutive_degraded > 0 do
          since =
            if state.degrade_started_at,
              do: "#{DateTime.diff(now, state.degrade_started_at, :minute)}m",
              else: "unknown"

          "System: #{status_emoji} DEGRADED (#{since}) — #{sys.vm_status}"
        else
          "System: 🟢 OK — gateway #{sys.gateway_status}"
        end

      pipe_line =
        case {sys.active_tasks, length(sys.pipe_run_failures), sys.queued_proposals} do
          {0, 0, 0} -> "Pipeline: idle"
          {a, 0, q} -> "Pipeline: #{a} active · #{q} queued"
          {a, f, q} -> "Pipeline: #{a} active · #{f} failures · #{q} queued ⚠️"
        end

      session_line = "Agents: #{sys.session_count} sessions · last: #{sys.last_task}"

      recent_events =
        state.digest_events
        |> Enum.reject(&is_nil/1)
        |> Enum.uniq()
        |> Enum.take(3)

      event_line =
        case recent_events do
          [] -> nil
          events -> "Events: " <> Enum.join(events, " · ")
        end

      recommendations = build_recommendations(sys, state)

      rec_section =
        if Enum.empty?(recommendations),
          do: "",
          else:
            "\n\n🔧 **Next actions:**\n" <>
              (recommendations |> Enum.map(&"  #{&1}") |> Enum.join("\n"))

      lines = [
        "📋 **Babysitter Digest** · #{ts}",
        "_Window: #{window_str}_",
        "",
        degrade_line,
        pipe_line,
        session_line
      ]

      lines = if event_line, do: lines ++ [event_line], else: lines

      msg = Enum.join(lines, "\n") <> rec_section
      Broadcast.emit(:babysitter_digest, msg)

      %{state | last_digest_at: now, digest_has_content: false, digest_events: []}
    end
  end

  # --- Observation/recommendation builders ---

  defp build_observations(sys, state, recent_incidents, now) do
    obs = []

    obs =
      if state.consecutive_degraded >= @degrade_threshold do
        since =
          if state.degrade_started_at,
            do: " for #{DateTime.diff(now, state.degrade_started_at, :minute)} minutes",
            else: ""

        [
          "VM has been in #{sys.vm_status} state#{since} (#{state.consecutive_degraded} consecutive checks)"
          | obs
        ]
      else
        obs
      end

    obs =
      if length(sys.pipe_run_failures) >= 2 do
        [
          "#{length(sys.pipe_run_failures)} consecutive pipe run failures — same executor, different proposals → executor issue not proposal issue"
          | obs
        ]
      else
        obs
      end

    obs =
      if length(recent_incidents) >= 2 do
        count = length(recent_incidents)
        sample = recent_incidents |> Enum.take(1) |> Enum.map(& &1.description) |> Enum.join("")
        ["#{count} incident(s) in last hour — most recent: #{sample}" | obs]
      else
        obs
      end

    Enum.reverse(obs)
  end

  defp build_recommendations(sys, state) do
    recs = []

    recs =
      if length(sys.pipe_run_failures) >= 2,
        do: [
          "Investigate pipe executor (failures are cross-proposal — executor is the common factor)"
          | recs
        ],
        else: recs

    recs =
      if state.consecutive_degraded >= @degrade_threshold,
        do: ["Check backing_up cause (IO overload? backup process hung? disk pressure?)" | recs],
        else: recs

    Enum.reverse(recs)
  end

  defp add_digest_event(state, nil), do: state

  defp add_digest_event(state, event) do
    events = [event | state.digest_events] |> Enum.take(20)
    %{state | digest_events: events, digest_has_content: true}
  end

  # --- Data fetchers ---

  defp check_gateway_status do
    gateway_url = Application.get_env(:ema, :openclaw_gateway_url, "http://localhost:18789")

    case Req.get("#{gateway_url}/health", receive_timeout: 3_000) do
      {:ok, %{status: s}} when s in 200..299 -> "🟢 up"
      _ -> "🔴 down"
    end
  rescue
    _ -> "⚠️ unknown"
  end

  defp get_session_stats do
    try do
      snapshot = SessionObserver.snapshot()
      recent = snapshot[:sessions] || []
      count = length(recent)

      sessions =
        recent
        |> Enum.map(fn e ->
          attrs = Map.get(e, :attrs, %{}) || %{}
          token_count = Map.get(attrs, :token_count, 0) || 0

          %{
            id: Map.get(e, :session_id, "unknown"),
            tokens: div(token_count, 1000),
            last_tool: Map.get(e, :last_tool, "unknown") || "unknown"
          }
        end)

      last =
        recent
        |> List.first()
        |> case do
          nil -> "none"
          e -> "#{Map.get(e, :session_id, "unknown")} @ #{format_time(Map.get(e, :last_ts))}"
        end

      {count, sessions, last}
    rescue
      _ -> {0, [], "unknown"}
    end
  end

  defp get_pipeline_stats do
    try do
      active = ExecutionBridge.active_count()
      queued = queued_proposal_count()
      failures = recent_pipe_failures(10)
      {active, queued, failures}
    rescue
      _ -> {0, 0, []}
    end
  end

  defp get_vm_status do
    try do
      vm_status()
    rescue
      _ -> :unknown
    end
  end

  # --- Filters ---

  defp org_session?(session) do
    # Filter to sessions belonging to Trajan's org — exclude other tenant sessions
    org_prefixes =
      Application.get_env(:ema, :org_session_prefixes, ["trajan", "right-hand", "main"])

    Enum.any?(org_prefixes, &String.starts_with?(session.id, &1))
  end

  # --- Formatters ---

  defp format_time(%DateTime{} = dt) do
    dt |> DateTime.to_string() |> String.slice(11, 8) |> Kernel.<>(" UTC")
  end

  defp format_time(_), do: "??"

  defp status_icon(:ok), do: "🟢"
  defp status_icon(:degraded), do: "🟠"
  defp status_icon(:backing_up), do: "🟠"
  defp status_icon(:offline), do: "🔴"
  defp status_icon(_), do: "⚪"

  defp format_vm_status(:backing_up, state) do
    if state.consecutive_degraded > 0,
      do:
        "VM: **degraded** / `backing_up` · #{state.consecutive_degraded} consecutive unhealthy checks",
      else: "VM: **backing_up** (new)"
  end

  defp format_vm_status(:degraded, state) do
    "VM: **degraded** · #{state.consecutive_degraded} consecutive checks"
  end

  defp format_vm_status(status, _state), do: "VM: #{status}"

  defp schedule_tick(tick_ms) do
    Process.send_after(self(), :tick, tick_ms)
  end

  defp maybe_record_activity(_stream, _attrs), do: :ok

  defp queued_proposal_count do
    Ema.Repo.aggregate(
      from(p in Ema.Proposals.Proposal, where: p.status == "queued"),
      :count
    )
  end

  defp recent_pipe_failures(limit) do
    Ema.Repo.all(
      from r in PipeRun,
        where: r.status == "failed",
        order_by: [desc: r.inserted_at],
        limit: ^limit,
        select: {r.id, r.inserted_at}
    )
  end

  defp vm_status do
    case System.cmd("systemctl", ["--user", "is-active", "ema-daemon.service"],
           stderr_to_stdout: true
         ) do
      {"active\n", 0} -> :ok
      {"activating\n", 0} -> :backing_up
      {_out, _code} -> :offline
    end
  rescue
    _ -> :unknown
  end
end
