import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { AuthModule } from '../auth/auth.module';
import { SpacesModule } from '../spaces/spaces.module';
import { KnowledgeBaseModule } from '../kbs/knowledge-base.module';

@Module({
  imports: [AuthModule, SpacesModule, KnowledgeBaseModule],
  controllers: [UploadsController],
  providers: [UploadsService],
})
export class UploadsModule {}