export interface Organization {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly avatar_url: string | null;
  readonly owner_id: string;
  readonly settings: Record<string, unknown>;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface OrgMember {
  readonly id: string;
  readonly organization_id: string;
  readonly display_name: string;
  readonly email: string | null;
  readonly role: "owner" | "admin" | "member" | "guest";
  readonly public_key: string | null;
  readonly status: "active" | "invited" | "suspended";
  readonly joined_at: string | null;
  readonly last_seen_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface OrgInvitation {
  readonly id: string;
  readonly organization_id: string;
  readonly token: string;
  readonly role: OrgMember["role"];
  readonly created_by: string;
  readonly expires_at: string | null;
  readonly max_uses: number | null;
  readonly use_count: number;
  readonly used_by: readonly string[];
  readonly revoked: boolean;
  readonly link: string;
  readonly created_at: string;
}
