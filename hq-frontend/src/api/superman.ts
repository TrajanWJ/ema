const API_URL = "http://localhost:3002/api/superman";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init
  });
  if (!response.ok) throw new Error(`Superman request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

export const getHealth = (projectPath?: string) =>
  request<any>(`/api/health${projectPath ? `?projectPath=${encodeURIComponent(projectPath)}` : ""}`);
export const getGaps = (projectPath?: string) =>
  request<any[]>(`/gaps${projectPath ? `?projectPath=${encodeURIComponent(projectPath)}` : ""}`);
export const queryCode = (query: string, projectPath?: string) =>
  request<any>("/query", { method: "POST", body: JSON.stringify({ query, projectPath }) });
export const indexRepo = (path: string) =>
  request<any>("/index-repo", { method: "POST", body: JSON.stringify({ path }) });
export const getGitInsights = (projectPath?: string) =>
  request<any>(`/git-insights${projectPath ? `?projectPath=${encodeURIComponent(projectPath)}` : ""}`);
