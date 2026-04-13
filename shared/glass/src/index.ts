/**
 * @ema/glass — EMA's React 19 glass component kit.
 *
 * Everything here consumes @ema/tokens. No hex values live in this package.
 * Ports recoverable components from the old Elixir+Tauri build (see
 * SELF-POLLINATION-FINDINGS Appendix A.9) into framework-agnostic React +
 * CSS modules. Tauri-specific window APIs are replaced with callback props.
 *
 * EMA-VOICE compliance: every default label, every empty state, every
 * placeholder is directive, no emojis, no apologies.
 *
 * To use: import `@ema/tokens/css` and `@ema/glass/styles/keyframes.css`
 * in your host app entry, then import components from `@ema/glass`.
 */

// Components
export { AmbientStrip } from "./components/AmbientStrip/index.ts";
export {
  AppWindowChrome,
  type WindowMode,
} from "./components/AppWindowChrome/index.ts";
export { Dock, type DockItem } from "./components/Dock/index.ts";
export {
  CommandBar,
  EMPTY_COMMAND_RESULTS,
  type CommandCategory,
  type CommandResult,
  type CommandResults,
} from "./components/CommandBar/index.ts";
export { GlassCard, type CardSize } from "./components/GlassCard/index.ts";
export { GlassInput, type InputSize } from "./components/GlassInput/index.ts";
export {
  GlassSelect,
  type GlassSelectOption,
  type SelectSize,
} from "./components/GlassSelect/index.ts";
export { Tooltip, type TooltipSide } from "./components/Tooltip/index.ts";
export {
  LoadingSpinner,
  type SpinnerSize,
} from "./components/LoadingSpinner/index.ts";
export {
  GlassButton,
  type ButtonSize,
  type ButtonVariant,
} from "./components/GlassButton/index.ts";
export {
  GlassSurface,
  type GlassTier,
  type GlassPadding,
} from "./components/GlassSurface/index.ts";
export { EmptyState } from "./components/EmptyState/index.ts";
export {
  StatusDot,
  type DotKind,
  type DotSize,
} from "./components/StatusDot/index.ts";

// Templates
export { StandardAppWindow } from "./templates/StandardAppWindow.tsx";
export { EmbeddedLaunchpadWindow } from "./templates/EmbeddedLaunchpadWindow.tsx";
export { ChatAppShell } from "./templates/ChatAppShell.tsx";
export { DashboardShell } from "./templates/DashboardShell.tsx";
export { EditorShell } from "./templates/EditorShell.tsx";
export { ListDetailShell } from "./templates/ListDetailShell.tsx";

// Boilerplates (reference implementations)
export { WorkAppBoilerplate } from "./boilerplates/work-app.boilerplate.tsx";
export { IntelligenceAppBoilerplate } from "./boilerplates/intelligence-app.boilerplate.tsx";
export { CreativeAppBoilerplate } from "./boilerplates/creative-app.boilerplate.tsx";
export { OperationsAppBoilerplate } from "./boilerplates/operations-app.boilerplate.tsx";
export { LifeAppBoilerplate } from "./boilerplates/life-app.boilerplate.tsx";
export { SystemAppBoilerplate } from "./boilerplates/system-app.boilerplate.tsx";

// Hooks
export { useGlassTier, type GlassTierStyle } from "./hooks/useGlassTier.ts";
export { useCommandPalette } from "./hooks/useCommandPalette.ts";
export { useWindowChrome } from "./hooks/useWindowChrome.ts";
