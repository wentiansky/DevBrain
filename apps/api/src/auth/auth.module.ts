import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthConfigService } from './auth-config.service';
import { PasswordHasherService } from './password-hasher.service';
import { TokenService } from './token.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { SpacesModule } from '../spaces/spaces.module';

@Module({
  imports: [
    JwtModule.register({}),
    SpacesModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthConfigService,
    PasswordHasherService,
    TokenService,
    AuthService,
    JwtAuthGuard,
  ],
  exports: [JwtAuthGuard, AuthService, TokenService, AuthConfigService],
})
export class AuthModule {}