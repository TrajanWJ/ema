import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { useOrgStore } from "@/stores/org-store";
import { APP_CONFIGS } from "@/types/workspace";
import { OrgDashboard } from "./OrgDashboard";
import { OrgSettings } from "./OrgSettings";
import { CreateOrgForm } from "./CreateOrgForm";
import { JoinFlow } from "./JoinFlow";
import type { Organization } from "@/types/org";

const config = APP_CONFIGS.org;

type View = "list" | "dashboard" | "settings" | "create" | "join";

export function OrgApp() {
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("list");
  const orgs = useOrgStore((s) => s.orgs);
  const activeOrg = useOrgStore((s) => s.activeOrg);
  const setActiveOrg = useOrgStore((s) => s.setActiveOrg);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      await useOrgStore.getState().loadViaRest();
      if (!cancelled) setReady(true);
      useOrgStore.getState().connect().catch(() => {
        console.warn("Org WebSocket failed, using REST");
      });
    }
    init();
    return () => { cancelled = true; };
  }, []);

  function selectOrg(org: Organization) {
    setActiveOrg(org);
    setView("dashboard");
  }

  if (!ready) {
    return (
      <AppWindowChrome appId="org" title={config.title} icon={config.icon} accent={config.accent}>
        <div className="flex items-center justify-center h-full">
          <span className="text-[0.8rem]" style={{ color: "var(--pn-text-secondary)" }}>Loading...</span>
        </div>
      </AppWindowChrome>
    );
  }

  const breadcrumb =
    view === "create" ? "New" :
    view === "join" ? "Join" :
    view === "settings" && activeOrg ? activeOrg.name + " / Settings" :
    view === "dashboard" && activeOrg ? activeOrg.name :
    "Organizations";

  return (
    <AppWindowChrome appId="org" title={config.title} icon={config.icon} accent={config.accent} breadcrumb={breadcrumb}>
      <div className="flex flex-col h-full">
        {view === "create" && (
          <CreateOrgForm
            onBack={() => setView("list")}
            onCreated={(org) => { selectOrg(org); }}
          />
        )}

        {view === "join" && (
          <JoinFlow
            onBack={() => setView("list")}
            onJoined={() => {
              useOrgStore.getState().loadViaRest();
              setView("list");
            }}
          />
        )}

        {view === "settings" && activeOrg && (
          <OrgSettings
            org={activeOrg}
            onBack={() => setView("dashboard")}
          />
        )}

        {view === "dashboard" && activeOrg && (
          <OrgDashboard
            org={activeOrg}
            onBack={() => { setActiveOrg(null); setView("list"); }}
            onSettings={() => setView("settings")}
          />
        )}

        {view === "list" && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[0.9rem] font-semibold" style={{ color: "var(--pn-text-primary)" }}>
                Organizations
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setView("join")}
                  className="text-[0.65rem] font-medium px-2.5 py-1 rounded"
                  style={{ background: "rgba(107, 149, 240, 0.12)", color: "#6b95f0" }}
                >
                  Join
                </button>
                <button
                  onClick={() => setView("create")}
                  className="text-[0.65rem] font-medium px-2.5 py-1 rounded"
                  style={{ background: "rgba(45, 212, 168, 0.12)", color: "#2dd4a8" }}
                >
                  + New Org
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-auto space-y-2">
              {orgs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <span className="text-[1.5rem]">&#x2B21;</span>
                  <p className="text-[0.75rem]" style={{ color: "var(--pn-text-tertiary)" }}>
                    No organizations yet
                  </p>
                </div>
              ) : (
                orgs.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => selectOrg(org)}
                    className="w-full glass-surface rounded-lg p-3 text-left transition-all duration-200 hover:bg-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-[0.9rem] font-semibold shrink-0"
                        style={{
                          background: "rgba(45, 212, 168, 0.12)",
                          color: "#2dd4a8",
                        }}
                      >
                        {org.avatar_url ? (
                          <img src={org.avatar_url} alt="" className="w-full h-full rounded-lg object-cover" />
                        ) : (
                          org.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[0.8rem] font-medium truncate" style={{ color: "var(--pn-text-primary)" }}>
                          {org.name}
                        </div>
                        {org.description && (
                          <div className="text-[0.65rem] truncate" style={{ color: "var(--pn-text-tertiary)" }}>
                            {org.description}
                          </div>
                        )}
                      </div>
                      <span className="text-[0.6rem]" style={{ color: "var(--pn-text-muted)" }}>
                        {org.slug}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </AppWindowChrome>
  );
}
