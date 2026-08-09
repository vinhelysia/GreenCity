import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import {
  CreateScrapRequestSchema,
  PaginationQuerySchema,
  type CreateScrapRequest,
  type PaginationQuery,
} from '@greencity/shared';
import type { Request } from 'express';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { getRequestId } from '../common/request-id';
import { CurrentUser } from '../authz/current-user.decorator';
import type { AuthContext } from '../authz/auth-context';
import { ScrapRequestService } from './scrap-request.service';
import { parsePaginationQuery } from '../common/pagination';

@Controller('scrap-requests')
export class ScrapRequestController {
  constructor(private readonly scrapRequests: ScrapRequestService) {}

  @Post()
  async submit(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(CreateScrapRequestSchema))
    body: CreateScrapRequest,
    @Req() req: Request,
  ) {
    return this.scrapRequests.submit(auth, body, getRequestId(req));
  }

  @Get('mine')
  async mine(
    @CurrentUser() auth: AuthContext,
    @Query(new ZodValidationPipe(PaginationQuerySchema))
    query: PaginationQuery,
  ) {
    return this.scrapRequests.mine(auth, parsePaginationQuery(query));
  }

  @Post(':id/accept')
  async accept(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.scrapRequests.accept(auth, id, getRequestId(req));
  }

  @Post(':id/reject')
  async reject(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.scrapRequests.reject(auth, id, getRequestId(req));
  }
}
