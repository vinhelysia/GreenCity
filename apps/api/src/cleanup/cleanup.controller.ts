import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import {
  CreateCleanupReportSchema,
  RecentItemsQuerySchema,
  type CreateCleanupReport,
  type RecentItemsQuery,
} from '@greencity/shared';
import type { Response } from 'express';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { Public } from '../authz/authenticated.guard';
import { CurrentUser } from '../authz/current-user.decorator';
import type { AuthContext } from '../authz/auth-context';
import { CleanupService } from './cleanup.service';

@Controller('cleanup-reports')
export class CleanupController {
  constructor(private readonly cleanupService: CleanupService) {}

  @Post()
  async submit(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(CreateCleanupReportSchema))
    body: CreateCleanupReport,
  ) {
    return this.cleanupService.submit(auth, body);
  }

  @Get('mine')
  /**
   * `?limit=5` is the bounded account-dashboard snapshot. Omitting it keeps the
   * legacy full-history behaviour for the existing contribution screen; that
   * compatibility path is deliberately not presented as pagination.
   */
  async mine(
    @CurrentUser() auth: AuthContext,
    @Query(new ZodValidationPipe(RecentItemsQuerySchema))
    query: RecentItemsQuery,
  ) {
    return this.cleanupService.mine(auth, query.limit);
  }

  @Public()
  @Get('public')
  async listPublicVerified() {
    return this.cleanupService.listPublicVerified();
  }

  @Public()
  @Get(':id/photo')
  async photo(@Param('id') id: string, @Res() res: Response) {
    const { contentType, body } = await this.cleanupService.getPublicPhoto(id);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', String(body.length));
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(body);
  }
}
