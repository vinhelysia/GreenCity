import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../authz/current-user.decorator';
import type { AuthContext } from '../authz/auth-context';
import { SubscriptionService } from './subscription.service';

@Controller('subscriptions')
export class SubscriptionController {
  constructor(private readonly subscriptions: SubscriptionService) {}

  @Get('me')
  async me(@CurrentUser() auth: AuthContext) {
    return this.subscriptions.me(auth.user.id);
  }
}
