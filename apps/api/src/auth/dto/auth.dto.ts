import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    description: '用户邮箱',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: '邮箱格式无效' })
  email!: string;

  @ApiProperty({
    description: '密码（8-128 个字符）',
    example: 'SecurePass123!',
    minLength: 8,
    maxLength: 128,
  })
  @IsString()
  @MinLength(8, { message: '密码至少 8 个字符' })
  @MaxLength(128, { message: '密码最多 128 个字符' })
  password!: string;
}

export class LoginDto {
  @ApiProperty({
    description: '用户邮箱',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: '邮箱格式无效' })
  email!: string;

  @ApiProperty({
    description: '密码',
    example: 'SecurePass123!',
  })
  @IsString()
  password!: string;
}

export class AuthUserResponse {
  @ApiProperty({ description: '用户 ID' })
  id!: string;

  @ApiProperty({ description: '用户邮箱' })
  email!: string;

  @ApiProperty({ description: '用户状态' })
  status!: string;

  @ApiProperty({ description: '注册时间' })
  createdAt!: Date;
}

export class AuthResponse {
  @ApiProperty({ description: 'JWT access token' })
  accessToken!: string;

  @ApiProperty({ description: '当前用户信息' })
  user!: AuthUserResponse;
}