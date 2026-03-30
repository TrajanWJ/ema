import { useEffect, useState, useMemo } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { useResponsibilitiesStore } from "@/stores/responsibilities-store";
import { APP_CONFIGS } from "@/types/workspace";
import { RoleGroup } from "./RoleGroup";
import { ResponsibilityForm } from "./ResponsibilityForm";

const config = APP_CONFIGS["responsibilities"];

export function ResponsibilitiesApp() {
  const [ready, setReady] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const responsibilities = useResponsibilitiesStore((s) => s.responsibilities);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      await useResponsibilitiesStore.getState().loadViaRest();
      if (!cancelled) setReady(true);
      useResponsibilitiesStore.getState().connect().catch(() => {
        console.warn("Responsibilities WebSocket failed, using REST");
      });
    }
    init();
    return () => { cancelled = true; };
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof responsibilities[number][]>();
    for (const r of responsibilities) {
      const list = map.get(r.role) ?? [];
      list.push(r);
      map.set(r.role, list);
    }
    return map;
  }, [responsibilities]);

  if (!ready) {
    return (
      <AppWindowChrome appId="responsibilities" title={config.title} icon={config.icon} accent={config.accent}>
        <div className="flex items-center justify-center h-full">
          <span className="text-[0.8rem]" style={{ color: "var(--pn-text-secondary)" }}>Loading...</span>
        </div>
      </AppWindowChrome>
    );
  }

  return (
    <AppWindowChrome appId="responsibilities" title={config.title} icon={config.icon} accent={config.accent} breadcrumb="Roles">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[0.875rem] font-medium" style={{ color: "var(--pn-text-primary)" }}>
          Responsibilities
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-[0.7rem] px-3 py-1 rounded-md transition-opacity hover:opacity-80"
          style={{ background: "#f59e0b", color: "#fff" }}
        >
          + New
        </button>
      </div>

      {showForm && <ResponsibilityForm onClose={() => setShowForm(false)} />}

      {grouped.size === 0 ? (
        <div className="flex items-center justify-center py-12">
          <span className="text-[0.75rem]" style={{ color: "var(--pn-text-tertiary)" }}>
            No responsibilities yet. Add one to get started.
          </span>
        </div>
      ) : (
        Array.from(grouped.entries()).map(([role, items]) => (
          <RoleGroup key={role} role={role} responsibilities={items} />
        ))
      )}
    </AppWindowChrome>
  );
}
