import type { CSSProperties, ReactNode } from "react";
import styles from "./AppWindowChrome.module.css";

export type WindowMode = "embedded" | "standalone";

interface AppWindowChromeProps {
  readonly appId: string;
  readonly title: string;
  /** Single-char glyph. No emojis. */
  readonly icon: string;
  /** CSS color (usually from @ema/tokens). Drives title + icon tint. */
  readonly accent: string;
  /** Optional secondary crumb text. Mono font, muted. */
  readonly breadcrumb?: string;
  /**
   * embedded = inside the launchpad Shell (no traffic lights)
   * standalone = its own BrowserWindow (full chrome + drag region)
   */
  readonly mode?: WindowMode;
  readonly onMinimize?: () => void;
  readonly onMaximize?: () => void;
  readonly onClose?: () => void;
  readonly children: ReactNode;
}

/**
 * AppWindowChrome — dual-mode app frame. Ports layout/AppWindowChrome.tsx.
 * Tauri-specific bits (getCurrentWindow, saveWindowState) are replaced with
 * callback props so Electron hosts can wire up BrowserWindow IPC directly.
 *
 * The standalone header uses -webkit-app-region: drag for Electron frameless
 * windows. Traffic lights escape via -webkit-app-region: no-drag.
 */
export function AppWindowChrome({
  appId,
  title,
  icon,
  accent,
  breadcrumb,
  mode = "embedded",
  onMinimize,
  onMaximize,
  onClose,
  children,
}: AppWindowChromeProps) {
  const embedded = mode === "embedded";
  const titleStyle: CSSProperties = { color: accent };
  const iconStyle: CSSProperties = { color: accent };

  return (
    <div
      data-app-id={appId}
      className={[styles.root, embedded ? undefined : styles.standalone]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={embedded ? styles.headerEmbedded : styles.headerStandalone}>
        <div className={styles.titleGroup}>
          <span className={styles.icon} style={iconStyle}>
            {icon}
          </span>
          <span
            className={[styles.title, embedded ? styles.titleEmbedded : undefined]
              .filter(Boolean)
              .join(" ")}
            style={titleStyle}
          >
            {title}
          </span>
          {breadcrumb && (
            <span
              className={[
                styles.breadcrumb,
                embedded ? styles.breadcrumbEmbedded : undefined,
              ]
                .filter(Boolean)
                .join(" ")}
            >
              &middot; {breadcrumb}
            </span>
          )}
        </div>
        {!embedded && (
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
      <main
        className={[
          styles.body,
          embedded ? styles.bodyEmbedded : styles.bodyStandalone,
        ].join(" ")}
      >
        {children}
      </main>
    </div>
  );
}
