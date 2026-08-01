import { Module } from '@nestjs/common';
import { AuthzModule } from '../authz/authz.module';
import { GeocodingService } from './geocoding.service';
import { LocationController } from './location.controller';
import { LocationService } from './location.service';

@Module({
  imports: [AuthzModule],
  controllers: [LocationController],
  providers: [LocationService, GeocodingService],
  exports: [LocationService],
})
export class LocationModule {}
