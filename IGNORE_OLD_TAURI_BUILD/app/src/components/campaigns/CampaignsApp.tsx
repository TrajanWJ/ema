import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { api } from "@/lib/api";
import { APP_CONFIGS } from "@/types/workspace";

const config = APP_CONFIGS["campaigns"];

// ─── Types ───────────────────────────────────────────────────────────────────

interface Step {
  id: string;
  label: string;
  agent_id: string;
  prompt_template: string;
  dependencies: string[];
}

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  steps: Step[];
  status: "draft" | "active" | "archived";
  run_count: number;
  inserted_at: string;
  updated_at: string;
}

interface StepStatus {
  status: "pending" | "running" | "completed" | "failed";
  result: string | null;
}

interface CampaignRun {
  id: string;
  campaign_id: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  step_statuses: Record<string, StepStatus>;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  inserted_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const statusColor = (s: string) =>
  s === "active" || s === "completed"
    ? "#22c55e"
    : s === "running"
    ? "#3b82f6"
    : s === "failed"
    ? "#ef4444"
    : s === "draft" || s === "pending"
    ? "rgba(255,255,255,0.35)"
    : "#f59e0b";

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString() : "—";

// ─── Step Editor ─────────────────────────────────────────────────────────────

function StepEditor({
  step,
  onChange,
  onDelete,
}: {
  step: Step;
  allSteps: Step[];
  onChange: (s: Step) => void;
  onDelete: () => void;
}) {
  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 6,
    padding: "6px 10px",
    color: "#fff",
    fontSize: 12,
    outline: "none",
    marginTop: 4,
    boxSizing: "border-box",
  };

  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: 12, marginBottom: 10, background: "rgba(255,255,255,0.03)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 11, opacity: 0.5 }}>Step {step.id}</span>
        <button onClick={onDelete} style={{ background: "rgba(239,68,68,0.15)", border: "none", borderRadius: 4, color: "#f87171", fontSize: 11, padding: "2px 8px", cursor: "pointer" }}>
          Remove
        </button>
      </div>
      <div style={{ marginBottom: 6 }}>
        <label style={{ fontSize: 11, opacity: 0.6 }}>Label</label>
        <input style={inputStyle} value={step.label} onChange={(e) => onChange({ ...step, label: e.target.value })} placeholder="e.g. Summarize email" />
      </div>
      <div style={{ marginBottom: 6 }}>
        <label style={{ fontSize: 11, opacity: 0.6 }}>Agent ID</label>
        <input style={inputStyle} value={step.agent_id} onChange={(e) => onChange({ ...step, agent_id: e.target.value })} placeholder="e.g. researcher" />
      </div>
      <div style={{ marginBottom: 6 }}>
        <label style={{ fontSize: 11, opacity: 0.6 }}>Prompt Template</label>
        <textarea style={{ ...inputStyle, height: 60, resize: "vertical" }} value={step.prompt_template} onChange={(e) => onChange({ ...step, prompt_template: e.target.value })} placeholder="Use {{result.step_id}} for prior step outputs" />
      </div>
      <div>
        <label style={{ fontSize: 11, opacity: 0.6 }}>Dependencies (step IDs, comma-separated)</label>
        <input style={inputStyle} value={step.dependencies.join(", ")} onChange={(e) => onChange({ ...step, dependencies: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="e.g. step_1, step_2" />
      </div>
    </div>
  );
}

// ─── Campaign Editor ──────────────────────────────────────────────────────────

function CampaignEditor({ campaign, onSaved, onCancel }: { campaign: Partial<Campaign> | null; onSaved: (c: Campaign) => void; onCancel: () => void }) {
  const [name, setName] = useState(campaign?.name ?? "");
  const [description, setDescription] = useState(campaign?.description ?? "");
  const [steps, setSteps] = useState<Step[]>(campaign?.steps ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!campaign?.id;

  const inputStyle: React.CSSProperties = { width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "8px 12px", color: "#fff", fontSize: 13, outline: "none", marginTop: 4, boxSizing: "border-box" };

  function addStep() {
    const id = `step_${Date.now()}`;
    setSteps((prev) => [...prev, { id, label: "", agent_id: "", prompt_template: "", dependencies: [] }]);
  }

  async function save() {
    if (!name.trim()) { setError("Name required"); return; }
    setSaving(true); setError(null);
    try {
      const body = { name, description, steps };
      let result: { ok: boolean; campaign: Campaign };
      if (isEdit && campaign?.id) {
        result = await api.put<{ ok: boolean; campaign: Campaign }>(`/campaigns/${campaign.id}`, body);
      } else {
        result = await api.post<{ ok: boolean; campaign: Campaign }>("/campaigns", body);
      }
      onSaved(result.campaign);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "20px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <span style={{ fontSize: 16, fontWeight: 700 }}>{isEdit ? "Edit Campaign" : "New Campaign"}</span>
        <button onClick={onCancel} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 18 }}>✕</button>
      </div>
      {error && <div style={{ color: "#f87171", fontSize: 12, marginBottom: 12 }}>{error}</div>}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 11, opacity: 0.6 }}>Name *</label>
        <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="My campaign name" />
      </div>
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 11, opacity: 0.6 }}>Description</label>
        <textarea style={{ ...inputStyle, height: 64, resize: "vertical" }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this campaign do?" />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Steps</span>
        <button onClick={addStep} style={{ background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.3)", borderRadius: 6, color: "#c4b5fd", fontSize: 12, padding: "4px 12px", cursor: "pointer" }}>+ Add Step</button>
      </div>
      {steps.length === 0 && <div style={{ fontSize: 12, opacity: 0.4, marginBottom: 20, textAlign: "center", padding: 20 }}>No steps yet. Add a step to define the workflow.</div>}
      {steps.map((step, i) => (
        <StepEditor key={step.id} step={step} allSteps={steps} onChange={(updated) => { const copy = [...steps]; copy[i] = updated; setSteps(copy); }} onDelete={() => setSteps(steps.filter((_, idx) => idx !== i))} />
      ))}
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button onClick={save} disabled={saving} style={{ flex: 1, padding: "8px 0", borderRadius: 6, border: "none", cursor: "pointer", background: saving ? "rgba(139,92,246,0.2)" : "rgba(139,92,246,0.7)", color: "#fff", fontWeight: 600, fontSize: 13 }}>
          {saving ? "Saving…" : isEdit ? "Update" : "Create"}
        </button>
        <button onClick={onCancel} style={{ padding: "8px 20px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", background: "transparent", color: "rgba(255,255,255,0.6)", fontSize: 13 }}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Run History ──────────────────────────────────────────────────────────────

function RunHistory({ campaign, onBack }: { campaign: Campaign; onBack: () => void }) {
  const [runs, setRuns] = useState<CampaignRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [selected, setSelected] = useState<CampaignRun | null>(null);

  useEffect(() => {
    api.get<{ ok: boolean; runs: CampaignRun[] }>(`/campaigns/${campaign.id}/runs`).then((r) => setRuns(r.runs ?? [])).catch(() => {}).finally(() => setLoading(false));
  }, [campaign.id]);

  async function startRun() {
    setStarting(true);
    try {
      const result = await api.post<{ ok: boolean; run: CampaignRun }>(`/campaigns/${campaign.id}/run`, {});
      setRuns((prev) => [result.run, ...prev]);
      setSelected(result.run);
    } catch (e) {
      console.error("Failed to start run", e);
    } finally {
      setStarting(false);
    }
  }

  async function refreshRun(run: CampaignRun) {
    try {
      const r = await api.get<{ ok: boolean; run: CampaignRun }>(`/campaign-runs/${run.id}`);
      setSelected(r.run);
      setRuns((prev) => prev.map((x) => (x.id === r.run.id ? r.run : x)));
    } catch { /* ignore */ }
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <button onClick={onBack} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 12, marginBottom: 4, padding: 0 }}>← Back</button>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{campaign.name} — Runs</div>
          </div>
          <button onClick={startRun} disabled={starting} style={{ padding: "6px 16px", borderRadius: 6, border: "none", cursor: "pointer", background: starting ? "rgba(34,197,94,0.15)" : "rgba(34,197,94,0.25)", color: "#86efac", fontSize: 12, fontWeight: 600 }}>
            {starting ? "Starting…" : "▶ Run Now"}
          </button>
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ width: 240, borderRight: "1px solid rgba(255,255,255,0.08)", overflowY: "auto" }}>
          {loading && <div style={{ padding: 16, opacity: 0.5, fontSize: 12 }}>Loading…</div>}
          {!loading && runs.length === 0 && <div style={{ padding: 16, opacity: 0.4, fontSize: 12, textAlign: "center" }}>No runs yet</div>}
          {runs.map((run) => (
            <div key={run.id} onClick={() => setSelected(run)} style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.05)", background: selected?.id === run.id ? "rgba(255,255,255,0.07)" : "transparent" }}>
              <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}>{run.name}</div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: statusColor(run.status) }}>{run.status}</span>
                <span style={{ fontSize: 10, opacity: 0.4 }}>{fmt(run.started_at)}</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {selected ? (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{selected.name}</div>
                  <span style={{ fontSize: 12, color: statusColor(selected.status), fontWeight: 600 }}>{selected.status}</span>
                  {selected.duration_seconds != null && <span style={{ fontSize: 11, opacity: 0.5, marginLeft: 8 }}>{selected.duration_seconds}s</span>}
                </div>
                <button onClick={() => refreshRun(selected)} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "rgba(255,255,255,0.6)", fontSize: 11, padding: "4px 10px", cursor: "pointer" }}>↻ Refresh</button>
              </div>
              <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 16 }}>Started: {fmt(selected.started_at)} · Completed: {fmt(selected.completed_at)}</div>
              {Object.entries(selected.step_statuses).map(([stepId, s]) => (
                <div key={stepId} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "10px 14px", marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 500 }}>{stepId}</span>
                    <span style={{ fontSize: 11, color: statusColor(s.status) }}>{s.status}</span>
                  </div>
                  {s.result && <div style={{ fontSize: 11, opacity: 0.6, background: "rgba(255,255,255,0.04)", borderRadius: 4, padding: "4px 8px", marginTop: 4, wordBreak: "break-word" }}>{s.result}</div>}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ opacity: 0.35, fontSize: 13, textAlign: "center", marginTop: 60 }}>Select a run to view details</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

type View = "list" | "editor" | "runs";

export function CampaignsApp() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("list");
  const [selected, setSelected] = useState<Campaign | null>(null);
  const [editing, setEditing] = useState<Partial<Campaign> | null>(null);

  useEffect(() => {
    api.get<{ ok: boolean; campaigns: Campaign[] }>("/campaigns").then((r) => setCampaigns(r.campaigns ?? [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  function openNew() { setEditing({}); setView("editor"); }
  function openEdit(c: Campaign) { setEditing(c); setView("editor"); }
  function openRuns(c: Campaign) { setSelected(c); setView("runs"); }

  function onSaved(c: Campaign) {
    setCampaigns((prev) => {
      const idx = prev.findIndex((x) => x.id === c.id);
      if (idx >= 0) { const copy = [...prev]; copy[idx] = c; return copy; }
      return [c, ...prev];
    });
    setSelected(c);
    setView("list");
  }

  async function deleteCampaign(c: Campaign) {
    if (!confirm(`Delete "${c.name}"?`)) return;
    await api.delete(`/campaigns/${c.id}`);
    setCampaigns((prev) => prev.filter((x) => x.id !== c.id));
    if (selected?.id === c.id) setSelected(null);
  }

  const statusBadge = (s: string) => (
    <span style={{ fontSize: 10, color: statusColor(s), border: `1px solid ${statusColor(s)}33`, borderRadius: 4, padding: "1px 6px" }}>{s}</span>
  );

  return (
    <AppWindowChrome appId="campaigns" title={config.title} icon={config.icon} accent={config.accent}>
      {view === "editor" ? (
        <CampaignEditor campaign={editing} onSaved={onSaved} onCancel={() => setView("list")} />
      ) : view === "runs" && selected ? (
        <RunHistory campaign={selected} onBack={() => setView("list")} />
      ) : (
        <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
          <div style={{ width: 280, borderRight: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <button onClick={openNew} style={{ width: "100%", padding: "7px 0", borderRadius: 6, border: "1px solid rgba(139,92,246,0.3)", cursor: "pointer", background: "rgba(139,92,246,0.15)", color: "#c4b5fd", fontSize: 12, fontWeight: 600 }}>+ New Campaign</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {loading && <div style={{ padding: 16, opacity: 0.5, fontSize: 12 }}>Loading…</div>}
              {!loading && campaigns.length === 0 && <div style={{ padding: 20, opacity: 0.4, fontSize: 12, textAlign: "center" }}>No campaigns yet</div>}
              {campaigns.map((c) => (
                <div key={c.id} onClick={() => setSelected(c)} style={{ padding: "11px 14px", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.05)", background: selected?.id === c.id ? "rgba(255,255,255,0.07)" : "transparent" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</span>
                    {statusBadge(c.status)}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.45 }}>{c.steps.length} steps · {c.run_count} runs</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
            {selected ? (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>{selected.name}</div>
                    {selected.description && <div style={{ fontSize: 13, opacity: 0.55, marginBottom: 8 }}>{selected.description}</div>}
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {statusBadge(selected.status)}
                      <span style={{ fontSize: 11, opacity: 0.4 }}>{selected.steps.length} steps · {selected.run_count} runs</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => openEdit(selected)} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.7)", fontSize: 12 }}>Edit</button>
                    <button onClick={() => openRuns(selected)} style={{ padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer", background: "rgba(34,197,94,0.2)", color: "#86efac", fontSize: 12, fontWeight: 600 }}>▶ Runs</button>
                    <button onClick={() => deleteCampaign(selected)} style={{ padding: "6px 10px", borderRadius: 6, border: "none", cursor: "pointer", background: "rgba(239,68,68,0.15)", color: "#f87171", fontSize: 12 }}>🗑</button>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, opacity: 0.8 }}>Workflow Steps</div>
                  {selected.steps.length === 0 ? (
                    <div style={{ fontSize: 12, opacity: 0.4 }}>No steps defined</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {selected.steps.map((step, i) => (
                        <div key={step.id} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "10px 14px", background: "rgba(255,255,255,0.03)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{i + 1}. {step.label || step.id}</span>
                            <span style={{ fontSize: 11, opacity: 0.5 }}>{step.agent_id || "no agent"}</span>
                          </div>
                          {step.prompt_template && <div style={{ fontSize: 11, opacity: 0.55, fontFamily: "monospace", background: "rgba(255,255,255,0.04)", borderRadius: 4, padding: "4px 8px", marginBottom: 4 }}>{step.prompt_template.slice(0, 120)}{step.prompt_template.length > 120 ? "…" : ""}</div>}
                          {step.dependencies.length > 0 && <div style={{ fontSize: 10, opacity: 0.4 }}>Depends on: {step.dependencies.join(", ")}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ opacity: 0.35, fontSize: 13, textAlign: "center", marginTop: 80 }}>Select a campaign or create one</div>
            )}
          </div>
        </div>
      )}
    </AppWindowChrome>
  );
}
