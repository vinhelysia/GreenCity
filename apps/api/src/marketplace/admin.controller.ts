import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import {
  CreateQuoteRequestSchema,
  GrantSubscriptionRequestSchema,
  ListingStatusSchema,
  ScrapRequestStatusSchema,
  type CreateQuoteRequest,
  type GrantSubscriptionRequest,
  type ListingStatus,
  type ScrapRequestStatus,
} from '@greencity/shared';
import type { Request } from 'express';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { getRequestId } from '../common/request-id';
import { CurrentUser } from '../authz/current-user.decorator';
import type { AuthContext } from '../authz/auth-context';
import { Roles } from '../authz/roles.decorator';
import { RolesGuard } from '../authz/roles.guard';
import { ScrapRequestService } from './scrap-request.service';
import { ListingService } from './listing.service';
import { SubscriptionService } from './subscription.service';

const AdminScrapRequestQuerySchema = z.object({
  status: ScrapRequestStatusSchema.optional(),
});

const AdminListingQuerySchema = z.object({
  status: ListingStatusSchema.optional(),
});

/** First real use of RolesGuard — every route here requires ADMIN. */
@Controller('admin')
@UseGuards(RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(
    private readonly scrapRequests: ScrapRequestService,
    private readonly listings: ListingService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  @Get('scrap-requests')
  async listScrapRequests(
    @Query(new ZodValidationPipe(AdminScrapRequestQuerySchema))
    query: { status?: ScrapRequestStatus },
  ) {
    return this.scrapRequests.adminList(query.status);
  }

  @Post('scrap-requests/:id/quote')
  async quote(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CreateQuoteRequestSchema))
    body: CreateQuoteRequest,
    @Req() req: Request,
  ) {
    return this.scrapRequests.adminQuote(auth, id, body, getRequestId(req));
  }

  @Get('listings')
  async listListings(
    @Query(new ZodValidationPipe(AdminListingQuerySchema))
    query: { status?: ListingStatus },
  ) {
    return this.listings.adminList(query.status);
  }

  @Post('listings/:id/complete')
  async completeListing(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.listings.adminComplete(auth, id, getRequestId(req));
  }

  // Grant only. There is deliberately no revoke and no list-all-passes route:
  // eligibility is a query over rows, so an expiry does the revoking, and a
  // route that enumerates who holds a paid feature is not needed to issue one.
  @Post('subscriptions')
  async grantSubscription(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(GrantSubscriptionRequestSchema))
    body: GrantSubscriptionRequest,
    @Req() req: Request,
  ) {
    return this.subscriptions.grantByAdmin(auth, body, getRequestId(req));
  }
}
