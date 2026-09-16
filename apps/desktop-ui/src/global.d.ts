interface ScreenTimeTokens {
  accessToken: string;
  refreshToken: string;
}

interface ScreenTimeBridge {
  apiBaseUrl: string;
  storeTokens(tokens: ScreenTimeTokens): Promise<boolean>;
  getTokens(): Promise<ScreenTimeTokens | null>;
  clearTokens(): Promise<boolean>;
}

declare global {
  interface Window {
    screenTime: ScreenTimeBridge | undefined;
  }
}

export {};
