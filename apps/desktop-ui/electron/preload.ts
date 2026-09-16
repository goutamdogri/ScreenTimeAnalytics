import { contextBridge } from 'electron';
import { tokenStore } from './storage';

const API_BASE_URL = process.env.SCREEN_TIME_API_URL ?? 'http://localhost:3000';

/**
 * The only surface the renderer sees. No Node IPC beyond the token vault and
 * the API base URL — the dashboard stays a pure API client (§2.3).
 */
contextBridge.exposeInMainWorld('screenTime', {
  apiBaseUrl: API_BASE_URL,
  storeTokens: (tokens: { accessToken: string; refreshToken: string }) =>
    tokenStore.setTokens(tokens),
  getTokens: () => tokenStore.getTokens(),
  clearTokens: () => tokenStore.clear(),
});
