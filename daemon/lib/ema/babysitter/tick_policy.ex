defmodule Ema.Babysitter.TickPolicy do
  @moduledoc """
  Shared adaptive tick policy for babysitter streams.

  Each stream has a bounded range plus an auto/manual mode. Auto mode
  nudges the effective interval inside that range based on recent EMA
  activity and global quieting / token-pressure controls.
  """

  alias Ema.Settings

  @global_defaults %{
    quieting_factor: 1.0,
    token_pressure: 0.0
  }

  @defaults %{
    live: %{
      min_ms: 5_000,
      max_ms: 45_000,
      base_ms: 15_000,
      manual_ms: 15_000,
      mode: "auto",
      window_s: 45,
      hot_threshold: 8.0,
      hysteresis_pct: 0.18,
      step_pct: 0.30
    },
    heartbeat: %{
      min_ms: 8_000,
      max_ms: 60_000,
      base_ms: 20_000,
      manual_ms: 20_000,
      mode: "auto",
      window_s: 45,
      hot_threshold: 5.0,
      hysteresis_pct: 0.20,
      step_pct: 0.30
    },
    intent: %{
      min_ms: 15_000,
      max_ms: 120_000,
      base_ms: 35_000,
      manual_ms: 35_000,
      mode: "auto",
      window_s: 60,
      hot_threshold: 4.0,
      hysteresis_pct: 0.18,
      step_pct: 0.28
    },
    pipeline: %{
      min_ms: 8_000,
      max_ms: 75_000,
      base_ms: 18_000,
      manual_ms: 18_000,
      mode: "auto",
      window_s: 45,
      hot_threshold: 6.0,
      hysteresis_pct: 0.18,
      step_pct: 0.30
    },
    agent: %{
      min_ms: 8_000,
      max_ms: 75_000,
      base_ms: 18_000,
      manual_ms: 18_000,
      mode: "auto",
      window_s: 45,
      hot_threshold: 5.0,
      hysteresis_pct: 0.18,
      step_pct: 0.30
    },
    intelligence: %{
      min_ms: 20_000,
      max_ms: 150_000,
      base_ms: 45_000,
      manual_ms: 45_000,
      mode: "auto",
      window_s: 90,
      hot_threshold: 4.0,
      hysteresis_pct: 0.18,
      step_pct: 0.25
    },
    memory: %{
      min_ms: 25_000,
      max_ms: 180_000,
      base_ms: 60_000,
      manual_ms: 60_000,
      mode: "auto",
      window_s: 120,
      hot_threshold: 3.0,
      hysteresis_pct: 0.20,
      step_pct: 0.24
    },
    execution: %{
      min_ms: 10_000,
      max_ms: 90_000,
      base_ms: 20_000,
      manual_ms: 20_000,
      mode: "auto",
      window_s: 60,
      hot_threshold: 6.0,
      hysteresis_pct: 0.18,
      step_pct: 0.30
    },
    evolution: %{
      min_ms: 45_000,
      max_ms: 300_000,
      base_ms: 120_000,
      manual_ms: 120_000,
      mode: "auto",
      window_s: 180,
      hot_threshold: 2.5,
      hysteresis_pct: 0.20,
      step_pct: 0.20
    },
    speculative: %{
      min_ms: 30_000,
      max_ms: 240_000,
      base_ms: 90_000,
      manual_ms: 90_000,
      mode: "auto",
      window_s: 180,
      hot_threshold: 2.0,
      hysteresis_pct: 0.20,
      step_pct: 0.20
    }
  }

  @activity_categories %{
    live: :all,
    heartbeat: [:system, :control, :pipeline, :sessions],
    intent: [:intelligence],
    pipeline: [:pipeline],
    agent: [:sessions],
    intelligence: [:intelligence],
    memory: [:build],
    execution: [:pipeline, :build, :sessions],
    evolution: [:control, :intelligence],
    speculative: :all
  }

  def defaults, do: @defaults
  def streams, do: Map.keys(@defaults)
  def activity_categories(stream), do: Map.get(@activity_categories, stream, :all)

  def global_config do
    %{
      quieting_factor: get_float("babysitter.global.quieting_factor", @global_defaults.quieting_factor),
      token_pressure: get_float("babysitter.global.token_pressure", @global_defaults.token_pressure)
    }
  end

  def configure_global(attrs) when is_map(attrs) do
    maybe_put_float("babysitter.global.quieting_factor", Map.get(attrs, :quieting_factor))
    maybe_put_float("babysitter.global.token_pressure", Map.get(attrs, :token_pressure))
    :ok
  end

  def profile(stream) when is_atom(stream) do
    base = Map.fetch!(@defaults, stream)

    base
    |> Map.merge(%{
      min_ms: get_int(key(stream, :min_ms), base.min_ms),
      max_ms: get_int(key(stream, :max_ms), base.max_ms),
      base_ms: get_int(key(stream, :base_ms), base.base_ms),
      manual_ms: get_int(key(stream, :manual_ms), base.manual_ms),
      mode: get_mode(key(stream, :mode), base.mode),
      window_s: get_int(key(stream, :window_s), base.window_s),
      hot_threshold: get_float(key(stream, :hot_threshold), base.hot_threshold),
      hysteresis_pct: get_float(key(stream, :hysteresis_pct), base.hysteresis_pct),
      step_pct: get_float(key(stream, :step_pct), base.step_pct)
    })
    |> normalize_profile()
  end

  def configure_stream(stream, attrs) when is_atom(stream) and is_map(attrs) do
    Enum.each(attrs, fn
      {:mode, value} when not is_nil(value) -> Settings.set(key(stream, :mode), normalize_mode(value))
      {:min_ms, value} -> maybe_put_int(key(stream, :min_ms), value)
      {:max_ms, value} -> maybe_put_int(key(stream, :max_ms), value)
      {:base_ms, value} -> maybe_put_int(key(stream, :base_ms), value)
      {:manual_ms, value} -> maybe_put_int(key(stream, :manual_ms), value)
      {:window_s, value} -> maybe_put_int(key(stream, :window_s), value)
      {:hot_threshold, value} -> maybe_put_float(key(stream, :hot_threshold), value)
      {:hysteresis_pct, value} -> maybe_put_float(key(stream, :hysteresis_pct), value)
      {:step_pct, value} -> maybe_put_float(key(stream, :step_pct), value)
      _ -> :ok
    end)

    :ok
  end

  def runtime(stream) when is_atom(stream) do
    profile = profile(stream)

    %{
      stream: stream,
      mode: profile.mode,
      min_ms: profile.min_ms,
      max_ms: profile.max_ms,
      base_ms: profile.base_ms,
      manual_ms: profile.manual_ms,
      current_ms: effective_interval(profile, profile.base_ms),
      activity_ema: 0.0,
      last_score: 0.0,
      reason: "boot",
      window_s: profile.window_s,
      hot_threshold: profile.hot_threshold,
      quieting_factor: global_config().quieting_factor,
      token_pressure: global_config().token_pressure
    }
  end

  def refresh_runtime(%{stream: stream} = runtime) do
    profile = profile(stream)
    globals = global_config()
    current = Map.get(runtime, :current_ms, profile.base_ms)

    current_ms =
      if profile.mode == "manual" do
        effective_interval(profile, profile.manual_ms)
      else
        clamp(current, profile.min_ms, profile.max_ms)
      end

    runtime
    |> Map.merge(%{
      mode: profile.mode,
      min_ms: profile.min_ms,
      max_ms: profile.max_ms,
      base_ms: profile.base_ms,
      manual_ms: profile.manual_ms,
      current_ms: current_ms,
      window_s: profile.window_s,
      hot_threshold: profile.hot_threshold,
      quieting_factor: globals.quieting_factor,
      token_pressure: globals.token_pressure
    })
  end

  def advance(%{stream: stream} = runtime, signals) when is_map(signals) do
    profile = profile(stream)
    globals = global_config()

    if profile.mode == "manual" do
      runtime
      |> Map.merge(%{
        mode: profile.mode,
        min_ms: profile.min_ms,
        max_ms: profile.max_ms,
        base_ms: profile.base_ms,
        manual_ms: profile.manual_ms,
        current_ms: effective_interval(profile, profile.manual_ms),
        quieting_factor: globals.quieting_factor,
        token_pressure: globals.token_pressure,
        reason: "manual"
      })
    else
      raw_score = activity_score(stream, signals)
      ema = Float.round(Map.get(runtime, :activity_ema, 0.0) * 0.65 + raw_score * 0.35, 3)
      normalized = min(1.0, ema / max(profile.hot_threshold, 0.5))
      span = profile.max_ms - profile.min_ms
      base_target = profile.max_ms - round(normalized * span)

      quiet_scale =
        max(0.5, globals.quieting_factor)
        |> Kernel.*(1.0 + max(globals.token_pressure, 0.0))

      target = clamp(round(base_target * quiet_scale), profile.min_ms, profile.max_ms)
      current = clamp(Map.get(runtime, :current_ms, profile.base_ms), profile.min_ms, profile.max_ms)
      hysteresis = max(1_000, round(current * profile.hysteresis_pct))
      step = max(1_000, round(span * profile.step_pct))

      next_ms =
        if abs(target - current) < hysteresis do
          current
        else
          current + clamp(target - current, -step, step)
        end

      reason =
        cond do
          raw_score >= profile.hot_threshold -> "hot activity"
          raw_score >= profile.hot_threshold / 2 -> "warming"
          globals.token_pressure > 0.05 -> "token pressure"
          globals.quieting_factor > 1.05 -> "quieted"
          true -> "cooldown"
        end

      runtime
      |> Map.merge(%{
        mode: profile.mode,
        min_ms: profile.min_ms,
        max_ms: profile.max_ms,
        base_ms: profile.base_ms,
        manual_ms: profile.manual_ms,
        current_ms: clamp(next_ms, profile.min_ms, profile.max_ms),
        activity_ema: ema,
        last_score: raw_score,
        reason: reason,
        window_s: profile.window_s,
        hot_threshold: profile.hot_threshold,
        quieting_factor: globals.quieting_factor,
        token_pressure: globals.token_pressure
      })
    end
  end

  def describe(%{stream: stream} = runtime) do
    %{
      stream: Atom.to_string(stream),
      mode: runtime.mode,
      min_ms: runtime.min_ms,
      max_ms: runtime.max_ms,
      base_ms: runtime.base_ms,
      manual_ms: runtime.manual_ms,
      current_ms: runtime.current_ms,
      activity_ema: runtime.activity_ema,
      last_score: runtime.last_score,
      reason: runtime.reason,
      window_s: runtime.window_s,
      hot_threshold: runtime.hot_threshold,
      quieting_factor: runtime.quieting_factor,
      token_pressure: runtime.token_pressure
    }
  end

  defp activity_score(_stream, signals) do
    event_count = num(Map.get(signals, :event_count, 0))
    recent_count = num(Map.get(signals, :recent_event_count, 0))
    active_sessions = num(Map.get(signals, :active_sessions, 0))
    pending_tasks = num(Map.get(signals, :pending_tasks, 0))

    Float.round(event_count * 1.0 + recent_count * 1.5 + active_sessions * 0.75 + pending_tasks * 0.25, 3)
  end

  defp effective_interval(profile, value) do
    clamp(value || profile.base_ms, profile.min_ms, profile.max_ms)
  end

  defp normalize_profile(profile) do
    min_ms = max(profile.min_ms, 1_000)
    max_ms = max(profile.max_ms, min_ms)
    base_ms = clamp(profile.base_ms, min_ms, max_ms)
    manual_ms = clamp(profile.manual_ms, min_ms, max_ms)

    profile
    |> Map.put(:mode, normalize_mode(profile.mode))
    |> Map.put(:min_ms, min_ms)
    |> Map.put(:max_ms, max_ms)
    |> Map.put(:base_ms, base_ms)
    |> Map.put(:manual_ms, manual_ms)
  end

  defp key(stream, field), do: "babysitter.stream.#{stream}.#{field}"

  defp get_mode(key, default), do: normalize_mode(Settings.get(key) || default)

  defp normalize_mode(value) when value in [:manual, "manual"], do: "manual"
  defp normalize_mode(_), do: "auto"

  defp get_int(key, default) do
    case Settings.get(key) do
      nil -> default
      value when is_integer(value) -> value
      value when is_binary(value) ->
        case Integer.parse(value) do
          {n, ""} -> n
          _ -> default
        end
      _ -> default
    end
  end

  defp get_float(key, default) do
    case Settings.get(key) do
      nil -> default
      value when is_float(value) -> value
      value when is_integer(value) -> value / 1
      value when is_binary(value) ->
        case Float.parse(value) do
          {n, ""} -> n
          _ -> default
        end
      _ -> default
    end
  end

  defp maybe_put_int(_key, nil), do: :ok
  defp maybe_put_int(key, value) when is_integer(value), do: Settings.set(key, Integer.to_string(value))
  defp maybe_put_int(key, value) when is_binary(value) do
    case Integer.parse(value) do
      {n, ""} -> Settings.set(key, Integer.to_string(n))
      _ -> :ok
    end
  end
  defp maybe_put_int(_key, _value), do: :ok

  defp maybe_put_float(_key, nil), do: :ok
  defp maybe_put_float(key, value) when is_float(value), do: Settings.set(key, :erlang.float_to_binary(value, decimals: 3))
  defp maybe_put_float(key, value) when is_integer(value), do: Settings.set(key, :erlang.float_to_binary(value / 1, decimals: 3))
  defp maybe_put_float(key, value) when is_binary(value) do
    case Float.parse(value) do
      {n, ""} -> Settings.set(key, :erlang.float_to_binary(n, decimals: 3))
      _ -> :ok
    end
  end
  defp maybe_put_float(_key, _value), do: :ok

  defp clamp(value, min_value, max_value) when is_integer(value) do
    value |> max(min_value) |> min(max_value)
  end

  defp num(value) when is_integer(value), do: value / 1
  defp num(value) when is_float(value), do: value
  defp num(_), do: 0.0
end
