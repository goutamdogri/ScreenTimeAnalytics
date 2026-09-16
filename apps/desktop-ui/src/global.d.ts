interface ScreenTimeTokens {
  accessToken: string;
  refreshToken: string;
}

interface ScreenTimeBridge {
  apiBaseUrl: string;
  storeTokens(tokens: ScreenTimeTokens): void;
  getTokens(): ScreenTimeTokens | null;
  clearTokens(): void;
}

declare global {
  interface Window {
    screenTime: ScreenTimeBridge | undefined;
  }
}

export {};
