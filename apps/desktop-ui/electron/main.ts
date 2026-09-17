import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron';
import { join } from 'node:path';
import { tokenStore } from './storage';

function resolveRendererUrl(win: BrowserWindow): string {
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    win.loadURL(devServerUrl);
    win.webContents.openDevTools({ mode: 'detach' });
    return devServerUrl;
  }
  win.loadFile(join(__dirname, '../renderer/index.html'));
  return '';
}

function createWindow(): BrowserWindow {
  // Frameless: the app owns its titlebar (see TitleBar in the renderer), which
  // is designed to match the rest of the UI instead of the native frame.
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1040,
    minHeight: 680,
    title: 'Screen Time',
    backgroundColor: '#0a0a0b',
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  resolveRendererUrl(win);
  return win;
}

function registerWindowHandlers(): () => void {
  const minimize = (win: BrowserWindow) => win.minimize();
  const toggleMaximize = (win: BrowserWindow) =>
    win.isMaximized() ? win.unmaximize() : win.maximize();

  ipcMain.on('screen-time:window:minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) minimize(win);
  });
  ipcMain.on('screen-time:window:toggle-maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) toggleMaximize(win);
  });
  ipcMain.on('screen-time:window:close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.close();
  });

  const pushMaximized = (win: BrowserWindow) => {
    win.webContents.send('screen-time:window:maximized-changed', win.isMaximized());
  };

  const subscriptions: (() => void)[] = [];
  for (const win of BrowserWindow.getAllWindows()) {
    win.on('maximize', () => pushMaximized(win));
    win.on('unmaximize', () => pushMaximized(win));
    subscriptions.push(() => {
      win.removeAllListeners('maximize');
      win.removeAllListeners('unmaximize');
    });
  }
  return () => subscriptions.forEach((off) => off());
}

app.whenReady().then(() => {
  // No OS menu bar (File / Edit / View / Window) — the UI is the chrome.
  Menu.setApplicationMenu(null);

  const registerTokenHandlers = () => {
    ipcMain.handle('screen-time:tokens:get', () => tokenStore.getTokens());
    ipcMain.handle('screen-time:tokens:set', (_event, tokens) => {
      tokenStore.setTokens(tokens);
      return true;
    });
    ipcMain.handle('screen-time:tokens:clear', () => tokenStore.clear());
  };
  registerTokenHandlers();

  let cleanupWindowHandlers: (() => void) | null = null;
  createWindow();
  cleanupWindowHandlers = registerWindowHandlers();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      if (cleanupWindowHandlers) cleanupWindowHandlers();
      cleanupWindowHandlers = registerWindowHandlers();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
