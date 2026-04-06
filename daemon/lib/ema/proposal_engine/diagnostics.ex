defmodule Ema.ProposalEngine.Diagnostics do
  @moduledoc false

  @key {__MODULE__, :state}
  @tick_window_s 150

  def snapshot do
    Map.merge(default_state(), :persistent_term.get(@key, %{}))
  end

  def record_scheduler_tick(attrs \\ %{}) do
    merge(
      %{
        last_scheduler_tick_at: now_iso(),
        scheduler_tick_count: snapshot().scheduler_tick_count + 1
      }
      |> Map.merge(attrs)
    )
  end

  def record_dispatch(seed) do
    merge(%{
      last_dispatch_at: now_iso(),
      last_seed_id: seed.id,
      last_seed_name: seed.name,
      last_generation: %{
        status: :dispatched,
        seed_id: seed.id,
        seed_name: seed.name,
        at: now_iso()
      }
    })
  end

  def record_generation_ok(seed, proposal) do
    merge(%{
      last_generation: %{
        status: :ok,
        class: :ok,
        seed_id: seed.id,
        seed_name: seed.name,
        proposal_id: proposal.id,
        at: now_iso()
      }
    })
  end

  def record_generation_error(seed, reason) do
    merge(%{
      last_generation: %{
        status: :error,
        class: classify(reason),
        seed_id: seed.id,
        seed_name: seed.name,
        reason: inspect(reason, pretty: false, limit: 20),
        at: now_iso()
      }
    })
  end

  def derived_status(scheduler, active_seed_count, due_now_count) do
    diag = snapshot()
    last_generation = diag.last_generation || %{}

    recent_tick =
      recent_iso?(diag.last_scheduler_tick_at || scheduler[:last_tick_at], @tick_window_s)

    cond do
      last_generation[:status] == :error and last_generation[:class] == :ai_backend_auth_failure ->
        %{state: "ai_backend_auth_failure", fail_closed: true}

      last_generation[:status] == :error and
          last_generation[:class] == :command_construction_or_fallback_failure ->
        %{state: "command_construction_or_fallback_failure", fail_closed: true}

      scheduler[:paused] == false and recent_tick and
          (active_seed_count == 0 or due_now_count == 0) ->
        %{state: "scheduler_healthy_but_starved", fail_closed: false}

      scheduler[:paused] == false and recent_tick ->
        %{state: "scheduler_running", fail_closed: false}

      true ->
        %{state: "scheduler_not_advancing", fail_closed: true}
    end
  end

  defp merge(attrs) do
    :persistent_term.put(@key, Map.merge(snapshot(), attrs))
    :ok
  end

  defp classify(reason) do
    text = reason |> inspect(pretty: false, limit: 50) |> String.downcase()

    cond do
      String.contains?(text, "oauth") or String.contains?(text, "expired") or
        String.contains?(text, "authenticate") or String.contains?(text, "401") ->
        :ai_backend_auth_failure

      String.contains?(text, "codex_not_found") or String.contains?(text, "script_not_found") or
        String.contains?(text, "enoent") or String.contains?(text, "command") or
        String.contains?(text, "spawn") or String.contains?(text, "executable") ->
        :command_construction_or_fallback_failure

      true ->
        :unknown_generation_failure
    end
  end

  defp recent_iso?(nil, _window_s), do: false

  defp recent_iso?(%DateTime{} = dt, window_s),
    do: DateTime.diff(DateTime.utc_now(), dt, :second) <= window_s

  defp recent_iso?(iso, window_s) when is_binary(iso) do
    case DateTime.from_iso8601(iso) do
      {:ok, dt, _} -> recent_iso?(dt, window_s)
      _ -> false
    end
  end

  defp recent_iso?(_, _), do: false

  defp now_iso, do: DateTime.utc_now() |> DateTime.truncate(:second) |> DateTime.to_iso8601()

  defp default_state do
    %{
      scheduler_tick_count: 0,
      last_scheduler_tick_at: nil,
      last_dispatch_at: nil,
      last_seed_id: nil,
      last_seed_name: nil,
      last_generation: nil
    }
  end
end
