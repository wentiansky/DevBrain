import { Module } from '@nestjs/common';
import { DocumentWorker } from './document.worker';
import { DocumentProcessorService } from './processor.service';
import { LocalStorageAdapter } from './storage/local-storage.adapter';

export const OBJECT_STORAGE = 'OBJECT_STORAGE';

@Module({
  providers: [
    DocumentWorker,
    DocumentProcessorService,
    {
      provide: OBJECT_STORAGE,
      useClass: LocalStorageAdapter,
    },
  ],
})
export class WorkerModule {}