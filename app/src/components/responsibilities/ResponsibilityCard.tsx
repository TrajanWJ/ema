import { useState } from "react";
import type { Responsibility } from "@/types/responsibilities";
import { CheckInDialog } from "./CheckInDialog";

const HEALTH_COLORS: Record<string, string> = {
  good: "#22c55e",
  warning: "#f59e0b",
  danger: "#ef4444",
};

function healthLevel(health: number): string {
  if (health >= 0.7) return "good";
  if (health >= 0.4) return "warning";
  return "danger";
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface ResponsibilityCardProps {
  readonly responsibility: Responsibility;
}

export function ResponsibilityCard({ responsibility }: ResponsibilityCardProps) {
  const [showCheckIn, setShowCheckIn] = useState(false);
  const level = healthLevel(responsibility.health);
  const color = HEALTH_COLORS[level];

  return (
    <div className="glass-surface rounded-lg p-3 mb-2">
      <div className="flex items-center gap-2 mb-1">
        <span
          className="rounded-full shrink-0"
          style={{ width: "8px", height: "8px", background: color }}
        />
        <span
          className="text-[0.8rem] font-medium flex-1"
          style={{ color: "var(--pn-text-primary)" }}
        >
          {responsibility.title}
        </span>
        <span
          className="text-[0.6rem] px-1.5 py-0.5 rounded-md font-mono"
          style={{
            background: "rgba(255, 255, 255, 0.04)",
            color: "var(--pn-text-tertiary)",
          }}
        >
          {responsibility.cadence}
        </span>
      </div>

      <div className="flex items-center justify-between mt-2">
        <span className="text-[0.65rem]" style={{ color: "var(--pn-text-tertiary)" }}>
          Last check-in: {formatRelativeTime(responsibility.last_checked_at)}
        </span>
        <button
          onClick={() => setShowCheckIn(!showCheckIn)}
          className="text-[0.65rem] px-2 py-0.5 rounded transition-opacity hover:opacity-80"
          style={{ background: "rgba(255, 255, 255, 0.05)", color: "var(--pn-text-secondary)" }}
        >
          Check In
        </button>
      </div>

      {showCheckIn && (
        <CheckInDialog
          responsibilityId={responsibility.id}
          onClose={() => setShowCheckIn(false)}
        />
      )}
    </div>
  );
}
