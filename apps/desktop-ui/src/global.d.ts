interface ScreenTimeTokens {
  accessToken: string;
  refreshToken: string;
}

interface ScreenTimeBridge {
  apiBaseUrl: string;
  storeTokens(tokens: ScreenTimeTokens): Promise<boolean>;
  getTokens(): Promise<ScreenTimeTokens | null>;
  clearTokens(): Promise<boolean>;
  minimize(): void;
  toggleMaximize(): void;
  close(): void;
  onMaximizedChange(callback: (maximized: boolean) => void): () => void;
}

declare global {
  interface Window {
    screenTime: ScreenTimeBridge | undefined;
  }
}

export {};
