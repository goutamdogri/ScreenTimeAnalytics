import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export const ENCRYPTED_PREFIX = 'v1';

/**
 * AES-256-GCM encryption for secret values at rest in Postgres (design doc §3.3).
 *
 * - The master key lives in the backend's environment, never in the database
 *   or in any client.
 * - Every ciphertext is prefixed with its scheme version (`v1:`) so the format
 *   can evolve.
 * - GCM authenticates the ciphertext; any tampering fails decryption instead of
 *   returning corrupted plaintext.
 */
@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor(configService: ConfigService) {
    this.key = deriveKey(configService.get<string>('encryption.masterKey') ?? '');
  }

  /** Returns `v1:<iv>:<authTag>:<ciphertext>` (all base64). */
  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [
      ENCRYPTED_PREFIX,
      iv.toString('base64'),
      authTag.toString('base64'),
      encrypted.toString('base64'),
    ].join(':');
  }

  decrypt(payload: string): string {
    const [version, ivPart, tagPart, dataPart] = payload.split(':');
    if (version !== ENCRYPTED_PREFIX || !ivPart || !tagPart || !dataPart) {
      throw new Error('Malformed encrypted payload');
    }
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivPart, 'base64'));
    decipher.setAuthTag(Buffer.from(tagPart, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataPart, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }
}

/**
 * Resolves the 32-byte key. Accepts base64 (the documented `.env.example`
 * format — `openssl rand -base64 32`) or raw hex. In non-production a stable
 * derived key is used so local development and e2e tests need no configuration.
 */
function deriveKey(masterKey: string): Buffer {
  if (masterKey) {
    const fromBase64 = Buffer.from(masterKey, 'base64');
    if (fromBase64.length === 32) {
      return fromBase64;
    }
    const fromHex = Buffer.from(masterKey, 'hex');
    if (fromHex.length === 32) {
      return fromHex;
    }
    if (process.env.NODE_ENV !== 'production') {
      return deriveKey('');
    }
    throw new Error('ENCRYPTION_MASTER_KEY must be base64 or hex encoding of exactly 32 bytes');
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('ENCRYPTION_MASTER_KEY is required in production');
  }
  return createHash('sha256').update('dev-insecure-encryption-master-key-change-me').digest();
}
