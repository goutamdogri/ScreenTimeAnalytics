import { contextBridge, ipcRenderer } from 'electron';

const API_BASE_URL = process.env.SCREEN_TIME_API_URL ?? 'http://localhost:3000';

/**
 * The only surface the renderer sees. No Node IPC beyond the token vault and
 * the API base URL — the dashboard stays a pure API client (§2.3). Token
 * persistence happens in the main process (safeStorage + userData path are
 * main-only), reached through invoke handlers. Window controls back the custom
 * (frameless) title bar so the OS never paints chrome over the app design.
 */
contextBridge.exposeInMainWorld('screenTime', {
  apiBaseUrl: API_BASE_URL,
  storeTokens: (tokens: { accessToken: string; refreshToken: string }) =>
    ipcRenderer.invoke('screen-time:tokens:set', tokens),
  getTokens: () => ipcRenderer.invoke('screen-time:tokens:get'),
  clearTokens: () => ipcRenderer.invoke('screen-time:tokens:clear'),
  minimize: () => ipcRenderer.send('screen-time:window:minimize'),
  toggleMaximize: () => ipcRenderer.send('screen-time:window:toggle-maximize'),
  close: () => ipcRenderer.send('screen-time:window:close'),
  onMaximizedChange: (callback: (maximized: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, maximized: boolean) => callback(maximized);
    ipcRenderer.on('screen-time:window:maximized-changed', listener);
    return () => ipcRenderer.removeListener('screen-time:window:maximized-changed', listener);
  },
});
