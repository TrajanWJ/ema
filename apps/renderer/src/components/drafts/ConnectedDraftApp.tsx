import { getAppCatalogEntry, readinessLabel } from "@/config/app-catalog";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { openApp } from "@/lib/window-manager";
import { APP_CONFIGS } from "@/types/workspace";

import type { DraftDefinition } from "./draft-definitions";

interface ConnectedDraftAppProps {
  readonly definition: DraftDefinition;
}

export function ConnectedDraftApp({ definition }: ConnectedDraftAppProps) {
  const config = APP_CONFIGS[definition.appId];
  const catalogEntry = getAppCatalogEntry(definition.appId);

  return (
    <AppWindowChrome
      appId={definition.appId}
      title={config?.title ?? definition.headline}
      icon={config?.icon ?? "□"}
      accent={config?.accent ?? "#6b95f0"}
      breadcrumb={definition.status}
    >
      <div className="flex min-h-full flex-col gap-4">
        <section
          className="relative overflow-hidden rounded-[28px] border p-6"
          style={{
            borderColor: "rgba(255,255,255,0.08)",
            background:
              "radial-gradient(circle at top right, rgba(255,255,255,0.12), transparent 35%), linear-gradient(145deg, rgba(16,18,27,0.95), rgba(7,9,14,0.86))",
            boxShadow: "0 28px 90px rgba(0,0,0,0.28)",
          }}
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(110deg, rgba(255,255,255,0.035), transparent 30%, transparent 70%, rgba(255,255,255,0.025))",
            }}
          />
          <div className="relative grid gap-5 xl:grid-cols-[1.5fr_0.9fr]">
            <div className="min-w-0">
              <div
                className="text-[0.66rem] font-semibold uppercase tracking-[0.24em]"
                style={{ color: config?.accent ?? "#6b95f0" }}
              >
                {definition.eyebrow}
              </div>
              <h1
                className="mt-3 max-w-4xl text-[1.7rem] font-semibold leading-[1.08]"
                style={{ color: "rgba(255,255,255,0.94)" }}
              >
                {definition.headline}
              </h1>
              <p
                className="mt-4 max-w-3xl text-[0.84rem] leading-[1.7]"
                style={{ color: "var(--pn-text-secondary)" }}
              >
                {definition.summary}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Pill label={definition.status} color={config?.accent ?? "#6b95f0"} />
                <Pill
                  label={
                    definition.maturity === "connected-preview"
                      ? "Connected preview"
                      : "First draft"
                  }
                />
                {catalogEntry ? (
                  <Pill label={`${readinessLabel(catalogEntry.readiness)} surface`} />
                ) : null}
              </div>
            </div>

            <div
              className="rounded-[24px] border p-4"
              style={{
                borderColor: "rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.04)",
                backdropFilter: "blur(16px)",
              }}
            >
              <div
                className="text-[0.64rem] font-semibold uppercase tracking-[0.18em]"
                style={{ color: "var(--pn-text-muted)" }}
              >
                Primary Question
              </div>
              <div
                className="mt-3 text-[1rem] font-medium leading-[1.45]"
                style={{ color: "rgba(255,255,255,0.9)" }}
              >
                {definition.primaryQuestion}
              </div>
              {catalogEntry?.summary ? (
                <div
                  className="mt-4 rounded-2xl border px-3 py-3 text-[0.72rem] leading-[1.6]"
                  style={{
                    borderColor: "rgba(255,255,255,0.07)",
                    background: "rgba(0,0,0,0.18)",
                    color: "var(--pn-text-secondary)",
                  }}
                >
                  {catalogEntry.summary}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[1.05fr_1fr]">
          <DraftSection
            title="Current Truth"
            subtitle="What this app can honestly claim right now."
            items={definition.currentTruth}
          />
          <DraftSection
            title="What This Draft Supports"
            subtitle="Why this app still matters in the live system."
            items={definition.draftCapabilities}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.05fr_1fr]">
          <DraftSection
            title="Build Tracks"
            subtitle="The cleanest next expansion paths when backend ownership is ready."
            items={definition.buildTracks}
          />
          <section
            className="rounded-[24px] border p-5"
            style={{
              borderColor: "rgba(255,255,255,0.08)",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.02))",
              boxShadow: "0 20px 48px rgba(0,0,0,0.18)",
            }}
          >
            <div
              className="text-[0.64rem] font-semibold uppercase tracking-[0.18em]"
              style={{ color: "var(--pn-text-muted)" }}
            >
              Related Live Surfaces
            </div>
            <div className="mt-4 grid gap-3">
              {definition.relatedActions.map((action) => {
                const relatedConfig = APP_CONFIGS[action.appId];
                return (
                  <button
                    key={`${definition.appId}-${action.appId}-${action.label}`}
                    type="button"
                    onClick={() => void openApp(action.appId)}
                    className="rounded-[18px] border px-4 py-4 text-left transition-transform hover:-translate-y-[1px]"
                    style={{
                      borderColor: "rgba(255,255,255,0.08)",
                      background: "rgba(6,8,14,0.46)",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-9 w-9 items-center justify-center rounded-2xl text-[0.95rem]"
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          color: relatedConfig?.accent ?? "#6b95f0",
                          border: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        {relatedConfig?.icon ?? "→"}
                      </span>
                      <div className="min-w-0">
                        <div
                          className="text-[0.8rem] font-semibold"
                          style={{ color: "rgba(255,255,255,0.9)" }}
                        >
                          {action.label}
                        </div>
                        <div
                          className="mt-1 text-[0.7rem] leading-[1.55]"
                          style={{ color: "var(--pn-text-secondary)" }}
                        >
                          {action.note}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <DraftSection
          title="Operator Notes"
          subtitle="Guidance for using this draft without teaching the wrong product behavior."
          items={definition.operatorNotes}
        />
      </div>
    </AppWindowChrome>
  );
}

function DraftSection({
  title,
  subtitle,
  items,
}: {
  readonly title: string;
  readonly subtitle: string;
  readonly items: readonly string[];
}) {
  return (
    <section
      className="rounded-[24px] border p-5"
      style={{
        borderColor: "rgba(255,255,255,0.08)",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.02))",
        boxShadow: "0 20px 48px rgba(0,0,0,0.18)",
      }}
    >
      <div
        className="text-[0.64rem] font-semibold uppercase tracking-[0.18em]"
        style={{ color: "var(--pn-text-muted)" }}
      >
        {title}
      </div>
      <p
        className="mt-2 max-w-2xl text-[0.72rem] leading-[1.6]"
        style={{ color: "var(--pn-text-secondary)" }}
      >
        {subtitle}
      </p>
      <div className="mt-4 grid gap-3">
        {items.map((item, index) => (
          <div
            key={`${title}-${index}`}
            className="rounded-[18px] border px-4 py-3"
            style={{
              borderColor: "rgba(255,255,255,0.06)",
              background: "rgba(6,8,14,0.34)",
            }}
          >
            <div className="flex gap-3">
              <span
                className="mt-[2px] block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: "rgba(255,255,255,0.32)" }}
              />
              <span
                className="text-[0.76rem] leading-[1.65]"
                style={{ color: "rgba(255,255,255,0.84)" }}
              >
                {item}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Pill({ label, color }: { readonly label: string; readonly color?: string }) {
  return (
    <span
      className="rounded-full px-3 py-1 text-[0.64rem] font-semibold uppercase tracking-[0.15em]"
      style={{
        color: color ?? "var(--pn-text-secondary)",
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {label}
    </span>
  );
}
