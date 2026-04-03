defmodule Ema.Temporal do
  @moduledoc """
  Temporal Intelligence — learns circadian rhythms from user activity.
  """

  import Ecto.Query
  alias Ema.Repo
  alias Ema.Temporal.{Rhythm, EnergyLog}

  # --- Rhythm CRUD ---

  def list_rhythms do
    Rhythm
    |> order_by([r], asc: r.day_of_week, asc: r.hour)
    |> Repo.all()
  end

  def get_rhythm(day_of_week, hour) do
    Repo.get_by(Rhythm, day_of_week: day_of_week, hour: hour)
  end

  def get_or_create_rhythm(day_of_week, hour) do
    case get_rhythm(day_of_week, hour) do
      nil ->
        id = generate_id("rhy")

        %Rhythm{}
        |> Rhythm.changeset(%{id: id, day_of_week: day_of_week, hour: hour})
        |> Repo.insert()

      rhythm ->
        {:ok, rhythm}
    end
  end

  def update_rhythm_from_signal(day_of_week, hour, energy, focus, activity_type) do
    {:ok, rhythm} = get_or_create_rhythm(day_of_week, hour)
    count = rhythm.sample_count

    new_energy = weighted_average(rhythm.energy_level, energy, count)
    new_focus = weighted_average(rhythm.focus_quality, focus, count)

    task_types =
      if activity_type && activity_type not in rhythm.preferred_task_types do
        (rhythm.preferred_task_types ++ [activity_type]) |> Enum.take(-5)
      else
        rhythm.preferred_task_types
      end

    rhythm
    |> Rhythm.changeset(%{
      energy_level: new_energy,
      focus_quality: new_focus,
      preferred_task_types: task_types,
      sample_count: count + 1
    })
    |> Repo.update()
  end

  defp weighted_average(_current, new_val, sample_count) when sample_count == 0, do: new_val

  defp weighted_average(current, new_val, sample_count) do
    weight = min(sample_count, 20)
    ((current * weight + new_val) / (weight + 1))
    |> Float.round(2)
  end

  # --- Energy Logs ---

  def log_energy(attrs) do
    id = generate_id("elog")
    logged_at = attrs[:logged_at] || DateTime.utc_now()

    %EnergyLog{}
    |> EnergyLog.changeset(Map.merge(attrs, %{id: id, logged_at: logged_at}))
    |> Repo.insert()
  end

  def recent_logs(limit \\ 50) do
    EnergyLog
    |> order_by(desc: :logged_at)
    |> limit(^limit)
    |> Repo.all()
  end

  # --- Temporal Context ---

  def current_context do
    now = DateTime.utc_now()
    day = Date.day_of_week(now) - 1
    hour = now.hour

    rhythm = get_rhythm(day, hour)

    energy = if rhythm, do: rhythm.energy_level, else: 5.0
    focus = if rhythm, do: rhythm.focus_quality, else: 5.0
    task_types = if rhythm, do: rhythm.preferred_task_types, else: []
    samples = if rhythm, do: rhythm.sample_count, else: 0

    mode = infer_mode(energy, focus, hour)

    %{
      time_of_day: time_of_day(hour),
      day_of_week: day,
      hour: hour,
      estimated_energy: energy,
      estimated_focus: focus,
      preferred_task_types: task_types,
      suggested_mode: mode,
      confidence: min(samples / 10.0, 1.0) |> Float.round(2),
      timestamp: now
    }
  end

  def best_time_for(task_type) do
    Rhythm
    |> where([r], ^task_type in r.preferred_task_types or r.sample_count == 0)
    |> order_by([r], desc: r.energy_level, desc: r.focus_quality)
    |> limit(5)
    |> Repo.all()
    |> case do
      [] -> best_time_by_mode(task_type)
      rhythms -> Enum.map(rhythms, &format_time_slot/1)
    end
  end

  defp best_time_by_mode(task_type) do
    {min_energy, min_focus} = mode_thresholds(task_type)

    Rhythm
    |> where([r], r.energy_level >= ^min_energy and r.focus_quality >= ^min_focus)
    |> where([r], r.sample_count > 0)
    |> order_by([r], desc: r.energy_level, desc: r.focus_quality)
    |> limit(5)
    |> Repo.all()
    |> Enum.map(&format_time_slot/1)
  end

  defp mode_thresholds("deep_work"), do: {7.0, 7.0}
  defp mode_thresholds("creative"), do: {6.0, 5.0}
  defp mode_thresholds("meetings"), do: {5.0, 4.0}
  defp mode_thresholds("admin"), do: {3.0, 3.0}
  defp mode_thresholds("shallow_work"), do: {4.0, 4.0}
  defp mode_thresholds(_), do: {3.0, 3.0}

  def suggest_schedule(tasks) do
    rhythms =
      Rhythm
      |> where([r], r.sample_count > 0)
      |> order_by([r], asc: r.day_of_week, asc: r.hour)
      |> Repo.all()

    Enum.map(tasks, fn task ->
      task_type = Map.get(task, :type, "shallow_work")
      best = find_best_slot(rhythms, task_type)
      Map.put(task, :suggested_slot, best)
    end)
  end

  defp find_best_slot(rhythms, task_type) do
    {min_energy, min_focus} = mode_thresholds(task_type)

    rhythms
    |> Enum.filter(fn r -> r.energy_level >= min_energy and r.focus_quality >= min_focus end)
    |> Enum.sort_by(fn r -> -(r.energy_level + r.focus_quality) end)
    |> List.first()
    |> case do
      nil -> nil
      r -> format_time_slot(r)
    end
  end

  # --- Helpers ---

  defp infer_mode(energy, focus, _hour) when energy >= 7.0 and focus >= 7.0, do: :deep_work
  defp infer_mode(energy, focus, _hour) when energy >= 6.0 and focus < 6.0, do: :creative
  defp infer_mode(energy, _focus, _hour) when energy >= 5.0, do: :shallow_work
  defp infer_mode(energy, _focus, hour) when energy < 4.0 and hour >= 12, do: :rest
  defp infer_mode(_energy, _focus, _hour), do: :admin

  defp time_of_day(hour) when hour < 6, do: :night
  defp time_of_day(hour) when hour < 12, do: :morning
  defp time_of_day(hour) when hour < 17, do: :afternoon
  defp time_of_day(hour) when hour < 21, do: :evening
  defp time_of_day(_), do: :night

  @day_names ~w(Mon Tue Wed Thu Fri Sat Sun)

  defp format_time_slot(rhythm) do
    day_name = Enum.at(@day_names, rhythm.day_of_week)

    %{
      day_of_week: rhythm.day_of_week,
      day_name: day_name,
      hour: rhythm.hour,
      energy: rhythm.energy_level,
      focus: rhythm.focus_quality,
      label: "#{day_name} #{rhythm.hour}:00"
    }
  end

  defp generate_id(prefix) do
    timestamp = System.system_time(:millisecond) |> Integer.to_string()
    random = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    "#{prefix}_#{timestamp}_#{random}"
  end
end
