import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import { RefreshToken, User } from '@screen-time/db';
import {
  AuthenticatedUser,
  AuthenticatedUserWithJti,
} from '../../common/decorators/current-user.decorator';
import { durationToMilliseconds } from '../../common/utils/duration';
import { PrismaService } from '../prisma/prisma.service';
import { AuthResponseDto, AuthUserDto } from './dto/auth-response.dto';
import { RegisterDto } from './dto/register.dto';
import {
  ACCESS_TOKEN_TYPE,
  JwtAccessPayload,
  JwtRefreshPayload,
  REFRESH_TOKEN_TYPE,
} from './tokens';

const toAuthResponse = (
  user: User,
  accessToken: string,
  refreshToken: string,
): AuthResponseDto => ({
  user: toAuthUser(user),
  tokens: { accessToken, refreshToken },
});

const toAuthUser = (user: User): AuthUserDto => ({
  id: user.id,
  email: user.email,
  createdAt: user.createdAt,
});

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const email = dto.email.trim().toLowerCase();

    const existing = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({ data: { email, passwordHash } });

    return this.issueTokens(user);
  }

  /**
   * Verifies credentials on behalf of the passport `local` strategy.
   * Returns `null` (never throws) when credentials are invalid, so callers can
   * decide how to surface the failure.
   */
  async validateCredentials(email: string, password: string): Promise<AuthenticatedUser | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      return null;
    }

    const passwordValid = await argon2.verify(user.passwordHash, password).catch(() => false);
    if (!passwordValid) {
      return null;
    }

    return { userId: user.id, email: user.email };
  }

  async login(user: AuthenticatedUser): Promise<AuthResponseDto> {
    const record = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.userId },
    });
    return this.issueTokens(record);
  }

  /**
   * Rotates a refresh token: the presented token is atomically revoked and a
   * fresh pair is issued. Reuse of an already-rotated or revoked token is
   * rejected.
   */
  async refresh(
    refreshUser: AuthenticatedUserWithJti,
    presentedRefreshToken: string,
  ): Promise<AuthResponseDto> {
    const record = await this.findActiveRecord(presentedRefreshToken, refreshUser.jti);
    if (!record) {
      throw new UnauthorizedException('Refresh token is invalid or has been used');
    }

    if (record.expiresAt.getTime() <= Date.now()) {
      await this.revoke(record.id);
      throw new UnauthorizedException('Refresh token has expired');
    }

    const revoked = await this.prisma.refreshToken.updateMany({
      where: { id: record.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (revoked.count === 0) {
      throw new UnauthorizedException('Refresh token has already been used');
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: record.userId } });

    const { refreshToken, record: newRecord } = await this.createRefreshToken(user);
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { replacedById: newRecord.id },
    });

    const accessToken = await this.signAccessToken(user);
    return toAuthResponse(user, accessToken, refreshToken);
  }

  /** Revokes a refresh token so it can never be used again. */
  async logout(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async findActiveRecord(
    presentedRefreshToken: string,
    jti: string,
  ): Promise<RefreshToken | null> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(presentedRefreshToken) },
    });
    if (!record || record.revokedAt || record.jti !== jti) {
      return null;
    }
    return record;
  }

  private async revoke(id: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(user: User): Promise<AuthResponseDto> {
    const accessToken = await this.signAccessToken(user);
    const { refreshToken } = await this.createRefreshToken(user);
    return toAuthResponse(user, accessToken, refreshToken);
  }

  private async signAccessToken(user: User): Promise<string> {
    const payload: JwtAccessPayload = {
      sub: user.id,
      email: user.email,
      tokenType: ACCESS_TOKEN_TYPE,
    };
    return this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('jwt.accessSecret'),
      expiresIn: this.configService.getOrThrow<string>('jwt.accessTtl'),
    } as any);
  }

  private async createRefreshToken(
    user: User,
  ): Promise<{ refreshToken: string; record: RefreshToken }> {
    const jti = randomUUID();
    const expiresAt = new Date(
      Date.now() + durationToMilliseconds(this.configService.getOrThrow<string>('jwt.refreshTtl')),
    );

    const payload: JwtRefreshPayload = {
      sub: user.id,
      email: user.email,
      jti,
      tokenType: REFRESH_TOKEN_TYPE,
    };
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('jwt.refreshSecret'),
      expiresIn: this.configService.getOrThrow<string>('jwt.refreshTtl'),
    } as any);

    const record = await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        jti,
        tokenHash: hashToken(refreshToken),
        expiresAt,
      },
    });

    return { refreshToken, record };
  }
}
