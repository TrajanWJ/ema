import { useEffect, useState } from "react";
import { AmbientStrip } from "./AmbientStrip";
import { Sidebar } from "./Sidebar";
import { CommandBar } from "./CommandBar";
import { useDashboardStore } from "@/stores/dashboard-store";
import { useBrainDumpStore } from "@/stores/brain-dump-store";
import { useHabitsStore } from "@/stores/habits-store";
import { useSettingsStore } from "@/stores/settings-store";

type Page = "dashboard" | "brain-dump" | "habits" | "journal" | "settings";

interface ShellProps {
  readonly activePage: Page;
  readonly onNavigate: (page: Page) => void;
  readonly children: React.ReactNode;
}

export function Shell({ activePage, onNavigate, children }: ShellProps) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        await Promise.all([
          useDashboardStore.getState().connect(),
          useBrainDumpStore.getState().connect(),
          useHabitsStore.getState().connect(),
          useSettingsStore.getState().connect(),
        ]);
        if (!cancelled) setReady(true);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Connection failed");
        }
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  if (!ready) {
    return (
      <div
        className="h-screen flex items-center justify-center"
        style={{ background: "var(--color-pn-base)" }}
      >
        <span className="text-[0.8rem]" style={{ color: "var(--pn-text-secondary)" }}>
          {error ? `Connection error: ${error}` : "Connecting to daemon..."}
        </span>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--color-pn-base)" }}>
      <AmbientStrip />
      <div className="flex flex-1 min-h-0">
        <Sidebar activePage={activePage} onNavigate={onNavigate} />
        <main className="flex-1 overflow-auto p-4">{children}</main>
      </div>
      <CommandBar />
    </div>
  );
}
