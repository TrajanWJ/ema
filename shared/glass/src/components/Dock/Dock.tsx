import type { CSSProperties } from "react";
import { Tooltip } from "../Tooltip/Tooltip.tsx";
import styles from "./Dock.module.css";

export interface DockItem {
  readonly id: string;
  readonly label: string;
  /** Single-char glyph. See EMA-VOICE: ☐ ◇ ≡ ✦ ⚡ etc. No emojis. */
  readonly icon: string;
  /** CSS color. Use a value from @ema/tokens when possible. */
  readonly accent?: string;
  /** True if the app window is currently open. Drives the running dot. */
  readonly running?: boolean;
}

interface DockProps {
  /** Top "home" slot — usually the launchpad. */
  readonly home?: DockItem;
  /** Main items in launchpad group order. */
  readonly items: readonly DockItem[];
  /** Bottom items (e.g. settings). */
  readonly footer?: readonly DockItem[];
  /** Which item id is currently focused/active. */
  readonly activeId?: string;
  readonly onSelect: (id: string) => void;
}

interface DockButtonProps {
  readonly item: DockItem;
  readonly active: boolean;
  readonly onSelect: (id: string) => void;
}

function DockButton({ item, active, onSelect }: DockButtonProps) {
  const cls = [styles.item, active ? styles.itemActive : undefined]
    .filter(Boolean)
    .join(" ");
  // React's CSSProperties type doesn't permit CSS custom properties (--foo)
  // without an assertion. The style is still type-safe; only the key shape
  // is being widened.
  const style = {
    "--dock-accent": item.accent ?? "var(--color-pn-teal-400)",
  } as CSSProperties;
  return (
    <Tooltip label={item.label}>
      <button
        type="button"
        className={cls}
        style={style}
        onClick={() => onSelect(item.id)}
        aria-label={item.label}
        aria-current={active ? "page" : undefined}
      >
        {active && <span className={styles.indicator} />}
        {item.icon}
        {item.running && <span className={styles.runningDot} />}
      </button>
    </Tooltip>
  );
}

/**
 * Dock — 52px left rail with per-app accent, running-dot indicator, tooltips.
 * Ports layout/Dock.tsx but stays data-driven: the host supplies items. This
 * keeps the glass package unopinionated about the vApp catalog.
 */
export function Dock({ home, items, footer, activeId, onSelect }: DockProps) {
  return (
    <div className={styles.root}>
      <nav className={styles.nav}>
        {home && (
          <>
            <DockButton
              item={home}
              active={activeId === home.id}
              onSelect={onSelect}
            />
            <div className={styles.sep} />
          </>
        )}
        {items.map((item) => (
          <DockButton
            key={item.id}
            item={item}
            active={activeId === item.id}
            onSelect={onSelect}
          />
        ))}
      </nav>
      {footer && footer.length > 0 && (
        <>
          <div className={styles.sep} />
          {footer.map((item) => (
            <DockButton
              key={item.id}
              item={item}
              active={activeId === item.id}
              onSelect={onSelect}
            />
          ))}
        </>
      )}
    </div>
  );
}
