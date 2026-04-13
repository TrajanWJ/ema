import { useEffect, useMemo, useState } from "react";

import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { GlassCard } from "@/components/ui/GlassCard";
import { openApp } from "@/lib/window-manager";
import { useCalendarStore } from "@/stores/calendar-store";
import { useHumanOpsStore } from "@/stores/human-ops-store";
import { useProjectsStore } from "@/stores/projects-store";
import type { CalendarEntry } from "@/types/calendar";
import type { HumanOpsAgendaDay, HumanOpsAgendaItem } from "@/types/human-ops";
import type { Project } from "@/types/projects";
import { APP_CONFIGS } from "@/types/workspace";

const config = APP_CONFIGS.agenda;

function todayKey(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDayLabel(date: string): string {
  const candidate = new Date(`${date}T12:00:00`);
  return candidate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(entry: CalendarEntry): string {
  const start = new Date(entry.starts_at).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  if (!entry.ends_at) return start;
  const end = new Date(entry.ends_at).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${start} - ${end}`;
}

function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

function nextDaySameTime(iso: string): string {
  const next = new Date(iso);
  next.setDate(next.getDate() + 1);
  return next.toISOString();
}

function SurfaceButton({
  label,
  onClick,
  tone = "neutral",
}: {
  readonly label: string;
  readonly onClick: () => void;
  readonly tone?: "neutral" | "primary" | "danger";
}) {
  const colors =
    tone === "primary"
      ? { background: "rgba(107, 149, 240, 0.18)", color: "#c9d8ff", border: "rgba(107,149,240,0.36)" }
      : tone === "danger"
        ? { background: "rgba(239, 68, 68, 0.12)", color: "#fecaca", border: "rgba(239,68,68,0.34)" }
        : { background: "rgba(255,255,255,0.04)", color: "var(--pn-text-secondary)", border: "rgba(255,255,255,0.08)" };
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md px-2.5 py-1.5 text-[0.68rem] font-medium transition-opacity hover:opacity-90"
      style={{ background: colors.background, color: colors.color, border: `1px solid ${colors.border}` }}
    >
      {label}
    </button>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  readonly label: string;
  readonly value: string;
  readonly tone: string;
}) {
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

export function AgendaApp() {
  const [anchorDate, setAnchorDate] = useState(todayKey());
  const [horizonDays, setHorizonDays] = useState<1 | 7>(7);
  const [ready, setReady] = useState(false);

  const agendas = useHumanOpsStore((state) => state.agendas);
  const loadAgenda = useHumanOpsStore((state) => state.loadAgenda);
  const loadBrief = useHumanOpsStore((state) => state.loadBrief);
  const setNowTask = useHumanOpsStore((state) => state.setNowTask);
  const projects = useProjectsStore((state) => state.projects);
  const updateEntry = useCalendarStore((state) => state.updateEntry);
  const calendarError = useCalendarStore((state) => state.error);
  const humanOpsError = useHumanOpsStore((state) => state.error);

  const agenda = agendas[`${anchorDate}:${horizonDays}`];
  const projectMap = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );

  useEffect(() => {
    let cancelled = false;
    async function init() {
      await Promise.all([
        useProjectsStore.getState().loadViaRest(),
        loadAgenda(anchorDate, horizonDays),
      ]);
      if (!cancelled) setReady(true);
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [anchorDate, horizonDays, loadAgenda]);

  const totalEntries = agenda?.days.reduce((count, day) => count + day.entries.length, 0) ?? 0;
  const totalHuman = agenda?.days.reduce((count, day) => count + day.human_count, 0) ?? 0;
  const totalAgent = agenda?.days.reduce((count, day) => count + day.agent_count, 0) ?? 0;
  const atRiskCount = agenda?.at_risk_entries.length ?? 0;

  async function refreshAgenda(): Promise<void> {
    await Promise.all([
      loadAgenda(anchorDate, horizonDays),
      loadBrief(todayKey()),
    ]);
  }

  async function shiftEntry(item: HumanOpsAgendaItem, minutes: number): Promise<void> {
    const nextStartsAt = addMinutes(item.entry.starts_at, minutes);
    const nextEndsAt = item.entry.ends_at ? addMinutes(item.entry.ends_at, minutes) : null;
    await updateEntry(item.entry.id, {
      starts_at: nextStartsAt,
      ends_at: nextEndsAt,
    });
    await refreshAgenda();
  }

  async function moveToTomorrow(item: HumanOpsAgendaItem): Promise<void> {
    const nextStartsAt = nextDaySameTime(item.entry.starts_at);
    const nextEndsAt = item.entry.ends_at ? nextDaySameTime(item.entry.ends_at) : null;
    await updateEntry(item.entry.id, {
      starts_at: nextStartsAt,
      ends_at: nextEndsAt,
      status: "scheduled",
    });
    await refreshAgenda();
  }

  async function markComplete(item: HumanOpsAgendaItem): Promise<void> {
    await updateEntry(item.entry.id, { status: "completed" });
    await refreshAgenda();
  }

  async function cancelEntry(item: HumanOpsAgendaItem): Promise<void> {
    await updateEntry(item.entry.id, { status: "cancelled" });
    await refreshAgenda();
  }

  function openDesk(): void {
    void openApp("desk");
  }

  if (!ready) {
    return (
      <AppWindowChrome appId="agenda" title={config.title} icon={config.icon} accent={config.accent}>
        <div className="flex h-full items-center justify-center">
          <span className="text-[0.8rem]" style={{ color: "var(--pn-text-secondary)" }}>
            Loading Agenda…
          </span>
        </div>
      </AppWindowChrome>
    );
  }

  return (
    <AppWindowChrome appId="agenda" title={config.title} icon={config.icon} accent={config.accent} breadcrumb={anchorDate}>
      <div className="flex flex-col gap-4">
        <GlassCard>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[0.65rem] uppercase tracking-[0.18em]" style={{ color: "var(--pn-text-muted)" }}>
                Personal OS
              </div>
              <h2 className="mt-1 text-[1.2rem] font-semibold" style={{ color: "var(--pn-text-primary)" }}>
                Agenda
              </h2>
              <p className="mt-2 max-w-3xl text-[0.82rem]" style={{ color: "var(--pn-text-secondary)" }}>
                Schedule and action surface over the real `calendar_entries` ledger. Desk remains the home surface;
                Agenda is where you move blocks, complete them, and see human and agent commitments together.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <SurfaceButton label="Open Desk" onClick={openDesk} />
              <SurfaceButton label="Today" tone={horizonDays === 1 ? "primary" : "neutral"} onClick={() => setHorizonDays(1)} />
              <SurfaceButton label="7 Days" tone={horizonDays === 7 ? "primary" : "neutral"} onClick={() => setHorizonDays(7)} />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <label className="text-[0.72rem]" style={{ color: "var(--pn-text-secondary)" }}>
              Anchor day
              <input
                type="date"
                value={anchorDate}
                onChange={(event) => setAnchorDate(event.target.value)}
                className="ml-2 rounded-md px-2 py-1 text-[0.72rem]"
                style={{ background: "var(--pn-surface-3)", color: "var(--pn-text-primary)", border: "1px solid var(--pn-border-default)" }}
              />
            </label>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric label="Entries" value={String(totalEntries)} tone="#f8fafc" />
            <Metric label="Human" value={String(totalHuman)} tone="#7ef0cd" />
            <Metric label="Agent" value={String(totalAgent)} tone="#c4b5fd" />
            <Metric label="At Risk" value={String(atRiskCount)} tone={atRiskCount > 0 ? "#fecaca" : "#94a3b8"} />
          </div>

          {[calendarError, humanOpsError].filter(Boolean).length > 0 && (
            <div className="mt-3 rounded-lg px-3 py-2 text-[0.72rem]" style={{ background: "rgba(239,68,68,0.12)", color: "#fecaca" }}>
              {[calendarError, humanOpsError].filter(Boolean).join(" · ")}
            </div>
          )}
        </GlassCard>

        {agenda?.at_risk_entries.length ? (
          <GlassCard title="Calendar Debt">
            <div className="flex flex-col gap-2">
              {agenda.at_risk_entries.slice(0, 5).map((item) => (
                <div key={item.entry.id} className="rounded-lg px-3 py-2 text-[0.74rem]" style={{ background: "rgba(239,68,68,0.08)", color: "#fecaca" }}>
                  {item.entry.title} · {formatDayLabel(item.date)} · {formatTime(item.entry)}
                </div>
              ))}
            </div>
          </GlassCard>
        ) : null}

        <div className="flex flex-col gap-4">
          {agenda?.days.map((day) => (
            <AgendaDaySection
              key={day.date}
              day={day}
              projectMap={projectMap}
              onShift={shiftEntry}
              onTomorrow={moveToTomorrow}
              onComplete={markComplete}
              onCancel={cancelEntry}
              onSetNow={(taskId) => void setNowTask(todayKey(), taskId).then(() => loadBrief(todayKey()))}
            />
          ))}
        </div>
      </div>
    </AppWindowChrome>
  );
}

function AgendaDaySection({
  day,
  projectMap,
  onShift,
  onTomorrow,
  onComplete,
  onCancel,
  onSetNow,
}: {
  readonly day: HumanOpsAgendaDay;
  readonly projectMap: Map<string, Project>;
  readonly onShift: (item: HumanOpsAgendaItem, minutes: number) => Promise<void>;
  readonly onTomorrow: (item: HumanOpsAgendaItem) => Promise<void>;
  readonly onComplete: (item: HumanOpsAgendaItem) => Promise<void>;
  readonly onCancel: (item: HumanOpsAgendaItem) => Promise<void>;
  readonly onSetNow: (taskId: string) => void;
}) {
  return (
    <GlassCard title={`${formatDayLabel(day.date)}${day.is_today ? " · Today" : ""}`}>
      {day.entries.length > 0 ? (
        <div className="flex flex-col gap-3">
          {day.entries.map((item) => (
            <AgendaEntryCard
              key={item.entry.id}
              item={item}
              project={item.task?.project_id ? projectMap.get(item.task.project_id) ?? null : item.entry.project_id ? projectMap.get(item.entry.project_id) ?? null : null}
              onShift={onShift}
              onTomorrow={onTomorrow}
              onComplete={onComplete}
              onCancel={onCancel}
              onSetNow={onSetNow}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border px-3 py-3 text-[0.74rem]" style={{ borderColor: "rgba(255,255,255,0.08)", color: "var(--pn-text-muted)" }}>
          No scheduled entries for this day.
        </div>
      )}
    </GlassCard>
  );
}

function AgendaEntryCard({
  item,
  project,
  onShift,
  onTomorrow,
  onComplete,
  onCancel,
  onSetNow,
}: {
  readonly item: HumanOpsAgendaItem;
  readonly project: Project | null;
  readonly onShift: (item: HumanOpsAgendaItem, minutes: number) => Promise<void>;
  readonly onTomorrow: (item: HumanOpsAgendaItem) => Promise<void>;
  readonly onComplete: (item: HumanOpsAgendaItem) => Promise<void>;
  readonly onCancel: (item: HumanOpsAgendaItem) => Promise<void>;
  readonly onSetNow: (taskId: string) => void;
}) {
  const ownerTone =
    item.entry.owner_kind === "agent"
      ? { background: "rgba(196,181,253,0.14)", color: "#ddd6fe", label: item.entry.owner_id }
      : { background: "rgba(45,212,168,0.12)", color: "#b8ffe6", label: "human" };

  return (
    <div className="rounded-lg px-3 py-3" style={{ background: item.is_happening_now ? "rgba(107,149,240,0.08)" : "rgba(255,255,255,0.03)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[0.78rem] font-medium" style={{ color: "var(--pn-text-primary)" }}>
              {item.entry.title}
            </span>
            <span className="rounded-full px-2 py-0.5 text-[0.62rem]" style={ownerTone}>
              {ownerTone.label}
            </span>
            {item.entry.phase ? (
              <span className="rounded-full px-2 py-0.5 text-[0.62rem]" style={{ background: "rgba(255,255,255,0.05)", color: "var(--pn-text-secondary)" }}>
                {item.entry.phase}
              </span>
            ) : null}
            {item.is_overdue ? (
              <span className="rounded-full px-2 py-0.5 text-[0.62rem]" style={{ background: "rgba(239,68,68,0.12)", color: "#fecaca" }}>
                at risk
              </span>
            ) : null}
            {item.is_happening_now ? (
              <span className="rounded-full px-2 py-0.5 text-[0.62rem]" style={{ background: "rgba(107,149,240,0.18)", color: "#c9d8ff" }}>
                now
              </span>
            ) : null}
          </div>
          <div className="mt-1 text-[0.66rem]" style={{ color: "var(--pn-text-muted)" }}>
            {formatTime(item.entry)} · {item.entry.entry_kind} · {item.entry.status}
          </div>
          {item.task || item.goal || project ? (
            <div className="mt-2 flex flex-wrap gap-2 text-[0.66rem]" style={{ color: "var(--pn-text-secondary)" }}>
              {item.task ? <span>Task: {item.task.title}</span> : null}
              {item.goal ? <span>Goal: {item.goal.title}</span> : null}
              {project ? <span>Project: {project.name}</span> : null}
            </div>
          ) : null}
          {item.entry.description ? (
            <div className="mt-2 text-[0.7rem]" style={{ color: "var(--pn-text-secondary)" }}>
              {item.entry.description}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {item.task && item.is_today && item.entry.owner_kind === "human" ? (
          <SurfaceButton label="Set task as now" tone="primary" onClick={() => onSetNow(item.task!.id)} />
        ) : null}
        {item.entry.status !== "completed" && item.entry.status !== "cancelled" ? (
          <>
            <SurfaceButton label="+15m" onClick={() => void onShift(item, 15)} />
            <SurfaceButton label="+1h" onClick={() => void onShift(item, 60)} />
            <SurfaceButton label="Tomorrow" onClick={() => void onTomorrow(item)} />
            <SurfaceButton label="Complete" tone="primary" onClick={() => void onComplete(item)} />
            <SurfaceButton label="Cancel" tone="danger" onClick={() => void onCancel(item)} />
          </>
        ) : null}
      </div>
    </div>
  );
}
