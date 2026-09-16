/**
 * Minimal HTTP helpers shared by providers. We deliberately avoid vendor SDKs:
 * every provider here is a single `fetch` call, which keeps the package small
 * and the whole matrix mockable in tests via a stubbed global `fetch`.
 */

export class ProviderHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
    this.name = 'ProviderHttpError';
  }
}

export interface JsonRequestOptions {
  headers?: Record<string, string>;
  /** Abort after this many ms (Ollama local inference can be slow). */
  timeoutMs?: number;
}

export async function postJson(
  url: string,
  body: unknown,
  options: JsonRequestOptions = {},
): Promise<unknown> {
  const { headers = {}, timeoutMs = 60_000 } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new ProviderHttpError(
        `Provider returned HTTP ${res.status}`,
        res.status,
        text.slice(0, 500),
      );
    }
    return parseJson(text);
  } finally {
    clearTimeout(timer);
  }
}

export async function getJson(url: string, timeoutMs = 5_000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const text = await res.text();
    if (!res.ok) {
      throw new ProviderHttpError(
        `Provider returned HTTP ${res.status}`,
        res.status,
        text.slice(0, 500),
      );
    }
    return parseJson(text);
  } finally {
    clearTimeout(timer);
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error('Provider returned invalid JSON');
  }
}
