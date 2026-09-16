import { describe, expect, it, jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { DevicesService } from './devices.service';

describe('DevicesService', () => {
  const FAKE_USER_ID = '00000000-0000-0000-0000-000000000001';

  // Helper: avoids the strict "never" mock-param error from jest.fn().mockResolvedValue()
  const resolve = <T>(value: T) => jest.fn(() => Promise.resolve(value));

  describe('register', () => {
    it('creates a device with generated deviceToken', async () => {
      const prismaMock = {
        device: {
          findUnique: resolve(null),
          create: jest.fn().mockImplementation(({ data }: any) =>
            Promise.resolve({
              ...data,
              id: 'device-1',
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
          ),
        },
      };
      const service = new DevicesService(prismaMock as any);
      const result = await service.register(FAKE_USER_ID, { name: 'My PC', platform: 'windows' });
      expect(result.id).toBe('device-1');
      expect(result.deviceToken).toBeDefined();
      expect(result.name).toBe('My PC');
    });

    it('returns the existing device (idempotent) when the name is already registered', async () => {
      const existingDevice = {
        id: 'existing',
        userId: FAKE_USER_ID,
        name: 'My PC',
        platform: 'windows',
        deviceToken: 'existing-token',
        lastSeenAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const createMock = jest.fn();
      const prismaMock = {
        device: {
          findUnique: resolve(existingDevice),
          create: createMock,
        },
      };
      const service = new DevicesService(prismaMock as any);
      const result = await service.register(FAKE_USER_ID, { name: 'My PC', platform: 'windows' });
      expect(result).toBe(existingDevice);
      expect(createMock).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('returns public fields only (no deviceToken)', async () => {
      const prismaMock = {
        device: {
          findMany: resolve([
            {
              id: '1',
              name: 'PC',
              platform: 'windows',
              lastSeenAt: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ]),
        },
      };
      const service = new DevicesService(prismaMock as any);
      const result = await service.list(FAKE_USER_ID);
      expect(result).toHaveLength(1);
      expect(result[0]).not.toHaveProperty('deviceToken');
    });
  });

  describe('update', () => {
    it('throws NotFoundException for non-owned device', async () => {
      const prismaMock = {
        device: {
          findFirst: jest.fn(() => Promise.resolve(null)),
        },
      };
      const service = new DevicesService(prismaMock as any);
      await expect(service.update(FAKE_USER_ID, 'nonexistent', { name: 'New' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('throws NotFoundException for non-owned device', async () => {
      const prismaMock = {
        device: {
          findFirst: jest.fn(() => Promise.resolve(null)),
        },
      };
      const service = new DevicesService(prismaMock as any);
      await expect(service.remove(FAKE_USER_ID, 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('deletes an owned device', async () => {
      const prismaMock = {
        device: {
          findFirst: jest.fn(() => Promise.resolve({ id: '1', userId: FAKE_USER_ID })),
          delete: jest.fn(() => Promise.resolve(undefined)),
        },
      };
      const service = new DevicesService(prismaMock as any);
      await expect(service.remove(FAKE_USER_ID, '1')).resolves.toBeUndefined();
    });
  });

  describe('heartbeat', () => {
    it('records lastSeenAt for a resolved deviceId', async () => {
      const updateMock = jest
        .fn<(...args: unknown[]) => Promise<{ id: string; lastSeenAt: Date }>>()
        .mockResolvedValue({ id: '1', lastSeenAt: new Date() });
      const prismaMock = {
        device: { update: updateMock },
      };
      const service = new DevicesService(prismaMock as any);
      await expect(service.heartbeat('device-id-1')).resolves.toBeUndefined();
      expect(updateMock).toHaveBeenCalledWith({
        where: { id: 'device-id-1' },
        data: expect.objectContaining({ lastSeenAt: expect.any(Date) }),
      });
    });
  });
});
