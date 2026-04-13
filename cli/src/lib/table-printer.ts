// table-printer.ts
//
// Small wrapper around cli-table3. All CLI output in EMA is meant to be
// visually consistent — cyan headers, no row separators, dim borders,
// right-aligned numeric columns. Centralizing it here means commands
// don't each reinvent the formatting.
//
// `cli-table3` does not export ES types cleanly in v0.6, so we use the
// default import and cast through `any` in one spot. This is load-bearing
// — don't tighten it without verifying a newer release ships ESM types.

import chalk from 'chalk';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import Table from 'cli-table3';

export interface ColumnSpec {
  readonly header: string;
  /** 'left' (default) | 'right' | 'center' */
  readonly align?: 'left' | 'right' | 'center';
  /** Optional column width cap. Long cells get wrapped. */
  readonly width?: number;
}

/**
 * Print a structured table. Prefer this over ad-hoc console.log grids.
 *
 * @param columns describes headers + alignment
 * @param rows array of row-arrays; each row must match columns.length
 */
export function printTable(
  columns: readonly ColumnSpec[],
  rows: ReadonlyArray<ReadonlyArray<string>>,
): void {
  // cli-table3's types for the options object are loose — keep the cast
  // scoped to this one allocation so typos elsewhere still get caught.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const opts: any = {
    head: columns.map((c) => chalk.cyan(c.header)),
    style: { head: [], border: ['dim'] },
    colAligns: columns.map((c) => c.align ?? 'left'),
  };
  const widths = columns.map((c) => c.width);
  if (widths.some((w) => typeof w === 'number')) {
    opts.colWidths = widths.map((w) => (typeof w === 'number' ? w : null));
  }

  const table = new Table(opts);
  for (const row of rows) {
    table.push([...row]);
  }
  // eslint-disable-next-line no-console
  console.log(table.toString());
}

/** Dimmed separator line. Used between stats sections. */
export function printRule(width = 60): void {
  // eslint-disable-next-line no-console
  console.log(chalk.dim('─'.repeat(width)));
}

/** Heading + blank line. Used above tables. */
export function printHeading(text: string): void {
  // eslint-disable-next-line no-console
  console.log(chalk.bold(text));
}

/** JSON shortcut — always 2-space indent, no trailing newline omitted. */
export function printJson(value: unknown): void {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(value, null, 2));
}

/**
 * Truncate to `max` chars, appending an ellipsis. Used for titles that
 * can easily run past 60 chars in a table.
 */
export function truncate(value: string | undefined, max: number): string {
  if (!value) return '';
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1))}…`;
}

/** Signal-tier colorization. Tier S is brightest. */
export function colorSignalTier(tier: string | undefined): string {
  if (tier === 'S') return chalk.greenBright('S');
  if (tier === 'A') return chalk.yellow('A');
  if (tier === 'B') return chalk.blue('B');
  return chalk.dim('-');
}
