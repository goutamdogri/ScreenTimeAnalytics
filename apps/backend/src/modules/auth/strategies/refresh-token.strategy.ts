import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUserWithJti } from '../../../common/decorators/current-user.decorator';
import { JwtRefreshPayload, REFRESH_TOKEN_TYPE } from '../tokens';

/**
 * Validates refresh tokens presented in the request body (`refreshToken`
 * field) and attaches the user plus the token's `jti` to the request.
 */
@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('jwt.refreshSecret'),
    });
  }

  async validate(payload: JwtRefreshPayload): Promise<AuthenticatedUserWithJti> {
    if (payload.tokenType !== REFRESH_TOKEN_TYPE) {
      throw new UnauthorizedException('Invalid token type');
    }
    return { userId: payload.sub, email: payload.email, jti: payload.jti };
  }
}
