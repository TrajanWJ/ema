import { useState, useEffect, useRef } from "react";
import { useFocusStore } from "@/stores/focus-store";
import { PRESET_DURATIONS } from "@/types/focus";
import type { FocusSession } from "@/types/focus";

interface FocusTimerProps {
  readonly session: FocusSession | null;
}

export function FocusTimer({ session }: FocusTimerProps) {
  const startSession = useFocusStore((s) => s.startSession);
  const endSession = useFocusStore((s) => s.endSession);
  const addBlock = useFocusStore((s) => s.addBlock);
  const endBlock = useFocusStore((s) => s.endBlock);

  const [selectedDuration, setSelectedDuration] = useState(PRESET_DURATIONS[0].ms);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Find the active block (no ended_at)
  const activeBlock = session?.blocks.find((b) => !b.ended_at) ?? null;
  const isWorking = activeBlock?.block_type === "work";
  const isOnBreak = activeBlock?.block_type === "break";
  const isActive = session !== null && !session.ended_at;

  // Calculate total work elapsed for this session
  const completedWorkMs = session?.blocks
    .filter((b) => b.block_type === "work" && b.elapsed_ms)
    .reduce((sum, b) => sum + (b.elapsed_ms ?? 0), 0) ?? 0;

  // Tick elapsed time for active block
  useEffect(() => {
    if (activeBlock && !activeBlock.ended_at) {
      const start = new Date(activeBlock.started_at).getTime();
      setElapsed(Date.now() - start);

      intervalRef.current = setInterval(() => {
        setElapsed(Date.now() - start);
      }, 1000);
    } else {
      setElapsed(0);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeBlock?.id, activeBlock?.ended_at]);

  const totalWorkMs = completedWorkMs + (isWorking ? elapsed : 0);
  const targetMs = session?.target_ms ?? selectedDuration;
  const progress = Math.min((totalWorkMs / targetMs) * 100, 100);

  function handleStart() {
    startSession(selectedDuration);
  }

  function handleStartWork() {
    if (!session) return;
    addBlock(session.id, "work");
  }

  function handleStartBreak() {
    if (!session) return;
    if (activeBlock) {
      endBlock(activeBlock.id);
    }
    addBlock(session.id, "break");
  }

  function handlePauseBlock() {
    if (!activeBlock) return;
    endBlock(activeBlock.id);
  }

  function handleEnd() {
    if (!session) return;
    endSession(session.id);
  }

  // Format ms to mm:ss
  function formatTimer(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  function formatTarget(ms: number): string {
    return `${Math.floor(ms / 60000)}m`;
  }

  if (!isActive) {
    // Start screen
    return (
      <div className="flex flex-col items-center gap-6 py-8">
        <div
          className="text-[3rem] font-mono font-light"
          style={{ color: "var(--pn-text-primary)" }}
        >
          {formatTarget(selectedDuration)}
        </div>

        {/* Duration presets */}
        <div className="flex items-center gap-2">
          {PRESET_DURATIONS.map((preset) => (
            <button
              key={preset.ms}
              onClick={() => setSelectedDuration(preset.ms)}
              className="px-3 py-1.5 rounded-md text-[0.75rem] font-mono transition-colors"
              style={{
                background: selectedDuration === preset.ms
                  ? "rgba(244, 63, 94, 0.12)"
                  : "rgba(255,255,255,0.03)",
                color: selectedDuration === preset.ms
                  ? "#f43f5e"
                  : "var(--pn-text-tertiary)",
                border: selectedDuration === preset.ms
                  ? "1px solid rgba(244, 63, 94, 0.20)"
                  : "1px solid var(--pn-border-subtle)",
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <button
          onClick={handleStart}
          className="px-6 py-2.5 rounded-lg text-[0.85rem] font-medium transition-all"
          style={{
            background: "rgba(244, 63, 94, 0.15)",
            color: "#f43f5e",
            border: "1px solid rgba(244, 63, 94, 0.25)",
          }}
        >
          Start Focus Session
        </button>
      </div>
    );
  }

  // Active session
  return (
    <div className="flex flex-col items-center gap-5 py-6">
      {/* Progress ring (simplified as a bar) */}
      <div className="relative w-full max-w-xs">
        <div
          className="w-full h-1.5 rounded-full overflow-hidden"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${progress}%`,
              background: isOnBreak
                ? "rgba(45, 212, 168, 0.6)"
                : "rgba(244, 63, 94, 0.7)",
            }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[0.6rem] font-mono" style={{ color: "var(--pn-text-muted)" }}>
            {formatTarget(totalWorkMs)} work
          </span>
          <span className="text-[0.6rem] font-mono" style={{ color: "var(--pn-text-muted)" }}>
            {formatTarget(targetMs)} target
          </span>
        </div>
      </div>

      {/* Timer display */}
      <div className="flex flex-col items-center gap-1">
        <span
          className="text-[0.65rem] font-mono uppercase tracking-widest"
          style={{
            color: isOnBreak ? "#2dd4a8" : isWorking ? "#f43f5e" : "var(--pn-text-tertiary)",
          }}
        >
          {isWorking ? "Working" : isOnBreak ? "Break" : "Paused"}
        </span>
        <div
          className="text-[3.5rem] font-mono font-light tabular-nums"
          style={{
            color: isOnBreak ? "#2dd4a8" : "#f43f5e",
          }}
        >
          {formatTimer(elapsed)}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        {!activeBlock ? (
          <button
            onClick={handleStartWork}
            className="px-4 py-2 rounded-lg text-[0.75rem] font-medium transition-colors"
            style={{
              background: "rgba(244, 63, 94, 0.12)",
              color: "#f43f5e",
              border: "1px solid rgba(244, 63, 94, 0.20)",
            }}
          >
            Resume Work
          </button>
        ) : isWorking ? (
          <>
            <button
              onClick={handlePauseBlock}
              className="px-4 py-2 rounded-lg text-[0.75rem] font-medium transition-colors"
              style={{
                background: "rgba(255,255,255,0.06)",
                color: "var(--pn-text-secondary)",
                border: "1px solid var(--pn-border-subtle)",
              }}
            >
              Pause
            </button>
            <button
              onClick={handleStartBreak}
              className="px-4 py-2 rounded-lg text-[0.75rem] font-medium transition-colors"
              style={{
                background: "rgba(45, 212, 168, 0.10)",
                color: "#2dd4a8",
                border: "1px solid rgba(45, 212, 168, 0.20)",
              }}
            >
              Break
            </button>
          </>
        ) : (
          <button
            onClick={handleStartWork}
            className="px-4 py-2 rounded-lg text-[0.75rem] font-medium transition-colors"
            style={{
              background: "rgba(244, 63, 94, 0.12)",
              color: "#f43f5e",
              border: "1px solid rgba(244, 63, 94, 0.20)",
            }}
          >
            Back to Work
          </button>
        )}

        <button
          onClick={handleEnd}
          className="px-4 py-2 rounded-lg text-[0.75rem] font-medium transition-colors"
          style={{
            background: "rgba(255,255,255,0.04)",
            color: "var(--pn-text-tertiary)",
            border: "1px solid var(--pn-border-subtle)",
          }}
        >
          End Session
        </button>
      </div>

      {/* Block history */}
      {session.blocks.length > 0 && (
        <div className="w-full max-w-xs flex flex-col gap-1 mt-2">
          <span className="text-[0.6rem] font-mono uppercase tracking-wider" style={{ color: "var(--pn-text-muted)" }}>
            Blocks
          </span>
          {session.blocks.map((block) => (
            <div
              key={block.id}
              className="flex items-center justify-between px-2 py-1 rounded text-[0.65rem] font-mono"
              style={{ background: "rgba(255,255,255,0.02)" }}
            >
              <span style={{
                color: block.block_type === "work" ? "rgba(244, 63, 94, 0.7)" : "rgba(45, 212, 168, 0.7)",
              }}>
                {block.block_type}
              </span>
              <span style={{ color: "var(--pn-text-tertiary)" }}>
                {block.elapsed_ms
                  ? formatTimer(block.elapsed_ms)
                  : block.ended_at
                    ? "--"
                    : formatTimer(elapsed)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
