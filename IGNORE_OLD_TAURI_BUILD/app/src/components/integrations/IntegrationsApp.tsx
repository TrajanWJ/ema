import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { useIntegrationsStore } from "@/stores/integrations-store";

const SERVICE_META = {
  github: { icon: "\uD83D\uDC19", label: "GitHub" },
  slack: { icon: "\uD83D\uDCAC", label: "Slack" },
  google_drive: { icon: "\uD83D\uDCC1", label: "Google Drive" },
} as const;

type ServiceKey = keyof typeof SERVICE_META;

function StatusBadge({ connected }: { readonly connected: boolean }) {
  return (
    <span
      className="px-2 py-0.5 rounded-full text-xs font-medium"
      style={{
        background: connected ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)",
        color: connected ? "#22C55E" : "var(--pn-text-tertiary)",
      }}
    >
      {connected ? "Connected" : "Not Connected"}
    </span>
  );
}

function ServiceCard({ serviceKey }: { readonly serviceKey: ServiceKey }) {
  const store = useIntegrationsStore();
  const status = store[serviceKey];
  const meta = SERVICE_META[serviceKey];
  const [token, setToken] = useState("");

  function handleConnect() {
    if (!token.trim()) return;
    store.connect(serviceKey, token.trim());
    setToken("");
  }

  return (
    <div className="glass-elevated rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{meta.icon}</span>
          <span className="text-sm font-medium" style={{ color: "var(--pn-text-primary)" }}>
            {meta.label}
          </span>
        </div>
        <StatusBadge connected={status.connected} />
      </div>

      {status.connected ? (
        <>
          <div className="flex flex-col gap-1 text-xs" style={{ color: "var(--pn-text-secondary)" }}>
            {serviceKey === "github" && (
              <>
                <span>@{status.username}</span>
                <span>{status.linked_repos ?? 0} repos linked</span>
              </>
            )}
            {serviceKey === "slack" && (
              <>
                <span>{status.workspace_name}</span>
                <span>#{status.notification_channel ?? "general"}</span>
              </>
            )}
            {serviceKey === "google_drive" && (
              <span>{status.linked_folders ?? 0} folders linked</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => store.disconnect(serviceKey)}
            className="mt-auto px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
            style={{
              background: "rgba(226,75,74,0.12)",
              color: "#E24B4A",
              border: "1px solid rgba(226,75,74,0.2)",
            }}
          >
            Disconnect
          </button>
        </>
      ) : (
        <div className="flex flex-col gap-2 mt-auto">
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste token..."
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{
              background: "var(--pn-field-bg)",
              border: "1px solid var(--pn-border-default)",
              color: "var(--pn-text-primary)",
              outline: "none",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleConnect();
            }}
          />
          <button
            type="button"
            onClick={handleConnect}
            className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
            style={{
              background: "rgba(45,212,168,0.15)",
              color: "var(--color-pn-primary-400)",
              border: "1px solid rgba(45,212,168,0.2)",
            }}
          >
            Connect
          </button>
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-xl p-5 h-48 animate-pulse"
          style={{ background: "rgba(255,255,255,0.04)" }}
        />
      ))}
    </div>
  );
}

export function IntegrationsApp() {
  const { loading, error, fetchStatus, github, slack, google_drive } = useIntegrationsStore();
  const allDisconnected = !github.connected && !slack.connected && !google_drive.connected;

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return (
    <AppWindowChrome appId="integrations" title="Integrations" icon="\uD83D\uDD17" accent="#4B7BE5">
      <div className="p-6 flex flex-col gap-5 h-full overflow-y-auto">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: "var(--pn-text-primary)" }}>
            Integrations
          </h1>
          <p className="text-xs mt-1" style={{ color: "var(--pn-text-secondary)" }}>
            Connect external services
          </p>
        </div>

        {error && (
          <div
            className="px-3 py-2 rounded-lg text-xs"
            style={{
              background: "rgba(226,75,74,0.1)",
              color: "#E24B4A",
              border: "1px solid rgba(226,75,74,0.15)",
            }}
          >
            {error}
          </div>
        )}

        {loading && allDisconnected ? (
          <LoadingSkeleton />
        ) : (
          <div className="grid grid-cols-3 gap-4">
            <ServiceCard serviceKey="github" />
            <ServiceCard serviceKey="slack" />
            <ServiceCard serviceKey="google_drive" />
          </div>
        )}
      </div>
    </AppWindowChrome>
  );
}
