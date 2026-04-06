const API_URL = "http://localhost:3002";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const getProjects = () => request<any[]>("/api/projects");
export const createProject = (data: unknown) => request<any>("/api/projects", { method: "POST", body: JSON.stringify(data) });
export const getProject = (id: string) => request<any>(`/api/projects/${id}`);
export const updateProject = (id: string, data: unknown) => request<any>(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(data) });
export const getProjectContext = (id: string) => request<any>(`/api/projects/${id}/context`);
export const addResource = (projectId: string, data: unknown) => request<any>(`/api/projects/${projectId}/resources`, { method: "POST", body: JSON.stringify(data) });
export const deleteResource = (projectId: string, resourceId: string) => request<any>(`/api/projects/${projectId}/resources/${resourceId}`, { method: "DELETE" });
export const getExecutions = () => request<any[]>("/api/executions");
export const dispatchExecution = (data: unknown) => request<any>("/api/executions/dispatch", { method: "POST", body: JSON.stringify(data) });
export const getExecution = (id: string) => request<any>(`/api/executions/${id}`);
export const getNotes = (projectId: string) => request<any[]>(`/api/projects/${projectId}/notes`);
export const createNote = (projectId: string, data: unknown) => request<any>(`/api/projects/${projectId}/notes`, { method: "POST", body: JSON.stringify(data) });
export const updateNote = (id: string, data: unknown) => request<any>(`/api/notes/${id}`, { method: "PATCH", body: JSON.stringify(data) });
export const getBrainDump = (params?: { status?: string; projectId?: string }) => {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.projectId) query.set("projectId", params.projectId);
  return request<any[]>(`/api/brain-dump${query.toString() ? `?${query.toString()}` : ""}`);
};
export const addBrainDumpItem = (data: unknown) => request<any>("/api/brain-dump", { method: "POST", body: JSON.stringify(data) });
export const updateBrainDumpItem = (id: string, data: unknown) => request<any>(`/api/brain-dump/${id}`, { method: "PATCH", body: JSON.stringify(data) });
export const getHealth = () => request<any>("/api/health");
