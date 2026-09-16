import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { components } from '@screen-time/api-contract';
import { client, setAccessToken } from '../api/client';

type AuthUser = components['schemas']['AuthUserDto'];
type TokenPair = components['schemas']['RefreshTokenPairDto'];
type AuthResponse = components['schemas']['AuthResponseDto'];

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthError {
  message: string;
}

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<AuthError | null>;
  register: (email: string, password: string) => Promise<AuthError | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function readStoredTokens(): Promise<TokenPair | null> {
  const raw = window.screenTime ? await window.screenTime.getTokens() : null;
  if (raw) return raw;
  const json = localStorage.getItem('screen-time-tokens');
  return json ? (JSON.parse(json) as TokenPair) : null;
}

function storeTokens(tokens: TokenPair): void {
  if (window.screenTime) {
    void window.screenTime.storeTokens(tokens);
  } else {
    localStorage.setItem('screen-time-tokens', JSON.stringify(tokens));
  }
}

function clearStoredTokens(): void {
  window.screenTime?.clearTokens();
  localStorage.removeItem('screen-time-tokens');
}

function errorMessage(res: { error: { message?: string } } | undefined, fallback: string): string {
  return res?.error?.message ?? fallback;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);

  const applySession = useCallback((response: AuthResponse) => {
    setAccessToken(response.tokens.accessToken);
    storeTokens({
      accessToken: response.tokens.accessToken,
      refreshToken: response.tokens.refreshToken,
    });
    setUser(response.user);
    setStatus('authenticated');
  }, []);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    clearStoredTokens();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  useEffect(() => {
    void (async () => {
      const tokens = await readStoredTokens();
      if (!tokens) {
        setStatus('unauthenticated');
        return;
      }
      setAccessToken(tokens.accessToken);

      const me = await client.POST('/auth/me', {}).catch(() => null);
      if (me?.response.status === 200 && me.data) {
        setUser(me.data.user);
        setStatus('authenticated');
        return;
      }

      if (me?.response.status === 401 && tokens.refreshToken) {
        const refreshed = await client
          .POST('/auth/refresh', { body: { refreshToken: tokens.refreshToken } })
          .catch(() => null);
        if (refreshed?.response.status === 200 && refreshed.data) {
          applySession(refreshed.data);
          return;
        }
      }

      clearSession();
    })();
  }, [applySession, clearSession]);

  const login = useCallback(
    async (email: string, password: string): Promise<AuthError | null> => {
      const res = await client.POST('/auth/login', { body: { email, password } }).catch(() => null);
      if (res?.response.status !== 200 || !res.data) {
        return { message: errorMessage(res as never, 'Login failed — check your credentials.') };
      }
      applySession(res.data);
      return null;
    },
    [applySession],
  );

  const register = useCallback(
    async (email: string, password: string): Promise<AuthError | null> => {
      const res = await client
        .POST('/auth/register', { body: { email, password } })
        .catch(() => null);
      if (res?.response.status !== 201 || !res.data) {
        return { message: errorMessage(res as never, 'Registration failed — is the email taken?') };
      }
      applySession(res.data);
      return null;
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    const stored = await readStoredTokens();
    if (stored) {
      await client
        .POST('/auth/logout', { body: { refreshToken: stored.refreshToken } })
        .catch(() => undefined);
    }
    clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({ status, user, login, register, logout }),
    [status, user, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
