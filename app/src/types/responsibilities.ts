export interface Responsibility {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly role: string;
  readonly cadence: string;
  readonly health: number;
  readonly active: boolean;
  readonly last_checked_at: string | null;
  readonly project_id: string | null;
  readonly created_at: string;
}

export interface CheckIn {
  readonly id: string;
  readonly status: "healthy" | "at_risk" | "failing";
  readonly note: string | null;
  readonly created_at: string;
}
