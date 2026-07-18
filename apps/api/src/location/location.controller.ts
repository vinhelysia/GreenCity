import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import {
  CreateLocationRequestSchema,
  type CreateLocationRequest,
} from '@greencity/shared';
import type { Request } from 'express';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { getRequestId } from '../common/request-id';
import { CurrentUser } from '../authz/current-user.decorator';
import type { AuthContext } from '../authz/auth-context';
import { LocationService } from './location.service';

@Controller('locations')
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
  async exact(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.locations.getExact(auth, id, getRequestId(req));
  }

  /** Coarse public view — no street/exact coordinates. */
  @Get(':id/public')
  async publicView(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.locations.getPublic(auth, id);
  }
}
