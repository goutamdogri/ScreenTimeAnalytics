import { app, safeStorage } from 'electron';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const TOKEN_FILE = 'auth-tokens.json';

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * JWT pair persistence for the dashboard. Tokens are encrypted at rest with
 * the OS keychain-backed safeStorage when available and otherwise stored as a
 * plain file (unavoidable on headless/Linux sessions without a keyring).
 */
export class TokenStore {
  private filePath(): string {
    return join(app.getPath('userData'), TOKEN_FILE);
  }

  getTokens(): StoredTokens | null {
    try {
      const raw = readFileSync(this.filePath());
      const text = safeStorage.isEncryptionAvailable()
        ? safeStorage.decryptString(raw)
        : raw.toString('utf8');
      const parsed = JSON.parse(text) as Partial<StoredTokens>;
      if (typeof parsed.accessToken === 'string' && typeof parsed.refreshToken === 'string') {
        return { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken };
      }
      return null;
    } catch {
      return null;
    }
  }

  setTokens(tokens: StoredTokens): void {
    const file = this.filePath();
    mkdirSync(dirname(file), { recursive: true });
    const payload = JSON.stringify(tokens);
    const stored = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(payload)
      : Buffer.from(payload, 'utf8');
    writeFileSync(file, stored, { mode: 0o600 });
  }

  clear(): void {
    try {
      rmSync(this.filePath(), { force: true });
    } catch {
      // nothing stored — fine
    }
  }
}

export const tokenStore = new TokenStore();
