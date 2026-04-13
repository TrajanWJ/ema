import type { ReactNode } from "react";

import { GridPattern } from "../../assets/GridPattern.tsx";
import { SignalOrb } from "../../assets/SignalOrb.tsx";

interface HeroBannerProps {
  readonly eyebrow?: string;
  readonly title: string;
  readonly description?: string;
  readonly tone?: string;
  readonly actions?: ReactNode;
  readonly aside?: ReactNode;
}

export function HeroBanner({
  eyebrow,
  title,
  description,
  tone = "var(--color-pn-teal-400)",
  actions,
  aside,
}: HeroBannerProps) {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: "calc(var(--pn-radius-xl) + 2px)",
        border: "1px solid var(--pn-border-default)",
        background: [
          `linear-gradient(135deg, color-mix(in srgb, ${tone} 14%, transparent), transparent 44%)`,
          "var(--pn-gradient-editorial)",
        ].join(", "),
        padding: "var(--pn-space-6)",
      }}
    >
      <GridPattern opacity={0.08} size={24} />
      <SignalOrb
        tone={tone}
        size={220}
        style={{ position: "absolute", right: -40, top: -30, opacity: 0.78 }}
      />
      <div
        style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: aside ? "minmax(0, 1.4fr) minmax(15rem, 0.8fr)" : "minmax(0, 1fr)",
          gap: "var(--pn-space-5)",
          alignItems: "start",
        }}
      >
        <div style={{ maxWidth: "var(--pn-layout-reading-measure)" }}>
          {eyebrow && (
            <div
              style={{
                marginBottom: "var(--pn-space-2)",
                color: "var(--pn-text-muted)",
                fontSize: "0.68rem",
                textTransform: "uppercase",
                letterSpacing: "0.16em",
              }}
            >
              {eyebrow}
            </div>
          )}
          <div
            style={{
              fontSize: "clamp(1.7rem, 2vw, 2.4rem)",
              lineHeight: 1.02,
              fontWeight: 680,
              color: "var(--pn-text-primary)",
            }}
          >
            {title}
          </div>
          {description && (
            <div
              style={{
                marginTop: "var(--pn-space-3)",
                color: "var(--pn-text-secondary)",
                fontSize: "0.92rem",
                lineHeight: 1.6,
              }}
            >
              {description}
            </div>
          )}
          {actions && (
            <div style={{ display: "flex", gap: "var(--pn-space-2)", flexWrap: "wrap", marginTop: "var(--pn-space-4)" }}>
              {actions}
            </div>
          )}
        </div>
        {aside && <div style={{ position: "relative" }}>{aside}</div>}
      </div>
    </div>
  );
}
