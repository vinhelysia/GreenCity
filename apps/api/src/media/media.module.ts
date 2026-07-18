import { Module } from '@nestjs/common';
import { AuthzModule } from '../authz/authz.module';
import { StorageModule } from '../storage/storage.module';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';

@Module({
  imports: [StorageModule, AuthzModule],
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
