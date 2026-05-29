import { Module, ValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { HealthController } from './health/health.controller';
import { ReadyzController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';
import { SpacesModule } from './spaces/spaces.module';
import { KnowledgeBaseModule } from './kbs/knowledge-base.module';

@Module({
  imports: [AuthModule, SpacesModule, KnowledgeBaseModule],
  controllers: [HealthController, ReadyzController],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
  ],
})
export class AppModule {}
