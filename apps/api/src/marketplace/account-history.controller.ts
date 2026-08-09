import { Controller, Get, Query } from '@nestjs/common';
import {
  AccountHistoryQuerySchema,
  type AccountHistory,
  type AccountHistoryQuery,
} from '@greencity/shared';
import type { AuthContext } from '../authz/auth-context';
import { CurrentUser } from '../authz/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AccountHistoryService } from './account-history.service';

/** Read-only snapshots for the authenticated account dashboard. */
@Controller('account')
export class AccountHistoryController {
  constructor(private readonly accountHistory: AccountHistoryService) {}

  @Get('history')
  history(
    @CurrentUser() auth: AuthContext,
    @Query(new ZodValidationPipe(AccountHistoryQuerySchema))
    query: AccountHistoryQuery,
  ): Promise<AccountHistory> {
    return this.accountHistory.getRecent(auth.user.id, query.limit);
  }
}
