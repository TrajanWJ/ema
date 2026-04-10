defmodule Ema.Standards.Checks do
  @moduledoc """
  The catalog of EMA best-practice checks. Each check has an `id`, a
  `description` (used by `ema standards explain`), and a `run/0` function
  that returns zero or more findings.

  A finding is a map with: `check_id`, `severity` (`:info | :warn | :error`),
  `summary`, and `details` (arbitrary map for the UI).
  """

  import Ecto.Query

  alias Ema.Repo

  @type severity :: :info | :warn | :error

  @type finding :: %{
          check_id: atom(),
          severity: severity(),
          summary: String.t(),
          details: map()
        }

  @type check :: %{
          id: atom(),
          description: String.t(),
          run: (-> finding() | [finding()] | nil)
        }

  @spec all() :: [check()]
  def all do
    [
      %{
        id: :orphaned_intents,
        description:
          "Intents with no parent and no children are orphans. Every intent " <>
            "should plug into a tree (vision -> goal -> project -> feature -> task).",
        run: &check_orphaned_intents/0
      },
      %{
        id: :stale_proposals,
        description:
          "Proposals queued for triage longer than 7 days. Approve, redirect, " <>
            "or kill — don't let the queue rot.",
        run: &check_stale_proposals/0
      },
      %{
        id: :unwritten_journal,
        description:
          "No journal entry written today. End-of-day journaling is part of " <>
            "the daily ritual.",
        run: &check_unwritten_journal/0
      },
      %{
        id: :loop_health,
        description:
          "Open loops at escalation level 3 (red) — they need attention or " <>
            "should be closed.",
        run: &check_loop_health/0
      },
      %{
        id: :budget_status,
        description:
          "Token spend has crossed an auto-degradation tier (50%/75%/90%).",
        run: &check_budget_status/0
      },
      %{
        id: :unprocessed_brain_dumps,
        description:
          "More than 20 unprocessed brain dump items — the inbox needs " <>
            "triage before it loses signal.",
        run: &check_unprocessed_brain_dumps/0
      }
    ]
  end

  ## Individual checks
  ## Each check is defensive: any failure becomes an empty result, never
  ## an exception. The Enforcer handles bubbled errors but checks should
  ## degrade gracefully so a missing module never blocks the sweep.

  defp check_orphaned_intents do
    safe(fn ->
      orphans =
        from(i in Ema.Intents.Intent,
          left_join: c in Ema.Intents.Intent,
          on: c.parent_id == i.id,
          where: is_nil(i.parent_id) and is_nil(c.id),
          where: i.status not in ["complete", "archived"],
          select: %{id: i.id, title: i.title, level: i.level},
          limit: 50
        )
        |> Repo.all()

      case orphans do
        [] ->
          nil

        list ->
          %{
            check_id: :orphaned_intents,
            severity: :warn,
            summary: "#{length(list)} orphaned intent(s) — link them to a parent goal",
            details: %{intents: list}
          }
      end
    end)
  end

  defp check_stale_proposals do
    safe(fn ->
      cutoff = DateTime.add(DateTime.utc_now(), -7 * 24 * 3600, :second)

      stale =
        from(p in Ema.Proposals.Proposal,
          where: p.status == "queued" and p.inserted_at < ^cutoff,
          select: %{id: p.id, title: p.title, inserted_at: p.inserted_at},
          limit: 50
        )
        |> Repo.all()

      case stale do
        [] ->
          nil

        list ->
          %{
            check_id: :stale_proposals,
            severity: :warn,
            summary: "#{length(list)} proposal(s) queued > 7 days — run `ema proposal triage`",
            details: %{proposals: list}
          }
      end
    end)
  end

  defp check_unwritten_journal do
    safe(fn ->
      today_start =
        DateTime.utc_now()
        |> DateTime.to_date()
        |> DateTime.new!(~T[00:00:00], "Etc/UTC")

      count =
        from(e in Ema.Journal.Entry, where: e.inserted_at >= ^today_start)
        |> Repo.aggregate(:count)

      if count == 0 do
        %{
          check_id: :unwritten_journal,
          severity: :info,
          summary: "No journal entry today — `ema journal write \"...\"`",
          details: %{}
        }
      end
    end)
  end

  defp check_loop_health do
    safe(fn ->
      red =
        from(l in Ema.Loops.Loop,
          where: l.status == "open" and l.escalation_level >= 3,
          select: %{id: l.id, title: l.title, level: l.escalation_level},
          limit: 50
        )
        |> Repo.all()

      case red do
        [] ->
          nil

        list ->
          %{
            check_id: :loop_health,
            severity: :error,
            summary: "#{length(list)} loop(s) at red escalation — close or act",
            details: %{loops: list}
          }
      end
    end)
  end

  defp check_budget_status do
    safe(fn ->
      cond do
        Code.ensure_loaded?(Ema.Intelligence.CostGovernor) and
            function_exported?(Ema.Intelligence.CostGovernor, :status, 0) ->
          case Ema.Intelligence.CostGovernor.status() do
            %{current_tier: tier, percent_used: pct}
            when tier in [:degraded, :restricted, :emergency] ->
              %{
                check_id: :budget_status,
                severity: severity_for_tier(tier),
                summary: "Cost governor at #{tier} (#{Float.round(pct * 100, 1)}% of budget)",
                details: %{tier: tier, pct_used: pct}
              }

            _ ->
              nil
          end

        true ->
          nil
      end
    end)
  end

  defp severity_for_tier(:degraded), do: :info
  defp severity_for_tier(:restricted), do: :warn
  defp severity_for_tier(:emergency), do: :error
  defp severity_for_tier(_), do: :info

  defp check_unprocessed_brain_dumps do
    safe(fn ->
      count =
        try do
          Ema.BrainDump.unprocessed_count()
        rescue
          _ -> 0
        end

      cond do
        count >= 50 ->
          %{
            check_id: :unprocessed_brain_dumps,
            severity: :warn,
            summary: "#{count} unprocessed brain dumps — inbox needs triage",
            details: %{count: count}
          }

        count >= 20 ->
          %{
            check_id: :unprocessed_brain_dumps,
            severity: :info,
            summary: "#{count} unprocessed brain dumps — consider a triage pass",
            details: %{count: count}
          }

        true ->
          nil
      end
    end)
  end

  ## Helpers

  defp safe(fun) do
    try do
      fun.()
    rescue
      _ -> nil
    catch
      _, _ -> nil
    end
  end
end
