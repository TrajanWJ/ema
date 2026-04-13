export interface ServiceConnectionOptions {
  readonly baseUrl: string;
  readonly timeoutMs?: number;
}

export interface ServiceProbeResult {
  readonly available: boolean;
  readonly health?: unknown;
  readonly error?: string;
}

export class ServiceConnection {
  private readonly baseUrl: string;

  private readonly timeoutMs: number;

  private probeCache?: Promise<ServiceProbeResult>;

  constructor(options: ServiceConnectionOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? 1000;
  }

  async probe(): Promise<ServiceProbeResult> {
    if (!this.probeCache) {
      this.probeCache = this.fetchProbe();
    }
    return this.probeCache;
  }

  async get<T = unknown>(path: string): Promise<T | null> {
    const probe = await this.probe();
    if (!probe.available) return null;
    return this.request<T>('GET', path);
  }

  async post<T = unknown>(path: string, body: unknown): Promise<T | null> {
    const probe = await this.probe();
    if (!probe.available) return null;
    return this.request<T>('POST', path, body);
  }

  async put<T = unknown>(path: string, body: unknown): Promise<T | null> {
    const probe = await this.probe();
    if (!probe.available) return null;
    return this.request<T>('PUT', path, body);
  }

  async delete<T = unknown>(path: string): Promise<T | null> {
    const probe = await this.probe();
    if (!probe.available) return null;
    return this.request<T>('DELETE', path);
  }

  async request<T = unknown>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const init: RequestInit = {
        method,
        signal: controller.signal,
      };
      if (body !== undefined) {
        init.headers = {
          'content-type': 'application/json',
        };
        init.body = JSON.stringify(body);
      }

      const response = await fetch(`${this.baseUrl}${path}`, init);

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(
          `ema_service_request_failed ${response.status} ${path}${detail ? `: ${detail}` : ''}`,
        );
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  private async fetchProbe(): Promise<ServiceProbeResult> {
    try {
      const health = await this.request('GET', '/api/health');
      return { available: true, health };
    } catch (error) {
      return {
        available: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
