import { Module } from '@nestjs/common';
import { PersonalSpaceService } from './personal-space.service';
import { PersonalSpaceInterceptor } from './personal-space.interceptor';

@Module({
  providers: [PersonalSpaceService, PersonalSpaceInterceptor],
  exports: [PersonalSpaceService, PersonalSpaceInterceptor],
})
export class SpacesModule {}