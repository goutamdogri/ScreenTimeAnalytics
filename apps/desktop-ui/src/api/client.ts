import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from '@screen-time/api-contract';

export const DEFAULT_API_BASE_URL = 'http://localhost:3000';

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

const authMiddleware: Middleware = {
  async onRequest({ request }) {
    if (accessToken) {
      request.headers.set('Authorization', `Bearer ${accessToken}`);
    }
  },
};

export function apiBaseUrl(): string {
  const fromBridge = window.screenTime?.apiBaseUrl;
  return (fromBridge ?? DEFAULT_API_BASE_URL).replace(/\/+$/, '');
}

export const client = createClient<paths>({
  baseUrl: apiBaseUrl(),
});

client.use(authMiddleware);
