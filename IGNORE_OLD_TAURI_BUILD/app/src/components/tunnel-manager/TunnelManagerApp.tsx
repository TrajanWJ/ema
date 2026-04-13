import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { APP_CONFIGS } from "@/types/workspace";
import { useTunnelStore } from "@/stores/tunnel-store";

const config = APP_CONFIGS["tunnel-manager"];

const card = {
  background: "rgba(14,16,23,0.55)",
  backdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  padding: 16,
  marginBottom: 12,
} as const;

const inputStyle = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "8px 12px",
  color: "var(--pn-text-primary)",
  width: "100%",
  outline: "none",
  fontSize: 13,
} as const;

const btnPrimary = {
  background: "#2DD4A8",
  color: "#000",
  border: "none",
  borderRadius: 8,
  padding: "8px 16px",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
} as const;

const STATUS_COLORS: Record<string, string> = {
  active: "#2DD4A8",
  inactive: "var(--pn-text-secondary)",
  error: "#f87171",
};

export function TunnelManagerApp() {
  const { tunnels, loading, error, loadViaRest, createTunnel, killTunnel } =
    useTunnelStore();

  const [showForm, setShowForm] = useState(false);
  const [localPort, setLocalPort] = useState("");
  const [remoteHost, setRemoteHost] = useState("");
  const [remotePort, setRemotePort] = useState("");
  const [sshHost, setSshHost] = useState("");

  useEffect(() => {
    loadViaRest();
  }, [loadViaRest]);

  const handleCreate = () => {
    const lp = parseInt(localPort, 10);
    const rp = parseInt(remotePort, 10);
    if (isNaN(lp) || !remoteHost.trim() || isNaN(rp) || !sshHost.trim())
      return;
    createTunnel({
      local_port: lp,
      remote_host: remoteHost.trim(),
      remote_port: rp,
      ssh_host: sshHost.trim(),
    });
    setLocalPort("");
    setRemoteHost("");
    setRemotePort("");
    setSshHost("");
    setShowForm(false);
  };

  return (
    <AppWindowChrome appId="tunnel-manager" title={config.title} icon={config.icon} accent={config.accent}>
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <h2
          style={{
            color: "var(--pn-text-primary)",
            fontSize: 16,
            fontWeight: 600,
            margin: 0,
          }}
        >
          Tunnels
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            fontSize: 12,
            fontWeight: 500,
            padding: "6px 12px",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            background: showForm
              ? "rgba(239,68,68,0.12)"
              : "rgba(107,149,240,0.12)",
            color: showForm ? "#ef4444" : "#6B95F0",
          }}
        >
          {showForm ? "Cancel" : "+ New Tunnel"}
        </button>
      </div>

      {error && (
        <div
          style={{
            marginBottom: 12,
            padding: "8px 12px",
            borderRadius: 8,
            background: "rgba(239,68,68,0.1)",
            color: "#ef4444",
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      {showForm && (
        <div style={card}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              marginBottom: 10,
            }}
          >
            <input
              value={localPort}
              onChange={(e) => setLocalPort(e.target.value)}
              placeholder="Local port *"
              type="number"
              style={inputStyle}
            />
            <input
              value={remoteHost}
              onChange={(e) => setRemoteHost(e.target.value)}
              placeholder="Remote host *"
              style={inputStyle}
            />
            <input
              value={remotePort}
              onChange={(e) => setRemotePort(e.target.value)}
              placeholder="Remote port *"
              type="number"
              style={inputStyle}
            />
            <input
              value={sshHost}
              onChange={(e) => setSshHost(e.target.value)}
              placeholder="SSH host *"
              style={inputStyle}
            />
          </div>
          <button onClick={handleCreate} style={btnPrimary}>
            Connect
          </button>
        </div>
      )}

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {loading && tunnels.length === 0 && (
          <div
            style={{
              color: "var(--pn-text-secondary)",
              fontSize: 13,
              textAlign: "center",
              marginTop: 32,
            }}
          >
            Loading...
          </div>
        )}

        {tunnels.map((tunnel) => (
          <div
            key={tunnel.pid}
            style={{
              ...card,
              padding: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background:
                      STATUS_COLORS[tunnel.status] ?? "var(--pn-text-secondary)",
                    display: "inline-block",
                  }}
                />
                <span
                  style={{
                    color: "var(--pn-text-primary)",
                    fontSize: 14,
                    fontWeight: 500,
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                >
                  :{tunnel.local_port} &rarr; {tunnel.remote_host}:
                  {tunnel.remote_port}
                </span>
              </div>
              <div
                style={{
                  color: "var(--pn-text-secondary)",
                  fontSize: 11,
                  marginLeft: 16,
                }}
              >
                via {tunnel.ssh_host} &middot; pid {tunnel.pid}
              </div>
            </div>
            <button
              onClick={() => killTunnel(tunnel.pid)}
              style={{
                background: "rgba(248,113,113,0.12)",
                color: "#f87171",
                border: "none",
                borderRadius: 6,
                padding: "6px 12px",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 500,
              }}
            >
              Kill
            </button>
          </div>
        ))}

        {!loading && tunnels.length === 0 && (
          <div
            style={{
              color: "var(--pn-text-secondary)",
              fontSize: 13,
              textAlign: "center",
              marginTop: 32,
            }}
          >
            No tunnels yet
          </div>
        )}
      </div>
    </div>
    </AppWindowChrome>
  );
}
