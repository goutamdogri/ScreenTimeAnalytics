import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com', description: 'Account email address' })
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: 'StrongPassw0rd!', minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  @MaxLength(128, { message: 'password must be at most 128 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message:
      'password must contain at least one lowercase letter, one uppercase letter, and one digit',
  })
  password!: string;
}
