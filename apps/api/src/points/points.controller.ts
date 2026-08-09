import { Controller, Get, Query } from '@nestjs/common';
import {
  RecentItemsQuerySchema,
  type PointsBalance,
  type RecentItemsQuery,
  type RewardOffers,
} from '@greencity/shared';
import type { AuthContext } from '../authz/auth-context';
import { CurrentUser } from '../authz/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PointsService } from './points.service';

@Controller('points')
export class PointsController {
  constructor(private readonly points: PointsService) {}

  @Get('me')
  /**
   * `?limit=5` is the bounded account-dashboard snapshot. Omitting it preserves
   * the legacy full-ledger response for the existing rewards screen; it is not
   * pagination and should not be used by new compact views.
   */
  me(
    @CurrentUser() auth: AuthContext,
    @Query(new ZodValidationPipe(RecentItemsQuerySchema))
    query: RecentItemsQuery,
  ): Promise<PointsBalance> {
    return this.points.getBalance(auth.user.id, query.limit);
  }

  // No @Public(): the catalog is only shown alongside a signed-in user's own
  // balance, and the global AuthenticatedGuard is the simplest way to keep it
  // that way.
  @Get('offers')
  offers(): Promise<RewardOffers> {
    return this.points.listOffers();
  }
}
