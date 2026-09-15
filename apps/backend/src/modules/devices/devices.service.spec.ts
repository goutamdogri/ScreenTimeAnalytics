import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DevicesService } from './devices.service';

describe('DevicesService', () => {
  const FAKE_USER_ID = '00000000-0000-0000-0000-000000000001';

  describe('register', () => {
    it('creates a device with generated deviceToken', async () => {
      const prismaMock = {
        device: {
          findMany: jest.fn().mockResolvedValue([]),
          create: jest
            .fn()
            .mockImplementation(({ data }: { data: any }) =>
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

    it('throws BadRequestException when name is taken', async () => {
      const prismaMock = {
        device: {
          findMany: jest.fn().mockResolvedValue([{ id: 'existing' }]),
          create: jest.fn(),
        },
      };
      const service = new DevicesService(prismaMock as any);
      await expect(
        service.register(FAKE_USER_ID, { name: 'My PC', platform: 'windows' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('list', () => {
    it('returns public fields only (no deviceToken)', async () => {
      const prismaMock = {
        device: {
          findMany: jest
            .fn()
            .mockResolvedValue([
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
          findFirst: jest.fn().mockResolvedValue(null),
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
          findFirst: jest.fn().mockResolvedValue(null),
        },
      };
      const service = new DevicesService(prismaMock as any);
      await expect(service.remove(FAKE_USER_ID, 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('deletes an owned device', async () => {
      const prismaMock = {
        device: {
          findFirst: jest.fn().mockResolvedValue({ id: '1', userId: FAKE_USER_ID }),
          delete: jest.fn().mockResolvedValue(undefined),
        },
      };
      const service = new DevicesService(prismaMock as any);
      await expect(service.remove(FAKE_USER_ID, '1')).resolves.toBeUndefined();
    });
  });

  describe('heartbeat', () => {
    it('throws NotFoundException for unknown deviceToken', async () => {
      const prismaMock = {
        device: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      };
      const service = new DevicesService(prismaMock as any);
      await expect(service.heartbeat('unknown-token')).rejects.toThrow(NotFoundException);
    });

    it('succeeds for known deviceToken', async () => {
      const prismaMock = {
        device: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      };
      const service = new DevicesService(prismaMock as any);
      await expect(service.heartbeat('known-token')).resolves.toBeUndefined();
    });
  });
});
