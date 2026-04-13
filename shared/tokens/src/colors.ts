/**
 * Color tokens.
 *
 * Anchor stops (900 / 500 / 400 / 50) for teal, blue, amber come verbatim from
 * SELF-POLLINATION-FINDINGS Appendix A.8. These hex values are NON-NEGOTIABLE
 * and must not be rounded or adjusted.
 *
 * Base / void scale is also verbatim from Appendix A.8.
 *
 * NEW RAMPS:
 *  - rose   → anchored on #f43f5e (Focus app accent, observed in old build)
 *  - purple → anchored on #a78bfa (Proposals / Agents accent)
 *
 * EXPANSION METHODOLOGY:
 *  The old build only defined 900 / 500 / 400 / 50. We expand every ramp to a
 *  full 50/100/200/300/400/500/600/700/800/900 scale by interpolating in OKLCH
 *  space (perceptual) rather than sRGB. OKLCH is implemented from scratch in
 *  this file (zero external deps) because the build script must run on plain
 *  node with no installs.
 *
 *  The 900/500/400/50 anchors are preserved EXACTLY. Intermediate stops
 *  (100/200/300/600/700/800) are interpolated by:
 *    - converting each anchor to OKLCH
 *    - laying a monotone L (lightness) curve over the 50..900 range
 *    - picking intermediate points along the piecewise-linear OKLCH path
 *      between adjacent anchors
 *    - converting back to sRGB and emitting as #RRGGBB
 *
 *  For the new ramps (rose, purple) where we only have a single anchor, we
 *  generate the full scale by sweeping lightness in OKLCH from ~0.97 (50) to
 *  ~0.18 (900) while interpolating chroma toward the anchor. Same deterministic
 *  function, applied to a synthetic anchor set.
 */

export type HexColor = `#${string}`;

type Oklch = { l: number; c: number; h: number };
type Rgb = { r: number; g: number; b: number };

// ---------- sRGB <-> OKLCH ----------

const srgbToLinear = (v: number): number =>
  v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);

const linearToSrgb = (v: number): number =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;

const hexToRgb = (hex: HexColor): Rgb => {
  const h = hex.slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
};

const rgbToHex = ({ r, g, b }: Rgb): HexColor => {
  const clamp = (v: number): number => Math.max(0, Math.min(1, v));
  const to2 = (v: number): string =>
    Math.round(clamp(v) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to2(r)}${to2(g)}${to2(b)}`;
};

const rgbToOklab = ({ r, g, b }: Rgb): { L: number; a: number; bb: number } => {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    bb: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
};

const oklabToRgb = ({ L, a, bb }: { L: number; a: number; bb: number }): Rgb => {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * bb;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * bb;
  const s_ = L - 0.0894841775 * a - 1.291485548 * bb;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return {
    r: linearToSrgb(lr),
    g: linearToSrgb(lg),
    b: linearToSrgb(lb),
  };
};

const hexToOklch = (hex: HexColor): Oklch => {
  const { L, a, bb } = rgbToOklab(hexToRgb(hex));
  const c = Math.sqrt(a * a + bb * bb);
  const h = ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;
  return { l: L, c, h };
};

const oklchToHex = ({ l, c, h }: Oklch): HexColor => {
  const rad = (h * Math.PI) / 180;
  const a = Math.cos(rad) * c;
  const bb = Math.sin(rad) * c;
  return rgbToHex(oklabToRgb({ L: l, a, bb }));
};

// ---------- Ramp expansion ----------

const STOPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
export type Stop = (typeof STOPS)[number];

/**
 * Lightness curve across the 50..900 scale. Hand-tuned to match the observed
 * lightness of the anchor stops in the source palette. Values are OKLCH L
 * (0..1). Monotone decreasing.
 */
const LIGHTNESS_CURVE: Record<Stop, number> = {
  50: 0.97,
  100: 0.93,
  200: 0.87,
  300: 0.79,
  400: 0.74,
  500: 0.62,
  600: 0.52,
  700: 0.42,
  800: 0.32,
  900: 0.24,
};

type AnchorMap = Partial<Record<Stop, HexColor>>;

/**
 * Given a partial anchor map, produce a full 50..900 ramp. Anchors are
 * preserved verbatim. Intermediate stops are interpolated in OKLCH between
 * the two nearest anchors, using LIGHTNESS_CURVE to drive L and linear
 * interpolation for C and (shortest-path) H.
 */
const expandRamp = (anchors: AnchorMap): Record<Stop, HexColor> => {
  const anchorStops = (Object.keys(anchors) as Array<`${Stop}`>)
    .map((k) => Number(k) as Stop)
    .sort((a, b) => a - b);

  if (anchorStops.length === 0) {
    throw new Error("expandRamp: at least one anchor required");
  }

  const anchorOklch = new Map<Stop, Oklch>();
  for (const s of anchorStops) {
    const hex = anchors[s];
    if (hex === undefined) continue;
    anchorOklch.set(s, hexToOklch(hex));
  }

  const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

  const lerpHue = (a: number, b: number, t: number): number => {
    let d = b - a;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return (a + d * t + 360) % 360;
  };

  const out = {} as Record<Stop, HexColor>;
  for (const stop of STOPS) {
    const exact = anchors[stop];
    if (exact !== undefined) {
      out[stop] = exact;
      continue;
    }

    // Find bracketing anchors.
    let lo: Stop | undefined;
    let hi: Stop | undefined;
    for (const s of anchorStops) {
      if (s <= stop) lo = s;
      if (s >= stop && hi === undefined) hi = s;
    }

    // Extrapolate outside anchor range using lightness curve alone, locking
    // hue + chroma to the nearest anchor.
    if (lo === undefined && hi !== undefined) {
      const ref = anchorOklch.get(hi);
      if (!ref) throw new Error("missing anchor oklch");
      out[stop] = oklchToHex({ l: LIGHTNESS_CURVE[stop], c: ref.c * 0.6, h: ref.h });
      continue;
    }
    if (hi === undefined && lo !== undefined) {
      const ref = anchorOklch.get(lo);
      if (!ref) throw new Error("missing anchor oklch");
      out[stop] = oklchToHex({ l: LIGHTNESS_CURVE[stop], c: ref.c * 0.85, h: ref.h });
      continue;
    }
    if (lo === undefined || hi === undefined) {
      throw new Error("expandRamp: unreachable bracket state");
    }

    const loC = anchorOklch.get(lo);
    const hiC = anchorOklch.get(hi);
    if (!loC || !hiC) throw new Error("missing bracket oklch");
    const t = lo === hi ? 0 : (stop - lo) / (hi - lo);
    out[stop] = oklchToHex({
      l: LIGHTNESS_CURVE[stop],
      c: lerp(loC.c, hiC.c, t),
      h: lerpHue(loC.h, hiC.h, t),
    });
  }

  return out;
};

// ---------- Base / void scale (verbatim A.8) ----------

export const base = {
  void: "#060610",
  base: "#08090E",
  surface1: "#0E1017",
  surface2: "#141620",
  surface3: "#1A1D2A",
} as const satisfies Record<string, HexColor>;

// ---------- Brand ramps ----------

// Anchors verbatim from Appendix A.8.
const tealAnchors = {
  50: "#CCFBF1",
  400: "#2DD4A8",
  500: "#0D9373",
  900: "#064E3B",
} as const satisfies AnchorMap;

const blueAnchors = {
  50: "#E0ECFD",
  400: "#6B95F0",
  500: "#4B7BE5",
  900: "#1E3A6E",
} as const satisfies AnchorMap;

const amberAnchors = {
  50: "#FEF3C7",
  400: "#F59E0B",
  500: "#D97706",
  900: "#78350F",
} as const satisfies AnchorMap;

// New ramps — single-anchor expansions from the Focus / Proposals accents.
const roseAnchors = {
  500: "#f43f5e",
} as const satisfies AnchorMap;

const purpleAnchors = {
  400: "#a78bfa",
} as const satisfies AnchorMap;

export const teal = expandRamp(tealAnchors);
export const blue = expandRamp(blueAnchors);
export const amber = expandRamp(amberAnchors);
export const rose = expandRamp(roseAnchors);
export const purple = expandRamp(purpleAnchors);

export const ramps = { teal, blue, amber, rose, purple } as const;

export type RampName = keyof typeof ramps;

// Expose the OKLCH helpers so the build script (and tests) can reproduce
// the interpolation deterministically.
export const _internal = { hexToOklch, oklchToHex, expandRamp, STOPS } as const;
