import { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';

describe('CryptoService', () => {
  function buildService(masterKey: string | undefined = undefined) {
    const configService = { get: (_key: string) => masterKey } as unknown as ConfigService;
    return { service: new CryptoService(configService), configService };
  }

  it('round-trips a secret', () => {
    const { service } = buildService();
    const enc = service.encrypt('sk-very-secret-key');
    expect(enc).toMatch(/^v1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
    expect(service.decrypt(enc)).toBe('sk-very-secret-key');
  });

  it('produces unique ciphertexts for the same plaintext (random IV)', () => {
    const { service } = buildService();
    expect(service.encrypt('same')).not.toBe(service.encrypt('same'));
  });

  it('fails to decrypt tampered payloads', () => {
    const { service } = buildService();
    const enc = service.encrypt('secret');
    const [prefix, iv, tag, data] = enc.split(':');
    const tamperedData = Buffer.from(data!, 'base64');
    tamperedData[0] = tamperedData[0]! ^ 0xff;
    const tampered = [prefix, iv, tag, tamperedData.toString('base64')].join(':');
    expect(() => service.decrypt(tampered)).toThrow();
  });

  it('rejects malformed payloads', () => {
    const { service } = buildService();
    expect(() => service.decrypt('not-an-encrypted-value')).toThrow('Malformed encrypted payload');
  });

  it('accepts a base64 master key', () => {
    const masterKey = Buffer.alloc(32, 7).toString('base64');
    const { service } = buildService(masterKey);
    expect(service.decrypt(service.encrypt('x'))).toBe('x');
  });

  it('accepts a hex master key', () => {
    const masterKey = Buffer.alloc(32, 3).toString('hex');
    const { service } = buildService(masterKey);
    expect(service.decrypt(service.encrypt('x'))).toBe('x');
  });

  it('never reveals plaintext in the ciphertext', () => {
    const { service } = buildService();
    const enc = service.encrypt('super-secret-value');
    expect(enc).not.toContain('super-secret-value');
  });
});
