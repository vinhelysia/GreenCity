import { Controller, Get } from '@nestjs/common';
import type { PointsBalance } from '@greencity/shared';
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
}
