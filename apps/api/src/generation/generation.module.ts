import { Module } from '@nestjs/common';
import { ProvidersModule } from '../providers/providers.module';
import { RetrievalModule } from '../retrieval/retrieval.module';
import { GenerationService } from './generation.service';

@Module({
  imports: [ProvidersModule, RetrievalModule],
  providers: [GenerationService],
  exports: [GenerationService],
})
export class GenerationModule {}