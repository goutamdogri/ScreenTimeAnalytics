import { app, BrowserWindow, ipcMain, shell } from 'electron';
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
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1040,
    minHeight: 680,
    title: 'Screen Time',
    backgroundColor: '#0c0c0b',
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

app.whenReady().then(() => {
  const registerTokenHandlers = () => {
    ipcMain.handle('screen-time:tokens:get', () => tokenStore.getTokens());
    ipcMain.handle('screen-time:tokens:set', (_event, tokens) => {
      tokenStore.setTokens(tokens);
      return true;
    });
    ipcMain.handle('screen-time:tokens:clear', () => tokenStore.clear());
  };
  registerTokenHandlers();

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
