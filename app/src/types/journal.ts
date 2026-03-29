export interface JournalEntry {
  readonly id: string;
  readonly date: string;
  readonly content: string;
  readonly one_thing: string | null;
  readonly mood: number | null;
  readonly energy_p: number | null;
  readonly energy_m: number | null;
  readonly energy_e: number | null;
  readonly gratitude: string | null;
  readonly tags: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export const MOOD_LABELS: Record<number, string> = {
  1: "Rough",
  2: "Low",
  3: "Okay",
  4: "Good",
  5: "Great",
};

export const MOOD_COLORS: Record<number, string> = {
  1: "var(--color-pn-error)",
  2: "var(--color-pn-tertiary-400)",
  3: "var(--pn-text-secondary)",
  4: "var(--color-pn-secondary-400)",
  5: "var(--color-pn-success)",
};
