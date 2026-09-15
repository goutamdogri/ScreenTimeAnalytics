import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsUUID } from 'class-validator';
import { TokenPair } from '../tokens';

export class RefreshTokenPairDto implements TokenPair {
  @ApiProperty({ description: 'Short-lived JWT used to authenticate API requests' })
  @IsString()
  accessToken!: string;

  @ApiProperty({ description: 'Rotating JWT used to mint new access tokens' })
  @IsString()
  refreshToken!: string;
}

export class AuthUserDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;

  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;
}

export class AuthResponseDto {
  @ApiProperty()
  user!: AuthUserDto;

  @ApiProperty()
  tokens!: RefreshTokenPairDto;
}
