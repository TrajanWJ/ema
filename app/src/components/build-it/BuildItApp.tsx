import { useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { api } from "@/lib/api";

type Step = 1 | 2 | 3;
interface TaskItem { id: string; mode: string; description: string; }

export function BuildItApp() {
  const [step, setStep] = useState<Step>(1);
  const [idea, setIdea] = useState("");
  const [project, setProject] = useState("");
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [planning, setPlanning] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launchResult, setLaunchResult] = useState("");

  const plan = () => {
    if (!idea.trim()) return;
    setPlanning(true);
    api.post<{ tasks: TaskItem[] }>("/superman/ask", { query: `Break down into research/implement/review tasks: ${idea}`, project })
      .then((r) => {
        const parsed: TaskItem[] = (r.tasks ?? []).map((t: unknown, i: number) => {
          const task = t as Record<string, unknown>;
          return { id: String(i), mode: String(task.mode ?? "research"), description: String(task.description ?? task) };
        });
        setTasks(parsed.length > 0 ? parsed : [
          { id: "0", mode: "research", description: `Research: ${idea}` },
          { id: "1", mode: "implement", description: `Implement: ${idea}` },
          { id: "2", mode: "review", description: `Review implementation` },
        ]);
        setStep(2);
      })
      .catch(() => {
        setTasks([
          { id: "0", mode: "research", description: `Research: ${idea}` },
          { id: "1", mode: "implement", description: `Implement: ${idea}` },
        ]);
        setStep(2);
      })
      .finally(() => setPlanning(false));
  };

  const launch = () => {
    setLaunching(true);
    api.post<{ id: string }>("/proposals", { title: idea, description: idea, tasks })
      .then((p) => {
        setLaunchResult(`Proposal created: ${p.id}`);
        setStep(3);
      })
      .catch(() => { setLaunchResult("Failed to create proposal"); setStep(3); })
      .finally(() => setLaunching(false));
  };

  const modeColor = (m: string) => m === "research" ? "#60a5fa" : m === "implement" ? "#a78bfa" : "#34d399";

  return (
    <AppWindowChrome appId="build-it" title="Build It">
      <div style={{ padding: 24, overflowY: "auto", height: "100%", maxWidth: 600, margin: "0 auto" }}>
        {/* Steps */}
        <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
          {([1, 2, 3] as Step[]).map((s) => (
            <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: step >= s ? "#a78bfa" : "rgba(255,255,255,0.1)" }} />
          ))}
        </div>

        {step === 1 && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>What do you want to build?</div>
            <div style={{ fontSize: 13, opacity: 0.5, marginBottom: 20 }}>Describe your idea. I&apos;ll break it into tasks.</div>
            <textarea value={idea} onChange={(e) => setIdea(e.target.value)} rows={5} placeholder="e.g. Add a dark mode toggle to the settings app"
              style={{ width: "100%", padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", color: "white", fontSize: 13, resize: "vertical", marginBottom: 12, boxSizing: "border-box", fontFamily: "inherit" }} />
            <input value={project} onChange={(e) => setProject(e.target.value)} placeholder="Project (optional)"
              style={{ width: "100%", padding: 10, borderRadius: 8, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "white", fontSize: 13, marginBottom: 16, boxSizing: "border-box" }} />
            <button onClick={plan} disabled={!idea.trim() || planning}
              style={{ padding: "9px 24px", borderRadius: 8, border: "none", cursor: "pointer", background: "rgba(167,139,250,0.3)", color: "#e9d5ff", fontSize: 14, fontWeight: 600 }}>
              {planning ? "Planning…" : "Generate Plan →"}
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Review the plan</div>
            <div style={{ fontSize: 13, opacity: 0.5, marginBottom: 20 }}>Edit tasks as needed, then launch.</div>
            {tasks.map((t, i) => (
              <div key={t.id} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
                <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, background: "rgba(255,255,255,0.07)", color: modeColor(t.mode), flexShrink: 0, marginTop: 3 }}>{t.mode}</span>
                <input value={t.description} onChange={(e) => setTasks((prev) => prev.map((x, j) => j === i ? { ...x, description: e.target.value } : x))}
                  style={{ flex: 1, padding: "6px 10px", borderRadius: 6, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "white", fontSize: 12 }} />
              </div>
            ))}
            <button onClick={() => setTasks((p) => [...p, { id: String(p.length), mode: "research", description: "" }])}
              style={{ marginBottom: 20, padding: "5px 14px", borderRadius: 6, border: "1px dashed rgba(255,255,255,0.2)", background: "transparent", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 12 }}>
              + Add task
            </button>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep(1)} style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 13 }}>Back</button>
              <button onClick={launch} disabled={launching}
                style={{ padding: "9px 24px", borderRadius: 8, border: "none", cursor: "pointer", background: "rgba(167,139,250,0.3)", color: "#e9d5ff", fontSize: 14, fontWeight: 600 }}>
                {launching ? "Launching…" : "🚀 Launch"}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ textAlign: "center", paddingTop: 40 }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🎉</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Launched!</div>
            <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 24 }}>{launchResult}</div>
            <button onClick={() => { setStep(1); setIdea(""); setProject(""); setTasks([]); setLaunchResult(""); }}
              style={{ padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer", background: "rgba(167,139,250,0.2)", color: "#c4b5fd", fontSize: 13 }}>
              Build Another
            </button>
          </div>
        )}
      </div>
    </AppWindowChrome>
  );
}
