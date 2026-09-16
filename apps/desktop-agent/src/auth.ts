import type { components, paths } from '@screen-time/api-contract';

import type { ApiClient } from './api-client';
import type { AgentStore } from './store';

type AuthResponse = paths['/auth/login']['post']['responses'][200]['content']['application/json'];
type LoginBody = paths['/auth/login']['post']['requestBody']['content']['application/json'];
type RefreshBody = paths['/auth/refresh']['post']['requestBody']['content']['application/json'];

export type AuthSession = components['schemas']['AuthResponseDto'];

/** Thrown when the agent's stored credentials are unusable (no / expired). */
export class AuthError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Handles the agent's authentication lifecycle:
 *  - `login`: exchange email+password for tokens (CLI command)
 *  - `refresh`: rotate the stored refresh token, reusing the stored user
 *  - `ensureAccessToken`: return a usable access token, refreshing as needed
 */
export class AuthClient {
  constructor(
    private readonly api: ApiClient,
    private readonly store: AgentStore,
  ) {}

  async login(email: string, password: string): Promise<AuthSession> {
    const body: LoginBody = { email, password };
    const res = await this.api.request<AuthResponse>('/auth/login', { method: 'POST', json: body });
    if (!res.body) throw new AuthError(res.status, 'login failed');
    await this.store.save({
      email: res.body.user.email,
      userId: res.body.user.id,
      accessToken: res.body.tokens.accessToken,
      refreshToken: res.body.tokens.refreshToken,
    });
    return res.body;
  }

  /** Reuse the stored refresh token; throws if no session is stored. */
  async refresh(): Promise<AuthSession> {
    const stored = await this.store.load();
    if (!stored.refreshToken) {
      throw new AuthError(401, 'no refresh token stored — run `login` first');
    }
    const body: RefreshBody = { refreshToken: stored.refreshToken };
    const res = await this.api.request<AuthResponse>('/auth/refresh', {
      method: 'POST',
      json: body,
    });
    if (!res.body) throw new AuthError(res.status, 'refresh token rejected — run `login` again');
    await this.store.save({
      email: stored.email,
      userId: stored.userId,
      accessToken: res.body.tokens.accessToken,
      refreshToken: res.body.tokens.refreshToken,
    });
    return res.body;
  }

  async ensureAccessToken(): Promise<string> {
    const stored = await this.store.load();
    if (stored.accessToken) return stored.accessToken;
    const session = await this.refresh();
    return session.tokens.accessToken;
  }

  async logout(): Promise<void> {
    await this.store.save({});
  }
}
