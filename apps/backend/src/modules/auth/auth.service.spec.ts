import { describe, expect, it, jest } from '@jest/globals';
import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';

const FAKE_USER_ID = randomUUID();
const FAKE_EMAIL = 'test@example.com';
const PASSWORD = 'Str0ng!Passw0rd';

// Avoids the strict "never" mock-param error from jest.fn().mockResolvedValue()
const resolve = <T>(value: T) => jest.fn(() => Promise.resolve(value));

type PrismaDelegate = Record<string, jest.Mock>;

function buildAuthService(delegates: { user: PrismaDelegate; refreshToken: PrismaDelegate }) {
  const signCalls: { payload: Record<string, unknown>; opts: Record<string, unknown> }[] = [];
  const mockJwtService = {
    signAsync: jest.fn(async (payload: Record<string, unknown>, opts: Record<string, unknown>) => {
      signCalls.push({ payload, opts });
      return `jwt-${signCalls.length}`;
    }),
  } as unknown as JwtService;

  const mockConfigService = {
    getOrThrow: jest.fn((key: string) => {
      const map: Record<string, string> = {
        'jwt.accessSecret': 'secret',
        'jwt.refreshSecret': 'secret',
        'jwt.accessTtl': '15m',
        'jwt.refreshTtl': '7d',
      };
      return map[key] as string;
    }),
  } as unknown as ConfigService;

  const mockPrisma = { user: delegates.user, refreshToken: delegates.refreshToken } as any;

  const service = new AuthService(mockPrisma, mockJwtService, mockConfigService);
  return { service, mockJwtService, mockConfigService, signCalls };
}

describe('AuthService', () => {
  describe('register', () => {
    it('creates a new user and returns tokens', async () => {
      const { service } = buildAuthService({
        user: {
          findUnique: resolve(null),
          create: jest.fn().mockImplementation((input: any) => {
            const { data } = input;
            return Promise.resolve({
              ...data,
              id: FAKE_USER_ID,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }),
        },
        refreshToken: {
          findUnique: resolve(null),
          create: jest.fn().mockImplementation((input: any) => {
            const { data } = input;
            return Promise.resolve({ ...data, id: randomUUID(), createdAt: new Date() });
          }),
          updateMany: jest.fn(),
          update: jest.fn(),
        },
      });

      const result = await service.register({ email: FAKE_EMAIL, password: PASSWORD });
      expect(result.user.email).toBe(FAKE_EMAIL);
      expect(result.user.id).toBe(FAKE_USER_ID);
      expect(result.tokens.accessToken).toBe('jwt-1');
      expect(result.tokens.refreshToken).toBe('jwt-2');
    });

    it('throws ConflictException for duplicate email', async () => {
      const { service } = buildAuthService({
        user: {
          findUnique: resolve({ id: randomUUID() }),
          create: jest.fn(),
        },
        refreshToken: {
          create: jest.fn(),
          updateMany: jest.fn(),
          update: jest.fn(),
          findUnique: jest.fn(),
        },
      });
      await expect(service.register({ email: FAKE_EMAIL, password: PASSWORD })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('validateCredentials', () => {
    it('returns user for valid credentials', async () => {
      const passwordHash = await argon2.hash(PASSWORD);
      const { service } = buildAuthService({
        user: {
          findUnique: resolve({ id: FAKE_USER_ID, email: FAKE_EMAIL, passwordHash }),
        },
        refreshToken: {
          create: jest.fn(),
          updateMany: jest.fn(),
          update: jest.fn(),
          findUnique: jest.fn(),
        },
      });
      const result = await service.validateCredentials(FAKE_EMAIL, PASSWORD);
      expect(result).toEqual({ userId: FAKE_USER_ID, email: FAKE_EMAIL });
    });

    it('returns null for wrong password', async () => {
      const passwordHash = await argon2.hash(PASSWORD);
      const { service } = buildAuthService({
        user: {
          findUnique: resolve({ id: FAKE_USER_ID, email: FAKE_EMAIL, passwordHash }),
        },
        refreshToken: {
          create: jest.fn(),
          updateMany: jest.fn(),
          update: jest.fn(),
          findUnique: jest.fn(),
        },
      });
      const result = await service.validateCredentials(FAKE_EMAIL, 'wrong');
      expect(result).toBeNull();
    });

    it('returns null for unknown email', async () => {
      const { service } = buildAuthService({
        user: { findUnique: resolve(null) },
        refreshToken: {
          create: jest.fn(),
          updateMany: jest.fn(),
          update: jest.fn(),
          findUnique: jest.fn(),
        },
      });
      const result = await service.validateCredentials(FAKE_EMAIL, PASSWORD);
      expect(result).toBeNull();
    });
  });

  describe('refresh', () => {
    const presentedToken = 'valid-refresh-token';
    const fakeJti = randomUUID();

    it('rotates a valid refresh token and revokes the original', async () => {
      const updateMany = jest
        .fn<() => Promise<{ count: number }>>()
        .mockResolvedValueOnce({ count: 1 }) // first rotation succeeds
        .mockResolvedValueOnce({ count: 0 }); // reuse: already revoked
      const { service } = buildAuthService({
        user: {
          findUniqueOrThrow: jest
            .fn<() => Promise<{ id: string; email: string; createdAt: Date }>>()
            .mockResolvedValue({ id: FAKE_USER_ID, email: FAKE_EMAIL, createdAt: new Date() }),
        },
        refreshToken: {
          findUnique: jest
            .fn<
              () => Promise<{
                id: string;
                userId: string;
                jti: string;
                expiresAt: Date;
                revokedAt: null;
              } | null>
            >()
            .mockResolvedValueOnce({
              id: randomUUID(),
              userId: FAKE_USER_ID,
              jti: fakeJti,
              expiresAt: new Date(Date.now() + 60_000),
              revokedAt: null,
            })
            .mockResolvedValueOnce({
              id: randomUUID(),
              userId: FAKE_USER_ID,
              jti: fakeJti,
              expiresAt: new Date(Date.now() + 60_000),
              revokedAt: null,
            })
            .mockResolvedValueOnce(null), // after revocation, reuse → null
          create: jest.fn().mockImplementation((input: any) => {
            const { data } = input;
            return Promise.resolve({ ...data, id: randomUUID(), createdAt: new Date() });
          }),
          updateMany,
          update: jest.fn(),
        },
      });

      const result = await service.refresh(
        { userId: FAKE_USER_ID, email: FAKE_EMAIL, jti: fakeJti },
        presentedToken,
      );
      expect(result.user.id).toBe(FAKE_USER_ID);
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();

      // reuse should fail
      await expect(
        service.refresh({ userId: FAKE_USER_ID, email: FAKE_EMAIL, jti: fakeJti }, presentedToken),
      ).rejects.toThrow();
    });
  });

  describe('logout', () => {
    it('revokes the refresh token', async () => {
      const updateMany = jest.fn(() => Promise.resolve({ count: 1 }));
      const { service } = buildAuthService({
        user: { findUnique: jest.fn(), create: jest.fn() },
        refreshToken: { create: jest.fn(), updateMany, update: jest.fn(), findUnique: jest.fn() },
      });
      await expect(service.logout('some-token')).resolves.toBeUndefined();
      expect(updateMany).toHaveBeenCalledTimes(1);
    });
  });
});
