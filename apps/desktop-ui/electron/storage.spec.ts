// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('node:fs', () => ({
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  rmSync: vi.fn(),
}));

vi.mock('electron', () => ({
  app: { getPath: () => '/fake/user-data' },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((s: string) => Buffer.from(`enc:${s}`)),
    decryptString: vi.fn(() => ''),
  },
}));

import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { safeStorage } from 'electron';
import { TokenStore } from './storage';

const fsMock = vi.mocked({ readFileSync, writeFileSync, rmSync });
const safeStorageMock = vi.mocked(safeStorage);

const PAIR = { accessToken: 'jwt-a', refreshToken: 'jwt-r' };

describe('TokenStore', () => {
  const store = new TokenStore();

  beforeEach(() => {
    vi.clearAllMocks();
    safeStorageMock.isEncryptionAvailable.mockReturnValue(true);
    safeStorageMock.decryptString.mockReturnValue(JSON.stringify(PAIR));
  });

  it('returns null when no token file exists', () => {
    fsMock.readFileSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });
    expect(store.getTokens()).toBeNull();
  });

  it('returns null when the stored payload is not a token pair', () => {
    safeStorageMock.decryptString.mockReturnValue('{"accessToken":123}');
    expect(store.getTokens()).toBeNull();
  });

  it('decrypts an encrypted token pair', () => {
    fsMock.readFileSync.mockReturnValue(Buffer.from('ciphertext'));
    expect(store.getTokens()).toEqual(PAIR);
    expect(safeStorageMock.decryptString).toHaveBeenCalledWith(Buffer.from('ciphertext'));
  });

  it('reads a plain-text pair when encryption is unavailable', () => {
    safeStorageMock.isEncryptionAvailable.mockReturnValue(false);
    fsMock.readFileSync.mockReturnValue(Buffer.from(JSON.stringify(PAIR)));
    expect(store.getTokens()).toEqual(PAIR);
  });

  it('writes a plain-text pair when encryption is unavailable', () => {
    safeStorageMock.isEncryptionAvailable.mockReturnValue(false);
    store.setTokens(PAIR);
    expect(writeFileSync).toHaveBeenCalledWith(
      expect.any(String),
      Buffer.from(JSON.stringify(PAIR), 'utf8'),
      { mode: 0o600 },
    );
  });

  it('encrypts the pair when safeStorage is available', () => {
    store.setTokens(PAIR);
    expect(safeStorageMock.encryptString).toHaveBeenCalledWith(JSON.stringify(PAIR));
    expect(writeFileSync).toHaveBeenCalledWith(
      expect.any(String),
      Buffer.from(`enc:${JSON.stringify(PAIR)}`),
      {
        mode: 0o600,
      },
    );
  });

  it('clear removes the token file and tolerates a missing one', () => {
    store.clear();
    expect(rmSync).toHaveBeenCalledWith(expect.any(String), { force: true });

    fsMock.rmSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });
    expect(() => store.clear()).not.toThrow();
  });
});
