import { useMemo, useState } from "react";

import {
  ActivityTimeline,
  BentoGrid,
  CatalogShell,
  componentRecipes,
  GlassButton,
  GlassCard,
  GlassInput,
  GlassSurface,
  GridPattern,
  HeroBanner,
  InspectorSection,
  MetricCard,
  SectionHeader,
  SegmentedControl,
  SidebarNav,
  SignalOrb,
  StatStrip,
  TagPill,
  Toolbar,
  TopNavBar,
  vAppRegistry,
  vAppRecipes,
  type SegmentedControlOption,
} from "@ema/glass";
import { gradients, patternLanguage, ramps } from "@ema/tokens";
import { APP_CONFIGS } from "@/types/workspace";

const config = APP_CONFIGS["pattern-lab"];

type PatternLabSurface = "components" | "templates" | "tokens";
type PatternLabSection = "overview" | "navigation" | "sections" | "copy";

const SURFACE_OPTIONS: readonly SegmentedControlOption<PatternLabSurface>[] = [
  { value: "components", label: "Components", hint: "Reusable building blocks" },
  { value: "templates", label: "Templates", hint: "App-level shells" },
  { value: "tokens", label: "Tokens", hint: "Color, layout, and language" },
] as const;

const LAB_SECTIONS = [
  { id: "overview", label: "Overview", detail: "Shared direction and primitives", leading: "◫" },
  { id: "navigation", label: "Navigation", detail: "Top bars, rails, segmented systems", leading: "≣" },
  { id: "sections", label: "Sections", detail: "Headers, cards, bento zones, inspector rails", leading: "▥" },
  { id: "copy", label: "Prompt Language", detail: "Vocabulary for humans and LLMs", leading: "✎" },
] as const;

function rampPreview(name: string, ramp: Record<string, string>) {
  const stops = ["100", "300", "500", "700", "900"];
  return (
    <div
      key={name}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--pn-space-2)",
        padding: "var(--pn-space-3)",
        borderRadius: "var(--pn-radius-lg)",
        border: "1px solid var(--pn-border-default)",
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <div style={{ fontSize: "0.8rem", fontWeight: 600, textTransform: "capitalize" }}>{name}</div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${stops.length}, 1fr)`, gap: "6px" }}>
        {stops.map((stop) => (
          <div key={stop} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div
              style={{
                height: 34,
                borderRadius: 10,
                background: ramp[stop],
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            />
            <div style={{ fontSize: "0.66rem", color: "var(--pn-text-tertiary)" }}>{stop}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PatternLabApp() {
  const [surface, setSurface] = useState<PatternLabSurface>("components");
  const [section, setSection] = useState<PatternLabSection>("overview");
  const [navMode, setNavMode] = useState<"top_tabs" | "left_rail" | "segmented_toolbar">("top_tabs");
  const [query, setQuery] = useState("");

  const topNavItems = useMemo(
    () => [
      { id: "components", label: "Components", hint: "Primitives + composites" },
      { id: "templates", label: "Templates", hint: "Shells and view systems" },
      { id: "tokens", label: "Tokens", hint: "Palette and pattern language" },
    ],
    [],
  );

  const filteredArchetypes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return patternLanguage.appArchetypes;
    return patternLanguage.appArchetypes.filter((entry) =>
      `${entry.label} ${entry.use_when} ${entry.default_sections.join(" ")}`.toLowerCase().includes(q),
    );
  }, [query]);

  const rail = (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--pn-space-4)" }}>
      <GlassCard title="Adoption Path">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--pn-space-2)" }}>
          {[
            "Move high-traffic apps onto named shells before polishing edge cases.",
            "Use token ramps and layout vars instead of app-local magic numbers.",
            "Prompt new screens with archetype + nav system + section archetypes.",
          ].map((line) => (
            <div key={line} style={{ color: "var(--pn-text-secondary)", lineHeight: 1.5, fontSize: "0.8rem" }}>
              {line}
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard title="Prompt Formula">
        <div style={{ color: "var(--pn-text-secondary)", fontSize: "0.8rem", lineHeight: 1.55 }}>
          Name the `app archetype`, then the `nav system`, then the `main section` and the `supporting rail`.
          Add a named atmosphere such as `editorial`, `signal`, `ocean`, or `theater`.
        </div>
      </GlassCard>

      <GlassCard title="Good Phrases">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--pn-space-2)" }}>
          {patternLanguage.copyGuidance.preferredVerbs.slice(0, 8).map((verb) => (
            <span
              key={verb}
              style={{
                padding: "4px 8px",
                borderRadius: 999,
                background: "rgba(45,212,168,0.12)",
                color: "var(--color-pn-teal-300)",
                fontSize: "0.72rem",
              }}
            >
              {verb}
            </span>
          ))}
        </div>
      </GlassCard>
    </div>
  );

  return (
    <CatalogShell
      appId="pattern-lab"
      title={config.title}
      icon={config.icon}
      accent={config.accent}
      nav={
        <TopNavBar
          items={topNavItems}
          activeId={surface}
          onChange={(value) => setSurface(value as PatternLabSurface)}
          leftSlot={
            <div>
              <div
                style={{
                  fontSize: "0.66rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.16em",
                  color: "var(--pn-text-muted)",
                }}
              >
                Shared UI Foundation
              </div>
              <div style={{ fontSize: "1.1rem", fontWeight: 650, color: "var(--pn-text-primary)" }}>
                Pattern Lab
              </div>
            </div>
          }
          rightSlot={
            <>
              <GlassButton uiSize="sm" variant="ghost">Audit Apps</GlassButton>
              <GlassButton uiSize="sm" variant="primary">Use In New vApp</GlassButton>
            </>
          }
        />
      }
      hero={
        <GlassSurface tier="panel" padding="lg">
          <SectionHeader
            eyebrow="Design System"
            title="Shared components, shells, tokens, and prompt language"
            description="This is the place to define reusable EMA interface structure so new apps do not default to one-off layouts. The goal is a named vocabulary that both engineers and LLMs can target directly."
            actions={
              <SegmentedControl
                value={surface}
                options={SURFACE_OPTIONS}
                onChange={setSurface}
              />
            }
          />
        </GlassSurface>
      }
      browse={
        <SidebarNav
          title="Pattern Areas"
          items={LAB_SECTIONS}
          activeId={section}
          onChange={(value) => setSection(value as PatternLabSection)}
        />
      }
      content={
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--pn-space-4)", minWidth: 0 }}>
            <GlassSurface tier="surface" padding="md">
              <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--pn-space-4)", alignItems: "center", flexWrap: "wrap" }}>
                <SectionHeader
                  eyebrow="Current Focus"
                  title={surface === "components" ? "Component options" : surface === "templates" ? "Template options" : "Token language"}
                  description={
                    surface === "components"
                      ? "Build from named pieces like TopNavBar, SidebarNav, MetricCard, SectionHeader, and BentoGrid."
                      : surface === "templates"
                        ? "Choose a shell before styling. Shell choice should match app posture and workflow."
                        : "Use ramps, gradients, layout vars, and pattern language together."
                  }
                />
                <div style={{ width: 280 }}>
                  <GlassInput
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Filter archetypes and language..."
                    uiSize="sm"
                  />
                </div>
              </div>
            </GlassSurface>

            {surface === "components" && (
              <>
                <BentoGrid minColumnWidth={220}>
                  <MetricCard label="Components" value="12+" detail="Higher-level primitives added in shared glass." tone="var(--color-pn-teal-400)" />
                  <MetricCard label="Shells" value="4" detail="Workspace, studio, command center, and feed shells." tone="var(--color-pn-blue-400)" />
                  <MetricCard label="Prompt Patterns" value="4 layers" detail="Archetype, nav, sections, copy guidance." tone="var(--color-pn-purple-400)" />
                </BentoGrid>

                <GlassSurface tier="surface" padding="lg">
                  <SectionHeader
                    eyebrow="Navigation Systems"
                    title="Named nav structures"
                    description="Pick the posture first. Use top tabs for peer surfaces, left rails for deeper trees, segmented controls for local mode switches."
                    actions={
                      <SegmentedControl
                        value={navMode}
                        options={[
                          { value: "top_tabs", label: "Top Tabs", hint: "Peer surfaces" },
                          { value: "left_rail", label: "Left Rail", hint: "Hierarchy" },
                          { value: "segmented_toolbar", label: "Segmented", hint: "Local mode" },
                        ]}
                        onChange={setNavMode}
                      />
                    }
                  />

                  <div style={{ marginTop: "var(--pn-space-4)", display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: "var(--pn-space-4)" }}>
                    <GlassCard title="Recommended Use">
                      <div style={{ color: "var(--pn-text-secondary)", lineHeight: 1.55, fontSize: "0.84rem" }}>
                        {patternLanguage.navigationSystems.find((entry) => entry.id === navMode)?.best_for}
                      </div>
                    </GlassCard>
                    <GlassCard title="Avoid When">
                      <div style={{ color: "var(--pn-text-secondary)", lineHeight: 1.55, fontSize: "0.84rem" }}>
                        {patternLanguage.navigationSystems.find((entry) => entry.id === navMode)?.avoid_when}
                      </div>
                    </GlassCard>
                  </div>
                </GlassSurface>

                <GlassSurface tier="surface" padding="lg">
                  <SectionHeader
                    eyebrow="Component Recipes"
                    title="Composable view blocks"
                    description="These are the reusable ingredients to reach a cooler, more modern app surface without hand-building every section."
                  />
                  <BentoGrid minColumnWidth={240}>
                    {componentRecipes.nav.map((recipe) => (
                      <GlassCard key={recipe.id} title={recipe.id.replace(/_/g, " ")}>
                        <div style={{ color: "var(--pn-text-secondary)", fontSize: "0.8rem", lineHeight: 1.5 }}>
                          {recipe.best_for}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--pn-space-2)", marginTop: "var(--pn-space-3)" }}>
                          {recipe.components.map((component) => (
                            <span key={component} style={{ fontSize: "0.72rem", color: "var(--color-pn-indigo-300)" }}>
                              {component}
                            </span>
                          ))}
                        </div>
                      </GlassCard>
                    ))}
                    {componentRecipes.views.map((recipe) => (
                      <GlassCard key={recipe.id} title={recipe.id.replace(/_/g, " ")}>
                        <div style={{ color: "var(--pn-text-secondary)", fontSize: "0.8rem", lineHeight: 1.5 }}>
                          {recipe.best_for}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--pn-space-2)", marginTop: "var(--pn-space-3)" }}>
                          {recipe.components.map((component) => (
                            <span key={component} style={{ fontSize: "0.72rem", color: "var(--color-pn-teal-300)" }}>
                              {component}
                            </span>
                          ))}
                        </div>
                      </GlassCard>
                    ))}
                  </BentoGrid>
                </GlassSurface>

                <GlassSurface tier="surface" padding="lg">
                  <SectionHeader
                    eyebrow="Live Widgets"
                    title="Higher-order pieces ready for app migration"
                    description="These are meant to replace one-off hero sections, little metric bars, pills, ad-hoc rails, and local toolbars."
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--pn-space-4)", marginTop: "var(--pn-space-4)" }}>
                    <Toolbar
                      left={<TagPill label="Toolbar" tone="rgba(107,149,240,0.12)" color="var(--color-pn-blue-300)" />}
                      center={<TagPill label="Shared action cluster" />}
                      right={
                        <>
                          <GlassButton uiSize="sm" variant="ghost">Secondary</GlassButton>
                          <GlassButton uiSize="sm" variant="primary">Primary</GlassButton>
                        </>
                      }
                    />

                    <HeroBanner
                      eyebrow="Hero Widget"
                      title="Use named hero structures instead of app-local intro stacks."
                      description="HeroBanner is for the top-level story and system posture. Pair it with MetricCard or StatStrip for quantitative context."
                      tone="var(--color-pn-purple-400)"
                      actions={
                        <>
                          <TagPill label="hero_banner" tone="rgba(167,139,250,0.14)" color="var(--color-pn-purple-300)" />
                          <TagPill label="editorial" />
                          <TagPill label="control surface" />
                        </>
                      }
                      aside={
                        <div style={{ display: "grid", gap: "var(--pn-space-3)" }}>
                          <MetricCard label="Adoption" value="Growing" detail="Now used in app migrations." tone="var(--color-pn-teal-400)" />
                          <MetricCard label="Archetype" value="Command Center" detail="Top-level story plus operator context." tone="var(--color-pn-blue-400)" />
                        </div>
                      }
                    />

                    <StatStrip
                      items={[
                        { label: "Signals", value: "28", detail: "Visible examples", tone: "var(--color-pn-teal-400)" },
                        { label: "Views", value: "9", detail: "Reusable patterns", tone: "var(--color-pn-blue-400)" },
                        { label: "States", value: "4", detail: "Copy guidance layers", tone: "var(--color-pn-purple-400)" },
                      ]}
                    />

                    <InspectorSection
                      title="ActivityTimeline"
                      description="Use this for queues, run history, conversation rails, or proposal transitions."
                    >
                      <ActivityTimeline
                        items={[
                          {
                            id: "timeline-1",
                            title: "Promote settings to shared shell",
                            meta: "migration · recent",
                            body: "Replace local tab/header stacks with TopNavBar, HeroBanner, and InspectorSection.",
                            tone: "var(--color-pn-teal-400)",
                          },
                          {
                            id: "timeline-2",
                            title: "Add feed shell for media-first surfaces",
                            meta: "template · queued",
                            body: "Use FeedShell when a spotlight item, stream, and rails all matter at once.",
                            tone: "var(--color-pn-amber-400)",
                          },
                        ]}
                      />
                    </InspectorSection>
                  </div>
                </GlassSurface>
              </>
            )}

            {surface === "templates" && (
              <>
                <BentoGrid minColumnWidth={260}>
                  {componentRecipes.templates.map((template) => (
                    <GlassCard key={template.id} title={template.component}>
                      <div style={{ color: "var(--pn-text-secondary)", fontSize: "0.82rem", lineHeight: 1.5 }}>
                        {template.best_for}
                      </div>
                      <div style={{ marginTop: "var(--pn-space-3)", color: "var(--pn-text-tertiary)", fontSize: "0.72rem" }}>
                        Recipe id: {template.id}
                      </div>
                    </GlassCard>
                  ))}
                </BentoGrid>

                <GlassSurface tier="surface" padding="lg">
                  <SectionHeader
                    eyebrow="App Archetypes"
                    title="Match the shell to the job"
                    description="Every app should choose an archetype first, then choose navigation, section types, and atmosphere."
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--pn-space-3)", marginTop: "var(--pn-space-4)" }}>
                    {filteredArchetypes.map((archetype) => (
                      <GlassCard key={archetype.id} title={archetype.label}>
                        <div style={{ color: "var(--pn-text-secondary)", fontSize: "0.82rem", lineHeight: 1.55 }}>
                          {archetype.use_when}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--pn-space-2)", marginTop: "var(--pn-space-3)" }}>
                          {archetype.default_sections.map((entry) => (
                            <span
                              key={entry}
                              style={{
                                padding: "4px 8px",
                                borderRadius: 999,
                                background: "rgba(107,149,240,0.12)",
                                color: "var(--color-pn-blue-300)",
                                fontSize: "0.72rem",
                              }}
                            >
                              {entry}
                            </span>
                          ))}
                        </div>
                      </GlassCard>
                    ))}
                  </div>
                </GlassSurface>

                <GlassSurface tier="surface" padding="lg">
                  <SectionHeader
                    eyebrow="Registry"
                    title="Live vApp posture registry"
                    description="These entries are the first framework-level declarations of how EMA apps should think about structure, navigation, sections, and atmosphere."
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--pn-space-3)", marginTop: "var(--pn-space-4)" }}>
                    {Object.values(vAppRegistry).map((entry) => (
                      <GlassCard key={entry.id} title={`${entry.title} · ${entry.archetype.label}`}>
                        <div style={{ color: "var(--pn-text-secondary)", fontSize: "0.82rem", lineHeight: 1.5 }}>
                          Shell {entry.shell.component} · Nav {entry.nav.label} · Atmosphere {entry.atmosphere.gradient}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--pn-space-2)", marginTop: "var(--pn-space-3)" }}>
                          {entry.sections.map((sectionSpec) => (
                            <TagPill
                              key={sectionSpec.id}
                              label={sectionSpec.label}
                              tone="rgba(107,149,240,0.12)"
                              color="var(--color-pn-blue-300)"
                            />
                          ))}
                        </div>
                      </GlassCard>
                    ))}
                  </div>
                </GlassSurface>

                <GlassSurface tier="surface" padding="lg">
                  <SectionHeader
                    eyebrow="Recipes"
                    title="Implementation-ready framework recipes"
                    description="These recipes bind archetype, shell, and section composition into repeatable implementation patterns."
                  />
                  <BentoGrid minColumnWidth={260}>
                    {Object.values(vAppRecipes).map((recipe) => (
                      <GlassCard key={recipe.id} title={recipe.label}>
                        <div style={{ color: "var(--pn-text-secondary)", fontSize: "0.82rem", lineHeight: 1.5 }}>
                          {recipe.best_for}
                        </div>
                        <div style={{ marginTop: "var(--pn-space-3)", fontSize: "0.72rem", color: "var(--pn-text-tertiary)" }}>
                          Shell {recipe.shell}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--pn-space-2)", marginTop: "var(--pn-space-3)" }}>
                          {recipe.sections.map((sectionName) => (
                            <TagPill key={sectionName} label={sectionName} />
                          ))}
                        </div>
                      </GlassCard>
                    ))}
                  </BentoGrid>
                </GlassSurface>
              </>
            )}

            {surface === "tokens" && (
              <>
                <GlassSurface tier="surface" padding="lg">
                  <SectionHeader
                    eyebrow="Color Ramps"
                    title="Broader palette with in-between ramps"
                    description="The system now includes more intermediary ramps for calmer neutrals, streaming surfaces, system accents, and warmer editorial treatments."
                  />
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "var(--pn-space-4)", marginTop: "var(--pn-space-4)" }}>
                    {Object.entries(ramps).map(([name, ramp]) => rampPreview(name, ramp))}
                  </div>
                </GlassSurface>

                <GlassSurface tier="surface" padding="lg">
                  <SectionHeader
                    eyebrow="Atmosphere"
                    title="Named gradients"
                    description="Ask for these by name in prompts instead of describing vague vibes."
                  />
                  <BentoGrid minColumnWidth={220}>
                    {Object.entries(gradients).map(([name, gradient]) => (
                      <div
                        key={name}
                        style={{
                          borderRadius: "var(--pn-radius-lg)",
                          minHeight: 140,
                          padding: "var(--pn-space-4)",
                          background: gradient,
                          border: "1px solid var(--pn-border-default)",
                          display: "flex",
                          alignItems: "end",
                          color: "var(--pn-text-primary)",
                          fontWeight: 600,
                          textTransform: "capitalize",
                        }}
                      >
                        {name}
                      </div>
                    ))}
                  </BentoGrid>
                </GlassSurface>

                <GlassSurface tier="surface" padding="lg">
                  <SectionHeader
                    eyebrow="Little Assets"
                    title="Reusable visual accents"
                    description="Small assets like these help vApps feel deliberate without each app redrawing the same atmospheric decoration."
                  />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--pn-space-4)", marginTop: "var(--pn-space-4)" }}>
                    <div
                      style={{
                        position: "relative",
                        minHeight: 220,
                        borderRadius: "var(--pn-radius-xl)",
                        overflow: "hidden",
                        border: "1px solid var(--pn-border-default)",
                        background: "var(--pn-gradient-theater)",
                      }}
                    >
                      <GridPattern opacity={0.12} />
                      <SignalOrb
                        tone="var(--color-pn-teal-400)"
                        size={180}
                        style={{ position: "absolute", right: 24, top: 24 }}
                      />
                      <div style={{ position: "absolute", left: 18, bottom: 18, fontWeight: 620 }}>
                        SignalOrb + GridPattern
                      </div>
                    </div>
                    <GlassCard title="Use Cases">
                      <div style={{ display: "flex", flexDirection: "column", gap: "var(--pn-space-2)", color: "var(--pn-text-secondary)", fontSize: "0.82rem", lineHeight: 1.5 }}>
                        <div>Hero backgrounds for HQ, Feeds, and orchestration apps.</div>
                        <div>Inspector rails that need a subtle sense of atmosphere.</div>
                        <div>Pattern language demos and empty states that need more identity.</div>
                      </div>
                    </GlassCard>
                  </div>
                </GlassSurface>

                <GlassSurface tier="surface" padding="lg">
                  <SectionHeader
                    eyebrow="Prompt Language"
                    title="Copy and interface semantics for LLMs"
                    description="These guidance sets exist so prompts can target EMA’s interface register directly."
                  />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--pn-space-4)", marginTop: "var(--pn-space-4)" }}>
                    <GlassCard title="Preferred Verbs">
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--pn-space-2)" }}>
                        {patternLanguage.copyGuidance.preferredVerbs.map((verb) => (
                          <span key={verb} style={{ fontSize: "0.74rem", color: "var(--color-pn-teal-300)" }}>{verb}</span>
                        ))}
                      </div>
                    </GlassCard>
                    <GlassCard title="Avoid">
                      <div style={{ display: "flex", flexDirection: "column", gap: "var(--pn-space-2)" }}>
                        {patternLanguage.copyGuidance.avoid.map((entry) => (
                          <div key={entry} style={{ color: "var(--pn-text-secondary)", fontSize: "0.78rem" }}>{entry}</div>
                        ))}
                      </div>
                    </GlassCard>
                  </div>
                </GlassSurface>
              </>
            )}
        </div>
      }
      rail={rail}
    />
  );
}
