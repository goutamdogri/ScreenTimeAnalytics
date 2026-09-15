import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Device } from '@screen-time/db';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDeviceDto, UpdateDeviceDto } from './dto/device.dto';

const publicDeviceSelect = {
  id: true,
  name: true,
  platform: true,
  lastSeenAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async register(userId: string, dto: RegisterDeviceDto): Promise<Device> {
    const existing = await this.prisma.device.findMany({
      where: { userId, name: dto.name },
      select: { id: true },
      take: 1,
    });
    if (existing.length > 0) {
      throw new BadRequestException(`A device named "${dto.name}" is already registered`);
    }

    return this.prisma.device.create({
      data: {
        userId,
        name: dto.name,
        platform: dto.platform,
        deviceToken: randomUUID(),
      },
    });
  }

  async list(userId: string) {
    return this.prisma.device.findMany({
      where: { userId },
      select: publicDeviceSelect,
      orderBy: { createdAt: 'asc' },
    });
  }

  async update(userId: string, id: string, dto: UpdateDeviceDto) {
    const owned = await this.findOwned(userId, id);
    return this.prisma.device.update({
      where: { id: owned.id },
      data: dto,
      select: publicDeviceSelect,
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    const owned = await this.findOwned(userId, id);
    await this.prisma.device.delete({ where: { id: owned.id } });
  }

  /** Records an activity timestamp for a device identified by its opaque token. */
  async heartbeat(deviceToken: string): Promise<void> {
    const updated = await this.prisma.device.updateMany({
      where: { deviceToken },
      data: { lastSeenAt: new Date() },
    });
    if (updated.count === 0) {
      throw new NotFoundException('Unknown device token');
    }
  }

  private async findOwned(userId: string, id: string): Promise<Device> {
    const device = await this.prisma.device.findFirst({ where: { id, userId } });
    if (!device) {
      throw new NotFoundException('Device not found');
    }
    return device;
  }
}
