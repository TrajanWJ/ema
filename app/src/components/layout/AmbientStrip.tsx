import { useEffect, useState } from "react";

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
  return new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function AmbientStrip() {
  return (
    <div
      className="glass-ambient flex items-center justify-between px-4 shrink-0"
      style={{ height: "32px" }}
      data-tauri-drag-region=""
    >
      <span
        className="text-[0.65rem] font-medium tracking-wider"
        style={{ color: "var(--color-pn-secondary-400)" }}
      >
        place
      </span>
      <Clock />
      <span className="w-10" />
    </div>
  );
}
