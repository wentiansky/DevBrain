import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { RegisterDto, LoginDto, AuthUserResponse, AuthResponse } from './dto/auth.dto';
import type { User } from '@devbrain/db';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: '用户注册' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: '注册成功', type: AuthResponse })
  @ApiResponse({ status: 409, description: '邮箱已注册' })
  @ApiResponse({ status: 429, description: '请求过于频繁' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.authService.register(dto, req, res);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '用户登录' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: '登录成功', type: AuthResponse })
  @ApiResponse({ status: 401, description: '邮箱或密码错误' })
  @ApiResponse({ status: 429, description: '请求过于频繁' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.authService.login(dto, req, res);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '刷新 access token（需要 refresh cookie）' })
  @ApiResponse({ status: 200, description: '刷新成功', type: AuthResponse })
  @ApiResponse({ status: 401, description: 'refresh token 无效或已过期' })
  @ApiResponse({ status: 429, description: '请求过于频繁' })
  async refresh(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.authService.refresh(req, res);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '退出登录（需要 refresh cookie）' })
  @ApiResponse({ status: 200, description: '已退出' })
  async logout(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.authService.logout(req, res);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前用户信息' })
  @ApiResponse({ status: 200, description: '当前用户信息', type: AuthUserResponse })
  @ApiResponse({ status: 401, description: '未认证' })
  async me(@CurrentUser() user: User): Promise<AuthUserResponse> {
    return this.authService.getMe(user);
  }
}