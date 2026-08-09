import { Module } from '@nestjs/common';
import { AuthzModule } from '../authz/authz.module';
import { PointsModule } from '../points/points.module';
import { StorageModule } from '../storage/storage.module';
import { AdminController } from './admin.controller';
import { AccountHistoryController } from './account-history.controller';
import { AccountHistoryService } from './account-history.service';
import { ListingController } from './listing.controller';
import { ListingService } from './listing.service';
import { ScrapCategoryController } from './scrap-category.controller';
import { ScrapCategoryService } from './scrap-category.service';
import { ScrapRequestController } from './scrap-request.controller';
import { ScrapRequestService } from './scrap-request.service';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';

@Module({
  imports: [AuthzModule, StorageModule, PointsModule],
  controllers: [
    AccountHistoryController,
    ScrapCategoryController,
    ScrapRequestController,
    ListingController,
    SubscriptionController,
    AdminController,
  ],
  providers: [
    AccountHistoryService,
    ScrapCategoryService,
    ScrapRequestService,
    ListingService,
    SubscriptionService,
  ],
})
export class MarketplaceModule {}
