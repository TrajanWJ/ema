import { useEffect, useMemo, useState } from "react";

import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { GlassCard } from "@/components/ui/GlassCard";
import { openApp } from "@/lib/window-manager";
import { useBrainDumpStore } from "@/stores/brain-dump-store";
import { useCalendarStore } from "@/stores/calendar-store";
import { useGoalsStore } from "@/stores/goals-store";
import { useHumanOpsStore } from "@/stores/human-ops-store";
import { useProjectsStore } from "@/stores/projects-store";
import { useTasksStore } from "@/stores/tasks-store";
import { useUserStateStore } from "@/stores/user-state-store";
import type { InboxItem } from "@/types/brain-dump";
import type { CalendarEntry } from "@/types/calendar";
import type { Goal } from "@/types/goals";
import type { HumanOpsAgentScheduleGroup } from "@/types/human-ops";
import type { Project } from "@/types/projects";
import type { Task } from "@/types/tasks";
import type { UserStateMode } from "@/types/user-state";
import { APP_CONFIGS } from "@/types/workspace";

const config = APP_CONFIGS.desk;
const OPEN_STATUSES: readonly Task["status"][] = [
  "proposed",
  "todo",
  "in_progress",
  "blocked",
  "in_review",
  "requires_proposal",
];

function dateKey(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayBounds(now = new Date()): { from: string; to: string } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
}

function score(value: number | undefined, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}

function parseDateish(value: string | null): number {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const candidate =
    /^\d{4}-\d{2}-\d{2}$/u.test(value) ? new Date(`${value}T23:59:59`) : new Date(value);
  const time = candidate.getTime();
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (Math.abs(mins) < 1) return "just now";
  if (Math.abs(mins) < 60) return mins > 0 ? `${mins}m ago` : `in ${Math.abs(mins)}m`;
  const hrs = Math.round(mins / 60);
  if (Math.abs(hrs) < 24) return hrs > 0 ? `${hrs}h ago` : `in ${Math.abs(hrs)}h`;
  const days = Math.round(hrs / 24);
  return days > 0 ? `${days}d ago` : `in ${Math.abs(days)}d`;
}

function nextHalfHour(): string {
  const now = new Date();
  now.setSeconds(0, 0);
  if (now.getMinutes() < 30) {
    now.setMinutes(30);
  } else {
    now.setHours(now.getHours() + 1, 0);
  }
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function formatCommitment(entry: CalendarEntry): string {
  const start = new Date(entry.starts_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (!entry.ends_at) return start;
  const end = new Date(entry.ends_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${start} - ${end}`;
}

function SurfaceButton({
  label,
  onClick,
  tone = "neutral",
  type = "button",
}: {
  readonly label: string;
  readonly onClick: () => void;
  readonly tone?: "neutral" | "primary" | "danger";
  readonly type?: "button" | "submit";
}) {
  const colors =
    tone === "primary"
      ? { background: "rgba(107, 149, 240, 0.18)", color: "#c9d8ff", border: "rgba(107,149,240,0.36)" }
      : tone === "danger"
        ? { background: "rgba(239, 68, 68, 0.12)", color: "#fecaca", border: "rgba(239,68,68,0.34)" }
        : { background: "rgba(255,255,255,0.04)", color: "var(--pn-text-secondary)", border: "rgba(255,255,255,0.08)" };
  return (
    <button
      type={type}
      onClick={onClick}
      className="rounded-md px-2.5 py-1.5 text-[0.68rem] font-medium transition-opacity hover:opacity-90"
      style={{ background: colors.background, color: colors.color, border: `1px solid ${colors.border}` }}
    >
      {label}
    </button>
  );
}

function Metric({ label, value, tone }: { readonly label: string; readonly value: string; readonly tone: string }) {
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="text-[0.62rem] uppercase tracking-[0.18em]" style={{ color: "var(--pn-text-muted)" }}>
        {label}
      </div>
      <div className="mt-1 text-[0.95rem] font-semibold" style={{ color: tone }}>
        {value}
      </div>
    </div>
  );
}

export function DeskApp() {
  const [capture, setCapture] = useState("");
  const [commitmentTitle, setCommitmentTitle] = useState("");
  const [commitmentTime, setCommitmentTime] = useState(nextHalfHour());
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [modeDraft, setModeDraft] = useState<UserStateMode>("unknown");
  const [focusDraft, setFocusDraft] = useState(0.5);
  const [energyDraft, setEnergyDraft] = useState(0.5);
  const [driftDraft, setDriftDraft] = useState(0.5);
  const [distressDraft, setDistressDraft] = useState(false);

  const today = dateKey();
  const bounds = useMemo(() => todayBounds(), []);

  const items = useBrainDumpStore((state) => state.items);
  const promoteInboxItem = useBrainDumpStore((state) => state.promoteToTask);
  const tasks = useTasksStore((state) => state.tasks);
  const goals = useGoalsStore((state) => state.goals);
  const projects = useProjectsStore((state) => state.projects);
  const commitments = useCalendarStore((state) => state.entries);
  const calendarLoading = useCalendarStore((state) => state.loading);
  const calendarError = useCalendarStore((state) => state.error);
  const currentUserState = useUserStateStore((state) => state.state);
  const userStateHistory = useUserStateStore((state) => state.history);
  const userStateError = useUserStateStore((state) => state.error);
  const humanOpsDays = useHumanOpsStore((state) => state.days);
  const humanOpsBriefs = useHumanOpsStore((state) => state.briefs);
  const humanOpsLoading = useHumanOpsStore((state) => state.loading);
  const humanOpsSaving = useHumanOpsStore((state) => state.saving);
  const humanOpsError = useHumanOpsStore((state) => state.error);
  const storageMode = useHumanOpsStore((state) => state.storageMode);
  const loadBrief = useHumanOpsStore((state) => state.loadBrief);
  const loadDay = useHumanOpsStore((state) => state.loadDay);
  const setPlan = useHumanOpsStore((state) => state.setPlan);
  const setLinkedGoal = useHumanOpsStore((state) => state.setLinkedGoal);
  const setNowTask = useHumanOpsStore((state) => state.setNowTask);
  const togglePinnedTask = useHumanOpsStore((state) => state.togglePinnedTask);
  const setReviewNote = useHumanOpsStore((state) => state.setReviewNote);
  const resetDay = useHumanOpsStore((state) => state.resetDay);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        await Promise.all([
          useBrainDumpStore.getState().loadViaRest(),
          useTasksStore.getState().loadViaRest(),
          useGoalsStore.getState().loadViaRest(),
          useProjectsStore.getState().loadViaRest(),
          useCalendarStore.getState().loadViaRest({
            owner_kind: "human",
            owner_id: "self",
            from: bounds.from,
            to: bounds.to,
          }),
          useUserStateStore.getState().loadCurrent(),
          useUserStateStore.getState().loadHistory(8),
          loadDay(today),
          loadBrief(today),
        ]);
      } catch {
        // Per-domain stores expose their own error state.
      }
      if (cancelled) return;
      useBrainDumpStore.getState().connect().catch(() => undefined);
      useTasksStore.getState().connect().catch(() => undefined);
      useGoalsStore.getState().connect().catch(() => undefined);
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [bounds.from, bounds.to, loadBrief, loadDay, today]);

  useEffect(() => {
    if (!currentUserState) return;
    setModeDraft(currentUserState.mode);
    setFocusDraft(score(currentUserState.focus_score, 0.5));
    setEnergyDraft(score(currentUserState.energy_score, 0.5));
    setDriftDraft(score(currentUserState.drift_score, 0.5));
    setDistressDraft(currentUserState.distress_flag);
  }, [currentUserState]);

  const day = humanOpsDays[today] ?? {
    date: today,
    plan: "",
    linked_goal_id: null,
    now_task_id: null,
    pinned_task_ids: [],
    review_note: "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const brief = humanOpsBriefs[today];

  const inbox = brief?.inbox ?? useMemo(() => items.filter((item) => !item.processed), [items]);
  const fallbackOpenTasks = useMemo(
    () =>
      [...tasks]
        .filter((task) => OPEN_STATUSES.includes(task.status))
        .sort((left, right) => {
          const dueCompare = parseDateish(left.due_date) - parseDateish(right.due_date);
          if (dueCompare !== 0) return dueCompare;
          if (left.priority !== right.priority) return right.priority - left.priority;
          return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
        }),
    [tasks],
  );
  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const goalMap = useMemo(() => new Map(goals.map((goal) => [goal.id, goal])), [goals]);
  const openTasks = brief?.actionable_tasks ?? fallbackOpenTasks;
  const linkedGoal = brief?.linked_goal ?? (day.linked_goal_id ? goalMap.get(day.linked_goal_id) ?? null : null);
  const pinnedTasks =
    brief?.pinned_tasks ??
    day.pinned_task_ids
      .map((taskId) => openTasks.find((task) => task.id === taskId) ?? null)
      .filter((task): task is Task => task !== null);
  const nowTask = brief?.now_task ?? (day.now_task_id ? openTasks.find((task) => task.id === day.now_task_id) ?? null : null);
  const overdueTasks = brief?.overdue_tasks ?? openTasks.filter((task) => parseDateish(task.due_date) < Date.now());
  const suggestedTasks = brief?.suggested_tasks ?? openTasks.filter((task) => !day.pinned_task_ids.includes(task.id)).slice(0, 5);
  const nextAction = brief?.next_action_label ?? nowTask?.title ?? overdueTasks[0]?.title ?? pinnedTasks[0]?.title ?? suggestedTasks[0]?.title ?? "Process the inbox";
  const activeGoals = brief?.active_goals ?? goals.filter((goal) => goal.status === "active");
  const recentWins =
    brief?.recent_wins ??
    [...tasks]
      .filter((task) => task.status === "done" && task.completed_at)
      .sort(
        (left, right) =>
          new Date(right.completed_at ?? right.created_at).getTime() -
          new Date(left.completed_at ?? left.created_at).getTime(),
      )
      .slice(0, 5);
  const recoveryItems =
    brief?.recovery_items ??
    [
      ...(distressDraft || modeDraft === "crisis" ? ["Reduce scope to one thing and renegotiate the rest."] : []),
      ...(overdueTasks.length > 0 ? [`${overdueTasks.length} overdue task${overdueTasks.length === 1 ? "" : "s"} need rescoping or completion.`] : []),
      ...(inbox.length >= 5 ? [`Inbox is carrying ${inbox.length} loose items. Triage before adding more structure.`] : []),
      ...(!nowTask && openTasks.length > 0 ? ["Pick one current task so the system can tell the truth about now."] : []),
      ...(commitments.length === 0 ? ["No commitment block exists for today yet. Add one before the day fragments."] : []),
    ].slice(0, 4);
  const agentSchedule = brief?.agent_schedule ?? [];
  const commitmentsAtRisk = brief?.commitments_at_risk ?? [];

  async function refreshCommitments(): Promise<void> {
    await Promise.all([
      useCalendarStore.getState().loadViaRest({
        owner_kind: "human",
        owner_id: "self",
        from: bounds.from,
        to: bounds.to,
      }),
      loadBrief(today),
    ]);
  }

  async function createCommitment(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    const title = commitmentTitle.trim() || nowTask?.title || linkedGoal?.title;
    if (!title) return;
    const [hours, minutes] = commitmentTime.split(":").map((part) => Number.parseInt(part, 10));
    const start = new Date();
    start.setHours(hours, minutes, 0, 0);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + durationMinutes);
    await useCalendarStore.getState().createEntry({
      title,
      description: linkedGoal ? `Linked goal: ${linkedGoal.title}` : nowTask?.description ?? null,
      entry_kind: nowTask ? "human_focus_block" : "human_commitment",
      owner_kind: "human",
      owner_id: "self",
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      goal_id: linkedGoal?.id ?? null,
      task_id: nowTask?.id ?? null,
      project_id: nowTask?.project_id ?? null,
    });
    setCommitmentTitle("");
    await refreshCommitments();
  }

  async function quickBlock(task: Task): Promise<void> {
    const start = new Date();
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + 30);
    await useCalendarStore.getState().createEntry({
      title: task.title,
      description: task.description,
      entry_kind: "human_focus_block",
      owner_kind: "human",
      owner_id: "self",
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      goal_id: linkedGoal?.id ?? null,
      task_id: task.id,
      project_id: task.project_id,
    });
    await refreshCommitments();
  }

  async function submitCapture(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    const trimmed = capture.trim();
    if (!trimmed) return;
    await useBrainDumpStore.getState().add(trimmed);
    setCapture("");
    await loadBrief(today);
  }

  async function transitionTaskAndRefresh(taskId: string, status: Task["status"]): Promise<void> {
    await useTasksStore.getState().transitionTask(taskId, status);
    await useTasksStore.getState().loadViaRest();
    await loadBrief(today);
  }

  async function archiveInboxAndRefresh(itemId: string): Promise<void> {
    await useBrainDumpStore.getState().process(itemId, "archive");
    await useBrainDumpStore.getState().loadViaRest();
    await loadBrief(today);
  }

  async function deleteInboxAndRefresh(itemId: string): Promise<void> {
    await useBrainDumpStore.getState().remove(itemId);
    await useBrainDumpStore.getState().loadViaRest();
    await loadBrief(today);
  }

  async function saveCheckIn(): Promise<void> {
    await useUserStateStore.getState().updateState({
      mode: modeDraft,
      focus_score: focusDraft,
      energy_score: energyDraft,
      drift_score: driftDraft,
      distress_flag: distressDraft,
      updated_by: "self",
      reason: "desk_check_in",
    });
    await useUserStateStore.getState().loadHistory(8);
    await loadBrief(today);
  }

  function openSurface(appId: string): void {
    void openApp(appId);
  }

  return (
    <AppWindowChrome appId="desk" title={config.title} icon={config.icon} accent={config.accent} breadcrumb={today}>
      <div className="flex flex-col gap-4">
        <GlassCard className="overflow-hidden">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[0.65rem] uppercase tracking-[0.18em]" style={{ color: "var(--pn-text-muted)" }}>
                Human Ops
              </div>
              <h2 className="mt-1 text-[1.2rem] font-semibold" style={{ color: "var(--pn-text-primary)" }}>
                Desk
              </h2>
              <p className="mt-2 max-w-3xl text-[0.82rem]" style={{ color: "var(--pn-text-secondary)" }}>
                One day-1 surface for capture, triage, planning, commitments, check-ins, and recovery. The day object
                is now backend-backed with local fallback.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <SurfaceButton label="Brain Dump" onClick={() => openSurface("brain-dump")} />
              <SurfaceButton label="Agenda" onClick={() => openSurface("agenda")} />
              <SurfaceButton label="Tasks" onClick={() => openSurface("tasks")} />
              <SurfaceButton label="Goals" onClick={() => openSurface("goals")} />
              <SurfaceButton label="Projects" onClick={() => openSurface("projects")} />
              <SurfaceButton label="Executions" onClick={() => openSurface("executions")} />
              <SurfaceButton label="Proposals" onClick={() => openSurface("proposals")} />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
            <Metric label="Inbox" value={String(inbox.length)} tone="#fb923c" />
            <Metric label="Open Tasks" value={String(openTasks.length)} tone="#9bb8ff" />
            <Metric label="Overdue" value={String(overdueTasks.length)} tone={overdueTasks.length > 0 ? "#fecaca" : "#94a3b8"} />
            <Metric label="Commitments" value={String(commitments.length)} tone="#7ef0cd" />
            <Metric label="Agent Blocks" value={String(agentSchedule.reduce((count, group) => count + group.entries.length, 0))} tone="#c4b5fd" />
            <Metric label="Next" value={nextAction} tone="#f8fafc" />
          </div>

          <div className="mt-3 text-[0.68rem]" style={{ color: storageMode === "backend" ? "#7ef0cd" : "var(--pn-text-muted)" }}>
            {humanOpsLoading ? "Loading day object…" : humanOpsSaving ? "Saving day object…" : storageMode === "backend" ? "Day object synced to backend." : "Using local fallback cache."}
          </div>

          {[calendarError, userStateError, humanOpsError].filter(Boolean).length > 0 && (
            <div className="mt-3 rounded-lg px-3 py-2 text-[0.72rem]" style={{ background: "rgba(239,68,68,0.12)", color: "#fecaca" }}>
              {[calendarError, userStateError, humanOpsError].filter(Boolean).join(" · ")}
            </div>
          )}
        </GlassCard>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="flex flex-col gap-4 xl:col-span-4">
            <GlassCard title="Capture + Triage">
              <form onSubmit={submitCapture} className="flex gap-2">
                <input
                  value={capture}
                  onChange={(event) => setCapture(event.target.value)}
                  placeholder="Dump the loose thought before it disappears"
                  className="min-w-0 flex-1 rounded-lg px-3 py-2 text-[0.78rem] outline-none"
                  style={{ background: "var(--pn-surface-3)", color: "var(--pn-text-primary)", border: "1px solid var(--pn-border-default)" }}
                />
                <SurfaceButton label="Capture" onClick={() => undefined} tone="primary" type="submit" />
              </form>

              <div className="mt-3 flex flex-col gap-2">
                {inbox.slice(0, 6).map((item) => (
                  <InboxRow
                    key={item.id}
                    item={item}
                    onTask={() => void promoteInboxItem(item.id).then(() => loadBrief(today))}
                    onArchive={() => void archiveInboxAndRefresh(item.id)}
                    onDelete={() => void deleteInboxAndRefresh(item.id)}
                  />
                ))}
                {inbox.length === 0 && (
                  <div className="rounded-lg border px-3 py-3 text-[0.75rem]" style={{ borderColor: "rgba(255,255,255,0.08)", color: "var(--pn-text-muted)" }}>
                    Inbox is clear.
                  </div>
                )}
              </div>
            </GlassCard>

            <GlassCard title="Recovery">
              <div className="flex flex-col gap-2">
                {recoveryItems.length > 0 ? recoveryItems.map((item) => (
                  <div key={item} className="rounded-lg px-3 py-2 text-[0.74rem]" style={{ background: "rgba(255,255,255,0.03)", color: "var(--pn-text-secondary)" }}>
                    {item}
                  </div>
                )) : (
                  <div className="rounded-lg px-3 py-2 text-[0.74rem]" style={{ background: "rgba(45,212,168,0.08)", color: "#b8ffe6" }}>
                    No acute recovery signal. Protect the plan instead of widening it.
                  </div>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <SurfaceButton label="I am overwhelmed" tone="danger" onClick={() => void useUserStateStore.getState().signal("self_report_overwhelm", "desk_manual_trigger").then(() => loadBrief(today))} />
                <SurfaceButton label="I am in flow" tone="primary" onClick={() => void useUserStateStore.getState().signal("self_report_flow", "desk_manual_trigger").then(() => loadBrief(today))} />
                <SurfaceButton label="Reset day" onClick={() => void resetDay(today)} />
              </div>

              {commitmentsAtRisk.length > 0 && (
                <div className="mt-3 flex flex-col gap-2">
                  <div className="text-[0.65rem] uppercase tracking-[0.18em]" style={{ color: "var(--pn-text-muted)" }}>
                    At-Risk Commitments
                  </div>
                  {commitmentsAtRisk.map((entry) => (
                    <div key={entry.id} className="rounded-lg px-3 py-2 text-[0.72rem]" style={{ background: "rgba(239,68,68,0.08)", color: "#fecaca" }}>
                      {entry.title} · {formatCommitment(entry)}
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>

          <div className="flex flex-col gap-4 xl:col-span-4">
            <GlassCard title="Today">
              <div className="rounded-lg border px-3 py-3" style={{ borderColor: "rgba(107,149,240,0.24)", background: "rgba(107,149,240,0.06)" }}>
                <div className="text-[0.64rem] uppercase tracking-[0.18em]" style={{ color: "var(--pn-text-muted)" }}>
                  What Should I Do Now?
                </div>
                <div className="mt-1 text-[1rem] font-semibold" style={{ color: "#dbe7ff" }}>
                  {nextAction}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {nowTask ? (
                    <>
                      <SurfaceButton label="In progress" tone="primary" onClick={() => void transitionTaskAndRefresh(nowTask.id, "in_progress")} />
                      <SurfaceButton label="Done" onClick={() => void transitionTaskAndRefresh(nowTask.id, "done")} />
                      <SurfaceButton label="Block 30m" onClick={() => void quickBlock(nowTask)} />
                    </>
                  ) : suggestedTasks[0] ? (
                    <SurfaceButton label="Set top task as now" tone="primary" onClick={() => void setNowTask(today, suggestedTasks[0].id)} />
                  ) : (
                    <SurfaceButton label="Open inbox" onClick={() => openSurface("brain-dump")} />
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-2">
                {(pinnedTasks.length > 0 ? pinnedTasks : suggestedTasks).slice(0, 5).map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    project={task.project_id ? projectMap.get(task.project_id) ?? null : null}
                    isPinned={day.pinned_task_ids.includes(task.id)}
                    isNow={day.now_task_id === task.id}
                    onPin={() => void togglePinnedTask(today, task.id)}
                    onSetNow={() => void setNowTask(today, task.id)}
                    onDone={() => void transitionTaskAndRefresh(task.id, "done")}
                    onBlock={() => void quickBlock(task)}
                  />
                ))}
              </div>
            </GlassCard>

            <GlassCard title="Daily Note">
              <div className="mb-2 text-[0.72rem]" style={{ color: "var(--pn-text-secondary)" }}>
                Daily planning note tied to a real day object, current goal, and current task.
              </div>
              <textarea
                value={day.plan}
                onChange={(event) => void setPlan(today, event.target.value)}
                placeholder="Plan the day, note blockers, record outcomes."
                className="min-h-[180px] w-full rounded-lg px-3 py-3 text-[0.8rem] outline-none"
                style={{ background: "var(--pn-surface-3)", color: "var(--pn-text-primary)", border: "1px solid var(--pn-border-default)" }}
              />
              <div className="mt-3 flex flex-wrap gap-2 text-[0.68rem]" style={{ color: "var(--pn-text-muted)" }}>
                <span>Linked goal: {linkedGoal?.title ?? "none"}</span>
                <span>·</span>
                <span>Now task: {nowTask?.title ?? "none"}</span>
              </div>
            </GlassCard>
          </div>

          <div className="flex flex-col gap-4 xl:col-span-4">
            <GlassCard title="Check-In">
              <div className="flex flex-wrap gap-2">
                {(["focused", "scattered", "resting", "crisis", "unknown"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setModeDraft(mode)}
                    className="rounded-full px-3 py-1.5 text-[0.68rem] font-medium transition-all"
                    style={{
                      background: modeDraft === mode ? "rgba(45,212,168,0.18)" : "rgba(255,255,255,0.04)",
                      color: modeDraft === mode ? "#7ef0cd" : "var(--pn-text-secondary)",
                      border: modeDraft === mode ? "1px solid rgba(45,212,168,0.35)" : "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              <div className="mt-4 flex flex-col gap-3">
                <ScoreSlider label="Focus" value={focusDraft} onChange={setFocusDraft} />
                <ScoreSlider label="Energy" value={energyDraft} onChange={setEnergyDraft} />
                <ScoreSlider label="Drift" value={driftDraft} onChange={setDriftDraft} />
              </div>

              <label className="mt-4 flex items-center justify-between rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.03)" }}>
                <span className="text-[0.74rem]" style={{ color: "var(--pn-text-secondary)" }}>
                  Distress flag
                </span>
                <input type="checkbox" checked={distressDraft} onChange={(event) => setDistressDraft(event.target.checked)} />
              </label>

              <div className="mt-3 flex gap-2">
                <SurfaceButton label="Save check-in" tone="primary" onClick={() => void saveCheckIn()} />
                <SurfaceButton label="Refresh history" onClick={() => void useUserStateStore.getState().loadHistory(8)} />
              </div>

              <div className="mt-4 flex flex-col gap-2">
                {userStateHistory.slice(0, 5).map((entry) => (
                  <div key={`${entry.updated_at}-${entry.reason}`} className="rounded-lg px-3 py-2 text-[0.72rem]" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <div style={{ color: "var(--pn-text-primary)" }}>
                      {entry.mode} · focus {Math.round(score(entry.focus_score, 0) * 100)} · energy {Math.round(score(entry.energy_score, 0) * 100)}
                    </div>
                    <div style={{ color: "var(--pn-text-muted)" }}>
                      {entry.reason} · {relTime(entry.updated_at)}
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>

            <GlassCard title="Commitments + Goal Context">
              <form onSubmit={createCommitment} className="grid grid-cols-1 gap-2">
                <input
                  value={commitmentTitle}
                  onChange={(event) => setCommitmentTitle(event.target.value)}
                  placeholder="Commitment or focus block title"
                  className="rounded-lg px-3 py-2 text-[0.78rem] outline-none"
                  style={{ background: "var(--pn-surface-3)", color: "var(--pn-text-primary)", border: "1px solid var(--pn-border-default)" }}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="time"
                    value={commitmentTime}
                    onChange={(event) => setCommitmentTime(event.target.value)}
                    className="rounded-lg px-3 py-2 text-[0.78rem] outline-none"
                    style={{ background: "var(--pn-surface-3)", color: "var(--pn-text-primary)", border: "1px solid var(--pn-border-default)" }}
                  />
                  <select
                    value={durationMinutes}
                    onChange={(event) => setDurationMinutes(Number.parseInt(event.target.value, 10))}
                    className="rounded-lg px-3 py-2 text-[0.78rem] outline-none"
                    style={{ background: "var(--pn-surface-3)", color: "var(--pn-text-primary)", border: "1px solid var(--pn-border-default)" }}
                  >
                    <option value={30}>30m</option>
                    <option value={45}>45m</option>
                    <option value={60}>60m</option>
                    <option value={90}>90m</option>
                  </select>
                </div>
                <select
                  value={day.linked_goal_id ?? ""}
                  onChange={(event) => void setLinkedGoal(today, event.target.value || null)}
                  className="rounded-lg px-3 py-2 text-[0.78rem] outline-none"
                  style={{ background: "var(--pn-surface-3)", color: "var(--pn-text-primary)", border: "1px solid var(--pn-border-default)" }}
                >
                  <option value="">No linked goal</option>
                  {activeGoals.map((goal) => (
                    <option key={goal.id} value={goal.id}>
                      {goal.title}
                    </option>
                  ))}
                </select>
                <SurfaceButton label="Add commitment" onClick={() => undefined} tone="primary" type="submit" />
              </form>

              <div className="mt-4 flex flex-col gap-2">
                {calendarLoading ? (
                  <div className="text-[0.75rem]" style={{ color: "var(--pn-text-muted)" }}>
                    Loading commitments…
                  </div>
                ) : commitments.length > 0 ? (
                  commitments.map((entry) => (
                    <CommitmentRow
                      key={entry.id}
                      entry={entry}
                      goal={entry.goal_id ? goalMap.get(entry.goal_id) ?? null : null}
                      onComplete={() => void useCalendarStore.getState().updateEntry(entry.id, { status: "completed" }).then(refreshCommitments)}
                      onCancel={() => void useCalendarStore.getState().updateEntry(entry.id, { status: "cancelled" }).then(refreshCommitments)}
                      onDelete={() => void useCalendarStore.getState().removeEntry(entry.id).then(refreshCommitments)}
                    />
                  ))
                ) : (
                  <div className="rounded-lg border px-3 py-3 text-[0.74rem]" style={{ borderColor: "rgba(255,255,255,0.08)", color: "var(--pn-text-muted)" }}>
                    No commitments yet for today.
                  </div>
                )}
              </div>

              <div className="mt-4">
                <div className="mb-2 text-[0.65rem] uppercase tracking-[0.18em]" style={{ color: "var(--pn-text-muted)" }}>
                  Agent Agenda
                </div>
                <div className="mb-3 flex flex-wrap gap-2">
                  <SurfaceButton label="Executions" onClick={() => openSurface("executions")} />
                  <SurfaceButton label="Agents" onClick={() => openSurface("agents")} />
                  <SurfaceButton label="Proposals" onClick={() => openSurface("proposals")} />
                  <SurfaceButton label="Feeds" onClick={() => openSurface("feeds")} />
                </div>
                <div className="flex flex-col gap-2">
                  {agentSchedule.length > 0 ? agentSchedule.map((group) => (
                    <AgentAgendaGroup key={group.owner_id} group={group} />
                  )) : (
                    <div className="rounded-lg border px-3 py-3 text-[0.74rem]" style={{ borderColor: "rgba(255,255,255,0.08)", color: "var(--pn-text-muted)" }}>
                      No agent buildout blocks scheduled for today.
                    </div>
                  )}
                </div>
              </div>
            </GlassCard>
          </div>
        </div>

        <GlassCard title="Review Seeds">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-2">
              <div className="text-[0.65rem] uppercase tracking-[0.18em]" style={{ color: "var(--pn-text-muted)" }}>
                Recent completions
              </div>
              {recentWins.length > 0 ? recentWins.map((task) => (
                <div key={task.id} className="rounded-lg px-3 py-2 text-[0.74rem]" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <div style={{ color: "var(--pn-text-primary)" }}>{task.title}</div>
                  <div style={{ color: "var(--pn-text-muted)" }}>{relTime(task.completed_at ?? task.created_at)}</div>
                </div>
              )) : (
                <div className="rounded-lg px-3 py-2 text-[0.74rem]" style={{ background: "rgba(255,255,255,0.03)", color: "var(--pn-text-muted)" }}>
                  No recent completions yet.
                </div>
              )}
            </div>

            <div>
              <div className="text-[0.65rem] uppercase tracking-[0.18em] mb-2" style={{ color: "var(--pn-text-muted)" }}>
                Review note
              </div>
              <textarea
                value={day.review_note}
                onChange={(event) => void setReviewNote(today, event.target.value)}
                placeholder="What moved, what slipped, what needs follow-up?"
                className="min-h-[150px] w-full rounded-lg px-3 py-3 text-[0.8rem] outline-none"
                style={{ background: "var(--pn-surface-3)", color: "var(--pn-text-primary)", border: "1px solid var(--pn-border-default)" }}
              />
            </div>
          </div>
        </GlassCard>
      </div>
    </AppWindowChrome>
  );
}

function InboxRow({
  item,
  onTask,
  onArchive,
  onDelete,
}: {
  readonly item: InboxItem;
  readonly onTask: () => void;
  readonly onArchive: () => void;
  readonly onDelete: () => void;
}) {
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.03)" }}>
      <div className="text-[0.76rem]" style={{ color: "var(--pn-text-primary)" }}>
        {item.content}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[0.64rem]" style={{ color: "var(--pn-text-muted)" }}>
          {relTime(item.created_at)}
        </span>
        <div className="flex gap-2">
          <SurfaceButton label="Task" tone="primary" onClick={onTask} />
          <SurfaceButton label="Archive" onClick={onArchive} />
          <SurfaceButton label="Delete" tone="danger" onClick={onDelete} />
        </div>
      </div>
    </div>
  );
}

function TaskRow({
  task,
  project,
  isPinned,
  isNow,
  onPin,
  onSetNow,
  onDone,
  onBlock,
}: {
  readonly task: Task;
  readonly project: Project | null;
  readonly isPinned: boolean;
  readonly isNow: boolean;
  readonly onPin: () => void;
  readonly onSetNow: () => void;
  readonly onDone: () => void;
  readonly onBlock: () => void;
}) {
  return (
    <div className="rounded-lg px-3 py-3" style={{ background: isNow ? "rgba(107,149,240,0.08)" : "rgba(255,255,255,0.03)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[0.78rem] font-medium" style={{ color: "var(--pn-text-primary)" }}>
            {task.title}
          </div>
          <div className="mt-1 text-[0.66rem]" style={{ color: "var(--pn-text-muted)" }}>
            {project?.name ?? "No project"} · {task.status}
            {task.due_date ? ` · due ${task.due_date}` : ""}
          </div>
        </div>
        <div className="text-[0.62rem]" style={{ color: isNow ? "#9bb8ff" : "var(--pn-text-muted)" }}>
          {isNow ? "NOW" : isPinned ? "PINNED" : ""}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <SurfaceButton label={isPinned ? "Unpin" : "Pin"} onClick={onPin} />
        <SurfaceButton label={isNow ? "Current" : "Set now"} tone="primary" onClick={onSetNow} />
        <SurfaceButton label="Block 30m" onClick={onBlock} />
        <SurfaceButton label="Done" onClick={onDone} />
      </div>
    </div>
  );
}

function ScoreSlider({
  label,
  value,
  onChange,
}: {
  readonly label: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[0.72rem]">
        <span style={{ color: "var(--pn-text-secondary)" }}>{label}</span>
        <span style={{ color: "var(--pn-text-muted)" }}>{Math.round(value * 100)}</span>
      </div>
      <input type="range" min={0} max={1} step={0.05} value={value} onChange={(event) => onChange(Number.parseFloat(event.target.value))} />
    </label>
  );
}

function CommitmentRow({
  entry,
  goal,
  onComplete,
  onCancel,
  onDelete,
}: {
  readonly entry: CalendarEntry;
  readonly goal: Goal | null;
  readonly onComplete: () => void;
  readonly onCancel: () => void;
  readonly onDelete: () => void;
}) {
  return (
    <div className="rounded-lg px-3 py-3" style={{ background: "rgba(255,255,255,0.03)" }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[0.78rem] font-medium" style={{ color: "var(--pn-text-primary)" }}>
            {entry.title}
          </div>
          <div className="mt-1 text-[0.66rem]" style={{ color: "var(--pn-text-muted)" }}>
            {formatCommitment(entry)} · {entry.entry_kind}
            {goal ? ` · ${goal.title}` : ""}
          </div>
        </div>
        <div className="text-[0.64rem]" style={{ color: "var(--pn-text-muted)" }}>
          {entry.status}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {entry.status !== "completed" && <SurfaceButton label="Complete" tone="primary" onClick={onComplete} />}
        {entry.status !== "cancelled" && <SurfaceButton label="Cancel" onClick={onCancel} />}
        <SurfaceButton label="Delete" tone="danger" onClick={onDelete} />
      </div>
    </div>
  );
}

function AgentAgendaGroup({
  group,
}: {
  readonly group: HumanOpsAgentScheduleGroup;
}) {
  return (
    <div className="rounded-lg px-3 py-3" style={{ background: "rgba(255,255,255,0.03)" }}>
      <div className="text-[0.68rem] uppercase tracking-[0.18em]" style={{ color: "#c4b5fd" }}>
        {group.owner_id}
      </div>
      <div className="mt-2 flex flex-col gap-2">
        {group.entries.map((entry) => (
          <div key={entry.id} className="rounded-md px-2.5 py-2" style={{ background: "rgba(255,255,255,0.03)" }}>
            <div className="text-[0.74rem]" style={{ color: "var(--pn-text-primary)" }}>
              {entry.title}
            </div>
            <div className="text-[0.66rem]" style={{ color: "var(--pn-text-muted)" }}>
              {formatCommitment(entry)}
              {entry.phase ? ` · ${entry.phase}` : ""}
              {entry.status ? ` · ${entry.status}` : ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
