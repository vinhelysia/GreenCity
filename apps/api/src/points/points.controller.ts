import { Controller, Get } from '@nestjs/common';
import type { PointsBalance, RewardOfferList } from '@greencity/shared';
import type { AuthContext } from '../authz/auth-context';
import { CurrentUser } from '../authz/current-user.decorator';
import { PointsService } from './points.service';

@Controller('points')
export class PointsController {
  constructor(private readonly points: PointsService) {}

  @Get('me')
  me(@CurrentUser() auth: AuthContext): Promise<PointsBalance> {
    return this.points.getBalance(auth.user.id);
  }

  // No @Public(): the catalog is only shown alongside a signed-in user's own
  // balance, and the global AuthenticatedGuard is the simplest way to keep it
  // that way.
  @Get('offers')
  offers(): Promise<RewardOfferList> {
    return this.points.listOffers();
  }
}
