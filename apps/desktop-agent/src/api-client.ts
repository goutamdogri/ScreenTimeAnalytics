export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiRequestOptions {
  path: string;
  method?: ApiMethod;
  headers?: Record<string, string>;
  json?: unknown;
  timeoutMs?: number;
}

export interface ApiResponse<T> {
  status: number;
  ok: boolean;
  body: T | null;
}

export type ApiFailureKind = 'network' | 'timeout' | 'http';

export class ApiError extends Error {
  constructor(
    readonly kind: ApiFailureKind,
    readonly status: number,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Thin typed wrapper around fetch for the agent's backend calls.
 * Injectable so tests can substitute a fake without spinning up a server.
 */
export class ApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: typeof globalThis.fetch = globalThis.fetch,
  ) {}

  async request<T>(
    path: string,
    opts: Omit<ApiRequestOptions, 'path'> = {},
  ): Promise<ApiResponse<T>> {
    const url = /^https?:\/\//.test(path) ? path : `${this.baseUrl}${path}`;
    const headers: Record<string, string> = { ...opts.headers };
    let body: string | undefined;
    if (opts.json !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(opts.json);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: opts.method ?? 'GET',
        headers,
        body,
        signal: controller.signal,
      });
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError';
      throw new ApiError(
        aborted ? 'timeout' : 'network',
        0,
        `request failed: ${err instanceof Error ? err.message : String(err)}`,
        true,
      );
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    let parsed: T | null = null;
    if (text.length > 0) {
      try {
        parsed = JSON.parse(text) as T;
      } catch {
        parsed = null;
      }
    }

    if (!res.ok) {
      throw new ApiError('http', res.status, `HTTP ${res.status} from ${path}`, res.status >= 500);
    }
    return { status: res.status, ok: true, body: parsed };
  }
}
