import { Module } from '@nestjs/common';
import { AuthzModule } from '../authz/authz.module';
import { PointsModule } from '../points/points.module';
import { CleanupController } from './cleanup.controller';
import { CleanupAdminController } from './cleanup-admin.controller';
import { CleanupService } from './cleanup.service';

@Module({
  imports: [AuthzModule, PointsModule],
  controllers: [CleanupController, CleanupAdminController],
  providers: [CleanupService],
})
export class CleanupModule {}
