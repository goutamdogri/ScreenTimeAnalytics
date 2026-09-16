import { contextBridge, ipcRenderer } from 'electron';

const API_BASE_URL = process.env.SCREEN_TIME_API_URL ?? 'http://localhost:3000';

/**
 * The only surface the renderer sees. No Node IPC beyond the token vault and
 * the API base URL — the dashboard stays a pure API client (§2.3). Token
 * persistence happens in the main process (safeStorage + userData path are
 * main-only), reached through invoke handlers.
 */
contextBridge.exposeInMainWorld('screenTime', {
  apiBaseUrl: API_BASE_URL,
  storeTokens: (tokens: { accessToken: string; refreshToken: string }) =>
    ipcRenderer.invoke('screen-time:tokens:set', tokens),
  getTokens: () => ipcRenderer.invoke('screen-time:tokens:get'),
  clearTokens: () => ipcRenderer.invoke('screen-time:tokens:clear'),
});
