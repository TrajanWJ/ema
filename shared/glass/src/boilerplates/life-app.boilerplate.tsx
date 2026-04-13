import { EditorShell } from "../templates/EditorShell.tsx";
import { GlassInput } from "../components/GlassInput/index.ts";
import { GlassButton } from "../components/GlassButton/index.ts";

/**
 * life-app boilerplate — journal/habits/goals. Amber accent. A minimal
 * journal entry shell with a toolbar and a single text surface.
 */
export function LifeAppBoilerplate() {
  return (
    <EditorShell
      appId="journal"
      title="JOURNAL"
      icon="&#9998;"
      accent="#f59e0b"
      toolbar={
        <>
          <GlassInput uiSize="sm" placeholder="Entry title" />
          <GlassButton uiSize="sm" variant="primary">
            Save
          </GlassButton>
        </>
      }
      editor={
        <textarea
          style={{
            width: "100%",
            height: "100%",
            background: "var(--pn-field-bg)",
            color: "var(--pn-text-primary)",
            border: "1px solid var(--pn-border-default)",
            borderRadius: "var(--pn-radius-md)",
            padding: "var(--pn-space-3)",
            resize: "none",
            fontFamily: "var(--font-sans)",
            fontSize: "0.85rem",
            outline: "none",
          }}
          placeholder="Write."
        />
      }
      statusBar={<span>Unsaved</span>}
    />
  );
}
