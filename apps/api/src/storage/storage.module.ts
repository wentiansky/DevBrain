import { Module, Global } from '@nestjs/common';
import { LocalStorageAdapter } from './local-storage.adapter';
import { LocalStorageController } from './local-storage.controller';

export const OBJECT_STORAGE = 'OBJECT_STORAGE';

@Global()
@Module({
  controllers: [LocalStorageController],
  providers: [
    LocalStorageAdapter,
    { provide: OBJECT_STORAGE, useClass: LocalStorageAdapter },
  ],
  exports: [OBJECT_STORAGE, LocalStorageAdapter],
})
export class StorageModule {}