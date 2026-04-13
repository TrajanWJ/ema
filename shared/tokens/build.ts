/**
 * @ema/tokens build script.
 *
 * Emits three artifacts into dist/:
 *   - tokens.css  — CSS custom properties under :root, prefixed --pn-*
 *   - tokens.json — flat JSON dump (same variable names, no leading --)
 *   - tokens.ts   — a typed `const tokens = { ... } as const satisfies …`
 *
 * Run with: node shared/tokens/build.ts
 *
 * Zero external deps. Node 22.18+ / 23.6+ strips TS types natively; that's
 * why this file is written as real TypeScript but runs under plain node.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { tokens } from "./src/index.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, "dist");
mkdirSync(distDir, { recursive: true });

type Flat = Record<string, string | number>;

const flat: Flat = {};

const put = (key: string, value: string | number): void => {
  flat[key] = value;
};

// ---- base / void ----
for (const [k, v] of Object.entries(tokens.base)) {
  put(`color-pn-${k.toLowerCase()}`, v);
}

// ---- ramps ----
for (const [rampName, ramp] of Object.entries(tokens.ramps)) {
  for (const [stop, hex] of Object.entries(ramp)) {
    put(`color-pn-${rampName}-${stop}`, hex);
  }
}

// ---- semantic ----
for (const [k, v] of Object.entries(tokens.semantic)) {
  put(`color-pn-${k}`, v);
}

// ---- text layer ----
for (const [k, v] of Object.entries(tokens.textColor)) {
  put(`pn-text-${k}`, v);
}

// ---- borders / field bg / dropdown ----
for (const [k, v] of Object.entries(tokens.borders)) {
  put(`pn-border-${k}`, v);
}
for (const [k, v] of Object.entries(tokens.fieldBg)) {
  put(`pn-field-bg${k === "base" ? "" : `-${k}`}`, v);
}
for (const [k, v] of Object.entries(tokens.dropdown)) {
  put(`pn-dropdown-${k === "bg" ? "bg" : k === "bgSolid" ? "bg-solid" : k}`, v);
}

// ---- shadows ----
for (const [k, v] of Object.entries(tokens.shadows)) {
  put(`pn-shadow-${k.replace(/([A-Z])/g, "-$1").toLowerCase()}`, v);
}

// ---- glass tiers ----
for (const [name, tier] of Object.entries(tokens.glass)) {
  put(`pn-glass-${name}-bg`, tier.background);
  put(`pn-glass-${name}-blur`, `${tier.blur}px`);
  put(`pn-glass-${name}-saturate`, `${tier.saturate}%`);
  if ("border" in tier && tier.border !== undefined) {
    put(`pn-glass-${name}-border`, tier.border);
  }
}

// ---- window layers ----
for (const [k, v] of Object.entries(tokens.windowLayers)) {
  put(`pn-window-${k}`, v);
}

// ---- motion ----
put("ease-smooth", tokens.easing.smooth);
for (const [k, v] of Object.entries(tokens.duration)) {
  put(`pn-duration-${k}`, `${v}ms`);
}

// ---- typography ----
put("font-sans", tokens.fontFamily.sans);
put("font-mono", tokens.fontFamily.mono);

// ---- spacing / radii ----
for (const [k, v] of Object.entries(tokens.spacing)) {
  put(`pn-space-${k.replace(".", "_")}`, v);
}
for (const [k, v] of Object.entries(tokens.radii)) {
  put(`pn-radius-${k}`, v);
}

// ---------- Emit tokens.css ----------

const cssLines: string[] = [];
cssLines.push("/* @ema/tokens — generated. Do not edit. Run `node build.ts`. */");
cssLines.push(":root {");
for (const [k, v] of Object.entries(flat)) {
  cssLines.push(`  --${k}: ${v};`);
}
cssLines.push("}");
cssLines.push("");

// Glass utility classes (stacked on top of custom properties so vApps can
// choose between the CSS class or the raw token).
cssLines.push("/* Glass tier utilities */");
for (const [name, tier] of Object.entries(tokens.glass)) {
  cssLines.push(`.${tier.name} {`);
  cssLines.push(`  background: ${tier.background};`);
  cssLines.push(
    `  backdrop-filter: blur(${tier.blur}px) saturate(${tier.saturate}%);`,
  );
  cssLines.push(
    `  -webkit-backdrop-filter: blur(${tier.blur}px) saturate(${tier.saturate}%);`,
  );
  if ("border" in tier && tier.border !== undefined) {
    cssLines.push(`  border: 1px solid ${tier.border};`);
  }
  cssLines.push("}");
  void name;
}
cssLines.push("");

// Keyframes.
cssLines.push("/* Keyframes */");
for (const [name, body] of Object.entries(tokens.keyframes)) {
  cssLines.push(`@keyframes ${name} { ${body} }`);
}
cssLines.push("");

writeFileSync(resolve(distDir, "tokens.css"), cssLines.join("\n"), "utf8");

// ---------- Emit tokens.json ----------

writeFileSync(
  resolve(distDir, "tokens.json"),
  JSON.stringify({ flat, tree: tokens }, null, 2),
  "utf8",
);

// ---------- Emit tokens.ts ----------

const tsOut = [
  "// @ema/tokens — generated. Do not edit. Run `node build.ts`.",
  "// Full token tree, frozen at build time.",
  "",
  `export const tokens = ${JSON.stringify(tokens, null, 2)} as const;`,
  "",
  `export const flat = ${JSON.stringify(flat, null, 2)} as const;`,
  "",
  "export type Tokens = typeof tokens;",
  "export type Flat = typeof flat;",
  "",
].join("\n");

writeFileSync(resolve(distDir, "tokens.ts"), tsOut, "utf8");

const summary = {
  css: resolve(distDir, "tokens.css"),
  json: resolve(distDir, "tokens.json"),
  ts: resolve(distDir, "tokens.ts"),
  flatCount: Object.keys(flat).length,
};

process.stdout.write(
  `@ema/tokens build OK — ${summary.flatCount} variables emitted\n` +
    `  ${summary.css}\n` +
    `  ${summary.json}\n` +
    `  ${summary.ts}\n`,
);
