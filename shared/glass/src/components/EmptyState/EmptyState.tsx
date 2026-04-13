import type { ReactNode } from "react";
import styles from "./EmptyState.module.css";

interface EmptyStateProps {
  /** Short category glyph. Pick from ☐ ◇ ≡ ✦ ⚡ etc. No emojis. */
  readonly glyph?: string;
  /** Uppercase, 2-4 words. Directive. "No tasks yet." not "Oops, nothing here!" */
  readonly title: string;
  /** One line, action-first. No apologies. */
  readonly description?: string;
  /** Buttons or links. Usually one primary GlassButton. */
  readonly actions?: ReactNode;
}

/**
 * EmptyState — voice-compliant. The old build uses lines like
 *   "Search across tasks, intents, wiki, proposals, and brain dumps"
 *   "Make sure the daemon is running"
 * No exclamation marks, no playful padding. Keep the same register.
 */
export function EmptyState({
  glyph,
  title,
  description,
  actions,
}: EmptyStateProps) {
  return (
    <div className={styles.root} role="status">
      {glyph && <span className={styles.glyph}>{glyph}</span>}
      <h3 className={styles.title}>{title}</h3>
      {description && <p className={styles.description}>{description}</p>}
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
