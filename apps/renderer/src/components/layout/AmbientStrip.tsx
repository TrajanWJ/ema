import { useEffect, useState } from "react";

import { OrgSwitcher } from "@/components/org/OrgSwitcher";
import { closeWindow, maximizeWindow, minimizeWindow } from "@/lib/electron-bridge";

interface AmbientStripProps {
  readonly onOpenQuickCapture?: () => void;
}

function Clock() {
  const [time, setTime] = useState(() => formatTime());

  useEffect(() => {
    const id = setInterval(() => setTime(formatTime()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="text-[0.65rem] font-mono" style={{ color: "var(--pn-text-tertiary)" }}>
      {time}
    </span>
  );
}

function formatTime(): string {
  const now = new Date();
  const time = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const date = now.toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return `${time} · ${date}`;
}

export function AmbientStrip({ onOpenQuickCapture }: AmbientStripProps) {
  async function handleMinimize() {
    await minimizeWindow();
  }

  async function handleMaximize() {
    await maximizeWindow();
  }

  async function handleClose() {
    await closeWindow();
  }

  return (
    <div
      className="glass-ambient flex items-center justify-between px-4 shrink-0"
      style={{ height: "32px", borderBottom: "1px solid var(--pn-border-subtle)", WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <span
        className="text-[0.65rem] font-semibold tracking-wider uppercase"
        style={{ color: "var(--color-pn-primary-400)", letterSpacing: "0.12em" }}
      >
        ema
      </span>
      <Clock />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenQuickCapture}
          className="rounded-full px-2.5 py-1 text-[0.62rem] font-medium transition-opacity hover:opacity-90"
          style={{
            WebkitAppRegion: "no-drag",
            background: "rgba(107,149,240,0.12)",
            color: "#dbe7ff",
            border: "1px solid rgba(107,149,240,0.24)",
          } as React.CSSProperties}
        >
          Capture
        </button>
        <OrgSwitcher />
        <div className="flex items-center gap-2">
          <button
            onClick={handleMinimize}
            className="h-3 w-3 rounded-full opacity-80 transition-opacity hover:opacity-100"
            style={{ background: "#EAB308" }}
          />
          <button
            onClick={handleMaximize}
            className="h-3 w-3 rounded-full opacity-80 transition-opacity hover:opacity-100"
            style={{ background: "#22C55E" }}
          />
          <button
            onClick={handleClose}
            className="h-3 w-3 rounded-full opacity-80 transition-opacity hover:opacity-100"
            style={{ background: "#E24B4A" }}
          />
        </div>
      </div>
    </div>
  );
}
