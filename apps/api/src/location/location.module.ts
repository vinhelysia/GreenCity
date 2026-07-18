import { Module } from '@nestjs/common';
import { AuthzModule } from '../authz/authz.module';
import { LocationController } from './location.controller';
import { LocationService } from './location.service';

@Module({
  imports: [AuthzModule],
  controllers: [LocationController],
  providers: [LocationService],
  exports: [LocationService],
})
export class LocationModule {}
