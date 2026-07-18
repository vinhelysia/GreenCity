import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import {
  CreateLocationRequestSchema,
  type CreateLocationRequest,
} from '@greencity/shared';
import type { Request } from 'express';
import { OriginGuard } from '../common/origin.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { getRequestId } from '../common/request-id';
import { AuthenticatedGuard } from '../authz/authenticated.guard';
import { CurrentUser } from '../authz/current-user.decorator';
import type { AuthContext } from '../authz/auth-context';
import { LocationService } from './location.service';

@Controller('locations')
@UseGuards(OriginGuard, AuthenticatedGuard)
export class LocationController {
  constructor(private readonly locations: LocationService) {}

  @Post()
  async create(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(CreateLocationRequestSchema))
    body: CreateLocationRequest,
    @Req() req: Request,
  ) {
    return this.locations.createExact(auth, body, getRequestId(req));
  }

  /** Exact coordinates — owner or admin only. */
  @Get(':id/exact')
  async exact(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.locations.getExact(auth, id);
  }

  /** Coarse public view — no street/exact coordinates. */
  @Get(':id/public')
  async publicView(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.locations.getPublic(auth, id);
  }
}
