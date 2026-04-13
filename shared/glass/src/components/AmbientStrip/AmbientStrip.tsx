import { useEffect, useState, type ReactNode } from "react";
import styles from "./AmbientStrip.module.css";

interface AmbientStripProps {
  /** Uppercase short title. Default: "ema". Directive, no emojis. */
  readonly title?: string;
  /** Rendered in the right-hand cluster before the traffic lights. */
  readonly orgSwitcher?: ReactNode;
  /** Rendered between the title and the clock. Keep short — it scrolls off. */
  readonly ticker?: string;
  /** Hook up real window controls. Pass noop if the host has none. */
  readonly onMinimize?: () => void;
  readonly onMaximize?: () => void;
  readonly onClose?: () => void;
  /** Hide traffic lights when embedded inside a bigger shell. */
  readonly showTrafficLights?: boolean;
}

function formatNow(now: Date): string {
  const time = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const date = now.toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return `${time} · ${date}`;
}

function useClock(): string {
  const [time, setTime] = useState(() => formatNow(new Date()));
  useEffect(() => {
    const id = setInterval(() => setTime(formatNow(new Date())), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

/**
 * AmbientStrip — top chrome. Clock `HH:MM · Day Num Mon`, uppercase app title,
 * org switcher slot, ticker slot, traffic lights. Ported from
 * layout/AmbientStrip.tsx; the Tauri window hooks are stripped — pass
 * onMinimize/onMaximize/onClose callbacks instead.
 *
 * The root element is -webkit-app-region: drag so Electron treats it as the
 * drag region. All interactive children use the .noDrag escape class.
 */
export function AmbientStrip({
  title = "ema",
  orgSwitcher,
  ticker,
  onMinimize,
  onMaximize,
  onClose,
  showTrafficLights = true,
}: AmbientStripProps) {
  const clock = useClock();

  return (
    <div className={styles.root}>
      <span className={styles.title}>{title}</span>
      <div className={styles.center}>
        {ticker && <span className={styles.ticker}>{ticker}</span>}
        <span className={styles.clock}>{clock}</span>
      </div>
      <div className={styles.right}>
        {orgSwitcher && <div className={styles.noDrag}>{orgSwitcher}</div>}
        {showTrafficLights && (
          <div className={styles.lights}>
            <button
              type="button"
              aria-label="Minimize window"
              className={`${styles.light} ${styles.lightMin}`}
              onClick={onMinimize}
            />
            <button
              type="button"
              aria-label="Maximize window"
              className={`${styles.light} ${styles.lightMax}`}
              onClick={onMaximize}
            />
            <button
              type="button"
              aria-label="Close window"
              className={`${styles.light} ${styles.lightClose}`}
              onClick={onClose}
            />
          </div>
        )}
      </div>
    </div>
  );
}
