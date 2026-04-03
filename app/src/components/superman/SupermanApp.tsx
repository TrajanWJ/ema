import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useSupermanStore } from "@/stores/superman-store";
import { useProjectsStore } from "@/stores/projects-store";
import { APP_CONFIGS } from "@/types/workspace";
import { HQTab } from "./HQTab";
import { IndexTab } from "./IndexTab";
import { AskTab } from "./AskTab";
import { GapsTab } from "./GapsTab";
import { FlowsTab } from "./FlowsTab";
import { IntentTab } from "./IntentTab";
import { AutonomousTab } from "./AutonomousTab";

const config = APP_CONFIGS["superman"];

const TABS = [
  { value: "hq" as const, label: "HQ" },
  { value: "index" as const, label: "Index" },
  { value: "ask" as const, label: "Ask" },
  { value: "gaps" as const, label: "Gaps" },
  { value: "flows" as const, label: "Flows" },
  { value: "intent" as const, label: "Intent" },
  { value: "autonomous" as const, label: "Auto" },
] as const;

type Tab = (typeof TABS)[number]["value"];

export function SupermanApp() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("hq");
  const serverStatus = useSupermanStore((s) => s.serverStatus);
  const checkHealth = useSupermanStore((s) => s.checkHealth);

  useEffect(() => {
    async function init() {
      await useProjectsStore.getState().loadViaRest();
      await checkHealth();
      setReady(true);
      useSupermanStore.getState().connect().catch(() => {});
    }
    init();
  }, [checkHealth]);

  if (!ready) {
    return (
      <AppWindowChrome appId="superman" title={config.title} icon={config.icon} accent={config.accent}>
        <div className="flex items-center justify-center h-full">
          <span className="text-[0.8rem]" style={{ color: "var(--pn-text-secondary)" }}>
            Loading...
          </span>
        </div>
      </AppWindowChrome>
    );
  }

  return (
    <AppWindowChrome appId="superman" title={config.title} icon={config.icon} accent={config.accent}>
      <div className="flex flex-col gap-3 h-full">
        {/* Header bar */}
        <div className="flex items-center justify-between">
          <SegmentedControl options={[...TABS]} value={tab} onChange={setTab} />
          <StatusDot status={serverStatus} />
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-auto">
          {tab === "hq" && <HQTab />}
          {tab === "index" && <IndexTab />}
          {tab === "ask" && <AskTab />}
          {tab === "gaps" && <GapsTab />}
          {tab === "flows" && <FlowsTab />}
          {tab === "intent" && <IntentTab />}
          {tab === "autonomous" && <AutonomousTab />}
        </div>
      </div>
    </AppWindowChrome>
  );
}

function StatusDot({ status }: { readonly status: string }) {
  const color =
    status === "connected"
      ? "#22C55E"
      : status === "checking"
        ? "#EAB308"
        : "#EF4444";
  const label =
    status === "connected"
      ? "Superman Online"
      : status === "checking"
        ? "Checking..."
        : "Superman Offline";

  return (
    <div className="flex items-center gap-1.5">
      <span
        className="inline-block rounded-full"
        style={{
          width: "7px",
          height: "7px",
          background: color,
          boxShadow: `0 0 6px ${color}60`,
        }}
      />
      <span className="text-[0.65rem] font-mono" style={{ color: "var(--pn-text-tertiary)" }}>
        {label}
      </span>
    </div>
  );
}
