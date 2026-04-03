import { useEffect, useState } from "react";
import { useRoutineStore } from "@/stores/routine-store";

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

const CADENCE_COLORS = {
  daily: "#F59E0B",
  weekly: "#6B95F0",
} as const;

interface StepDraft {
  title: string;
  duration_min: string;
  type: string;
}

export function RoutineBuilderApp() {
  const {
    routines,
    loading,
    error,
    loadViaRest,
    createRoutine,
    toggleRoutine,
    runRoutine,
    deleteRoutine,
  } = useRoutineStore();

  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCadence, setFormCadence] = useState<"daily" | "weekly">("daily");
  const [formSteps, setFormSteps] = useState<StepDraft[]>([
    { title: "", duration_min: "5", type: "action" },
  ]);

  useEffect(() => {
    loadViaRest();
  }, [loadViaRest]);

  const updateStep = (
    index: number,
    field: keyof StepDraft,
    value: string,
  ) => {
    setFormSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    );
  };

  const addStep = () =>
    setFormSteps((prev) => [
      ...prev,
      { title: "", duration_min: "5", type: "action" },
    ]);

  const removeStep = (index: number) => {
    if (formSteps.length <= 1) return;
    setFormSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!formName.trim()) return;
    const steps = formSteps
      .filter((s) => s.title.trim())
      .map((s) => ({
        action: s.title.trim(),
        duration_min: parseInt(s.duration_min, 10) || 5,
      }));
    if (steps.length === 0) return;
    try {
      await createRoutine({
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        type: formCadence === "daily" ? "morning" : "work",
        cadence: formCadence,
        steps,
      });
      setFormName("");
      setFormDescription("");
      setFormSteps([{ title: "", duration_min: "5", type: "action" }]);
      setShowForm(false);
    } catch (err) {
      console.warn("Failed to create routine:", err);
    }
  };

  if (loading && routines.length === 0) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ color: "var(--pn-text-secondary)", fontSize: 13 }}>
          Loading...
        </span>
      </div>
    );
  }

  return (
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
          Routines
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
          {showForm ? "Cancel" : "+ New Routine"}
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
              gridTemplateColumns: "2fr 1fr",
              gap: 10,
              marginBottom: 10,
            }}
          >
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Routine name *"
              style={inputStyle}
            />
            <select
              value={formCadence}
              onChange={(e) =>
                setFormCadence(e.target.value as "daily" | "weekly")
              }
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
          <input
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            placeholder="Description"
            style={{ ...inputStyle, marginBottom: 12 }}
          />

          <div
            style={{
              color: "var(--pn-text-secondary)",
              fontSize: 12,
              marginBottom: 8,
              fontWeight: 500,
            }}
          >
            Steps
          </div>
          {formSteps.map((step, idx) => (
            <div
              key={idx}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr auto",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <input
                value={step.title}
                onChange={(e) => updateStep(idx, "title", e.target.value)}
                placeholder={`Step ${idx + 1}`}
                style={inputStyle}
              />
              <input
                value={step.duration_min}
                onChange={(e) =>
                  updateStep(idx, "duration_min", e.target.value)
                }
                placeholder="Min"
                type="number"
                style={inputStyle}
              />
              <input
                value={step.type}
                onChange={(e) => updateStep(idx, "type", e.target.value)}
                placeholder="Type"
                style={inputStyle}
              />
              <button
                onClick={() => removeStep(idx)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#f87171",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                x
              </button>
            </div>
          ))}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 8,
            }}
          >
            <button
              onClick={addStep}
              style={{
                background: "none",
                border: "none",
                color: "#6B95F0",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              + Add Step
            </button>
            <button onClick={handleCreate} style={btnPrimary}>
              Create Routine
            </button>
          </div>
        </div>
      )}

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {routines.length === 0 && (
          <div
            style={{
              color: "var(--pn-text-secondary)",
              fontSize: 13,
              textAlign: "center",
              marginTop: 32,
            }}
          >
            No routines yet
          </div>
        )}
        {routines.map((routine) => (
          <div key={routine.id} style={{ ...card, marginBottom: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {/* Active/inactive green dot */}
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: routine.active ? "#2DD4A8" : "#555",
                  }}
                />
                <span
                  style={{
                    color: "var(--pn-text-primary)",
                    fontSize: 14,
                    fontWeight: 500,
                  }}
                >
                  {routine.name}
                </span>
                <span
                  style={{
                    display: "inline-block",
                    padding: "2px 8px",
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 600,
                    background: `${CADENCE_COLORS[routine.cadence]}20`,
                    color: CADENCE_COLORS[routine.cadence],
                  }}
                >
                  {routine.cadence}
                </span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => toggleRoutine(routine.id)}
                  style={{
                    background: "none",
                    border: "none",
                    color: routine.active ? "#F59E0B" : "#2DD4A8",
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: 500,
                  }}
                >
                  {routine.active ? "Disable" : "Enable"}
                </button>
                <button
                  onClick={() => runRoutine(routine.id)}
                  style={{
                    background: "rgba(107,149,240,0.12)",
                    color: "#6B95F0",
                    border: "none",
                    borderRadius: 6,
                    padding: "4px 10px",
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: 500,
                  }}
                >
                  Run Now
                </button>
                <button
                  onClick={() => deleteRoutine(routine.id)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#f87171",
                    cursor: "pointer",
                    fontSize: 11,
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
            <div
              style={{
                color: "var(--pn-text-secondary)",
                fontSize: 11,
                marginBottom: 6,
              }}
            >
              {routine.steps.length} step{routine.steps.length !== 1 ? "s" : ""}
              {routine.last_run_at
                ? ` \u00B7 Last run ${new Date(routine.last_run_at).toLocaleDateString()}`
                : ""}
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              {routine.steps.map((step, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "4px 0",
                  }}
                >
                  <span
                    style={{
                      color: "var(--pn-text-secondary)",
                      fontSize: 11,
                      minWidth: 18,
                    }}
                  >
                    {idx + 1}.
                  </span>
                  <span
                    style={{
                      color: "var(--pn-text-primary)",
                      fontSize: 12,
                    }}
                  >
                    {step.title}
                  </span>
                  <span
                    style={{
                      color: "var(--pn-text-secondary)",
                      fontSize: 10,
                    }}
                  >
                    {step.duration_min}m
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
