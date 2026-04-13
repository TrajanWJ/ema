import { writeFileSync } from 'node:fs';

import { printJson, printTable } from './table-printer.js';

export type OutputFormat = 'table' | 'json' | 'yaml';

export interface PrintOptions {
  readonly columns?: readonly string[];
}

export function printValue(
  value: unknown,
  format: OutputFormat,
  options: PrintOptions = {},
): void {
  if (format === 'json') {
    printJson(value);
    return;
  }

  if (format === 'yaml') {
    // eslint-disable-next-line no-console
    console.log(toYaml(value));
    return;
  }

  printTableValue(value, options);
}

export function writeFormattedFile(
  absPath: string,
  value: unknown,
  format: Exclude<OutputFormat, 'table'>,
): void {
  const body = format === 'json'
    ? `${JSON.stringify(value, null, 2)}\n`
    : `${toYaml(value)}\n`;
  writeFileSync(absPath, body, 'utf8');
}

function printTableValue(value: unknown, options: PrintOptions): void {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      // eslint-disable-next-line no-console
      console.log('(empty)');
      return;
    }

    const rows = value.filter(isRecord);
    if (rows.length !== value.length) {
      // eslint-disable-next-line no-console
      console.log(String(value));
      return;
    }

    const columns = options.columns ?? collectColumns(rows);
    printTable(
      columns.map((header) => ({ header })),
      rows.map((row) => columns.map((column) => formatCell(row[column]))),
    );
    return;
  }

  if (isRecord(value)) {
    const columns = ['key', 'value'] as const;
    const rows = Object.entries(value).map(([key, entry]) => [
      key,
      formatCell(entry),
    ]);
    printTable(
      columns.map((header) => ({ header })),
      rows,
    );
    return;
  }

  if (typeof value === 'string') {
    // eslint-disable-next-line no-console
    console.log(value);
    return;
  }

  // eslint-disable-next-line no-console
  console.log(formatCell(value));
}

function collectColumns(rows: readonly Record<string, unknown>[]): string[] {
  const keys = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      keys.add(key);
    }
  }
  return [...keys];
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function toYaml(value: unknown, indent = 0): string {
  const pad = '  '.repeat(indent);

  if (value === null) return 'null';
  if (value === undefined) return 'null';
  if (typeof value === 'string') return quoteYaml(value);
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return value
      .map((entry) => {
        if (isScalar(entry)) {
          return `${pad}- ${toYaml(entry, indent + 1)}`;
        }
        const rendered = toYaml(entry, indent + 1)
          .split('\n')
          .map((line, index) => (index === 0 ? `${pad}- ${line}` : `${pad}  ${line}`))
          .join('\n');
        return rendered;
      })
      .join('\n');
  }

  if (isRecord(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) return '{}';
    return entries
      .map(([key, entry]) => {
        if (isScalar(entry)) {
          return `${pad}${key}: ${toYaml(entry, indent + 1)}`;
        }
        const rendered = toYaml(entry, indent + 1)
          .split('\n')
          .map((line) => `${pad}  ${line}`)
          .join('\n');
        return `${pad}${key}:\n${rendered}`;
      })
      .join('\n');
  }

  return quoteYaml(String(value));
}

function isScalar(value: unknown): value is string | number | boolean | null | undefined {
  return (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

function quoteYaml(value: string): string {
  if (value.length === 0) return '""';
  if (/^[a-zA-Z0-9_./:-]+$/.test(value)) return value;
  return JSON.stringify(value);
}
