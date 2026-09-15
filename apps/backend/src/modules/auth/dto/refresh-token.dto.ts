import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'The refresh token to rotate (or revoke on logout)' })
  @IsString()
  @IsNotEmpty({ message: 'refreshToken must not be empty' })
  refreshToken!: string;
}
