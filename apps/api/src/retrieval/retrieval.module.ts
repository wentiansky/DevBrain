import { Module } from '@nestjs/common';
import { ProvidersModule } from '../providers/providers.module';
import { PostgresVectorStore } from './postgres-vector-store';
import { RetrievalService } from './retrieval.service';

@Module({
  imports: [ProvidersModule],
  providers: [PostgresVectorStore, RetrievalService],
  exports: [RetrievalService],
})
export class RetrievalModule {}