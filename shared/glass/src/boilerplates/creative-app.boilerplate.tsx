import { EditorShell } from "../templates/EditorShell.tsx";
import { GlassButton } from "../components/GlassButton/index.ts";
import { GlassCard } from "../components/GlassCard/index.ts";

/**
 * creative-app boilerplate — canvas/whiteboard/storyboard style. Blue accent.
 * Demonstrates the EditorShell with toolbar, editor, and inspector.
 */
export function CreativeAppBoilerplate() {
  return (
    <EditorShell
      appId="canvas"
      title="CANVAS"
      icon="&#9703;"
      accent="#6b95f0"
      toolbar={
        <>
          <GlassButton uiSize="sm">Select</GlassButton>
          <GlassButton uiSize="sm">Pan</GlassButton>
          <GlassButton uiSize="sm" variant="primary">
            Draw
          </GlassButton>
        </>
      }
      editor={
        <div
          style={{
            height: "100%",
            borderRadius: "var(--pn-radius-lg)",
            border: "1px dashed var(--pn-border-default)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--pn-text-muted)",
            fontSize: "0.75rem",
          }}
        >
          Canvas surface goes here
        </div>
      }
      inspector={
        <GlassCard title="Layers" size="sm">
          <p style={{ fontSize: "0.7rem", color: "var(--pn-text-secondary)" }}>
            Background · Sketch · Notes
          </p>
        </GlassCard>
      }
      statusBar={
        <>
          <span>Zoom 100%</span>
          <span>Grid on</span>
        </>
      }
    />
  );
}
