const API_URL = "http://localhost:3002";

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  status?: string;
  color?: string;
  path?: string | null;
  superman_url?: string | null;
  running_count?: number;
  total_executions?: number;
  last_execution?: number | null;
}

export interface DashboardData {
  [key: string]: unknown;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatar_url?: string | null;
  owner_id?: string;
  settings?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface OrgMember {
  id: string;
  organization_id: string;
  display_name: string;
  email: string | null;
  role: "owner" | "admin" | "member" | "guest";
  status?: "active" | "invited" | "suspended";
  created_at?: string;
  updated_at?: string;
}

export interface OrgInvitation {
  id: string;
  organization_id: string;
  role: OrgMember["role"];
  expires_at: string | null;
  max_uses?: number | null;
  use_count: number;
  revoked?: boolean;
  link?: string;
  created_at?: string;
}

export interface Space {
  id: string;
  name: string;
  slug?: string;
  description?: string | null;
  org_id: string;
  space_type: "personal" | "team" | "project" | string;
  icon?: string | null;
  color?: string | null;
  status?: string;
  members?: Array<{ actor_id: string; role?: string }>;
  settings?: Record<string, unknown>;
}

export interface Actor {
  id: string;
  name: string;
  slug: string;
  type: "human" | "agent" | string;
  status: string;
  phase: string;
  phase_started_at?: string | null;
  [key: string]: string | number | boolean | null | undefined;
}

export interface PhaseTransition {
  id?: string;
  actor_id: string;
  from_phase: string | null;
  to_phase: string;
  reason: string | null;
  transitioned_at: string;
  week_number: number | null;
  inserted_at?: string;
}

export interface Intent {
  id: string;
  title: string;
  level: number;
  status: string;
  kind: string;
  parent_id: string | null;
  description: string | null;
  priority: number;
  phase: string | null;
  completion_pct: number | null;
  [key: string]: string | number | boolean | null | undefined;
}

export interface Tag {
  id: string;
  entity_type: string;
  entity_id: string;
  tag: string;
  actor_id?: string;
  namespace: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

function withQuery(
  path: string,
  params?: Record<string, string | number | boolean | null | undefined>,
): string {
  if (!params) return path;

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    query.set(key, String(value));
  }

  const serialized = query.toString();
  return serialized ? `${path}?${serialized}` : path;
}

export const getProjects = () => request<Project[]>("/api/projects");
export const createProject = (data: unknown) =>
  request<Project>("/api/projects", { method: "POST", body: JSON.stringify(data) });
export const getProject = (id: string) => request<Project>(`/api/projects/${id}`);
export const updateProject = (id: string, data: unknown) =>
  request<Project>(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(data) });
export const getProjectContext = (id: string) => request<any>(`/api/projects/${id}/context`);
export const addResource = (projectId: string, data: unknown) =>
  request<any>(`/api/projects/${projectId}/resources`, { method: "POST", body: JSON.stringify(data) });
export const deleteResource = (projectId: string, resourceId: string) =>
  request<any>(`/api/projects/${projectId}/resources/${resourceId}`, { method: "DELETE" });

export const getExecutions = () => request<any[]>("/api/executions");
export const dispatchExecution = (data: unknown) =>
  request<any>("/api/executions/dispatch", { method: "POST", body: JSON.stringify(data) });
export const getExecution = (id: string) => request<any>(`/api/executions/${id}`);

export const getNotes = (projectId: string) => request<any[]>(`/api/projects/${projectId}/notes`);
export const createNote = (projectId: string, data: unknown) =>
  request<any>(`/api/projects/${projectId}/notes`, { method: "POST", body: JSON.stringify(data) });
export const updateNote = (id: string, data: unknown) =>
  request<any>(`/api/notes/${id}`, { method: "PATCH", body: JSON.stringify(data) });

export const getBrainDump = (params?: { status?: string; projectId?: string }) => {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.projectId) query.set("projectId", params.projectId);
  return request<any[]>(`/api/brain-dump${query.toString() ? `?${query.toString()}` : ""}`);
};
export const addBrainDumpItem = (data: unknown) =>
  request<any>("/api/brain-dump", { method: "POST", body: JSON.stringify(data) });
export const updateBrainDumpItem = (id: string, data: unknown) =>
  request<any>(`/api/brain-dump/${id}`, { method: "PATCH", body: JSON.stringify(data) });

export const getDashboard = () => request<DashboardData>("/api/dashboard");

export const getOrgs = () => request<{ orgs: Organization[] }>("/api/orgs");
export const getOrg = (id: string) =>
  request<{ org: Organization; members: OrgMember[]; invitations: OrgInvitation[] }>(`/api/orgs/${id}`);
export const createOrg = (data: unknown) =>
  request<Organization>("/api/orgs", { method: "POST", body: JSON.stringify(data) });
export const updateOrg = (id: string, data: unknown) =>
  request<Organization>(`/api/orgs/${id}`, { method: "PATCH", body: JSON.stringify(data) });
export const deleteOrg = (id: string) =>
  request<void>(`/api/orgs/${id}`, { method: "DELETE" });
export const createInvitation = (
  orgId: string,
  data: { role?: string; expires_at?: string; max_uses?: number },
) =>
  request<{ invitation: OrgInvitation; link: string }>(`/api/orgs/${orgId}/invitations`, {
    method: "POST",
    body: JSON.stringify(data),
  });
export const revokeInvitation = (orgId: string, invitationId: string) =>
  request<void>(`/api/orgs/${orgId}/invitations/${invitationId}`, { method: "DELETE" });

export const getSpaces = () => request<{ spaces: Space[] }>("/api/spaces");
export const createSpace = (data: {
  org_id: string;
  name: string;
  space_type: string;
  icon?: string;
  color?: string;
}) =>
  request<{ space: Space }>("/api/spaces", { method: "POST", body: JSON.stringify(data) }).then(
    (payload) => payload.space,
  );

export const getActors = () => request<{ actors: Actor[] }>("/api/actors");
export const createActor = (data: unknown) =>
  request<{ actor: Actor }>("/api/actors", { method: "POST", body: JSON.stringify(data) });
export const transitionActorPhase = (actorId: string, toPhase: string, reason?: string) =>
  request<unknown>(`/api/actors/${actorId}/phase`, {
    method: "POST",
    body: JSON.stringify({ to_phase: toPhase, ...(reason ? { reason } : {}) }),
  });
export const getActorPhases = (actorId: string) =>
  request<{ transitions: PhaseTransition[] }>(`/api/actors/${actorId}/phases`);

export const getIntents = () => request<{ intents: Intent[] }>("/api/intents");
export const getIntentTree = () => request<unknown>("/api/intents/tree");
export const createIntent = (data: unknown) =>
  request<{ intent: Intent }>("/api/intents", { method: "POST", body: JSON.stringify(data) });
export const updateIntent = (id: string, data: unknown) =>
  request<{ intent: Intent }>(`/api/intents/${id}`, { method: "PATCH", body: JSON.stringify(data) });
export const getIntentLineage = (id: string) => request<unknown[]>(`/api/intents/${id}/lineage`);
export const getIntentRuntime = (id: string) =>
  request<Record<string, unknown>>(`/api/intents/${id}/runtime`);

export const getTags = (params?: {
  entity_type?: string;
  entity_id?: string;
  actor_id?: string;
}) => request<{ tags: Tag[] }>(withQuery("/api/tags", params));
export const createTag = (data: unknown) =>
  request<Tag>("/api/tags", { method: "POST", body: JSON.stringify(data) });
export const deleteTag = (params: {
  entity_type: string;
  entity_id: string;
  tag: string;
  actor_id?: string;
}) => request<void>(withQuery("/api/tags", params), { method: "DELETE" });

export const getEntityData = (params: { entity_type: string; entity_id: string }) =>
  request<{ entity_data: Array<{ key: string; value: string; actor_id: string }> }>(
    withQuery("/api/entity-data", params),
  );
export const setEntityData = (data: unknown) =>
  request<unknown>("/api/entity-data", { method: "POST", body: JSON.stringify(data) });

export const getDispatchStats = () =>
  request<Record<string, number>>("/api/executions/dispatch/stats");

export const getHealth = () => request<any>("/api/health");
