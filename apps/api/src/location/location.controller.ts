import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import {
  CreateLocationRequestSchema,
  type CreateLocationRequest,
  type ReverseGeocodeResult,
} from '@greencity/shared';
import type { Request } from 'express';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { getRequestId } from '../common/request-id';
import { CurrentUser } from '../authz/current-user.decorator';
import type { AuthContext } from '../authz/auth-context';
import { GeocodingService } from './geocoding.service';
import { LocationService } from './location.service';

const ReverseQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

@Controller('locations')
export class LocationController {
  constructor(
    private readonly locations: LocationService,
    private readonly geocoding: GeocodingService,
  ) {}

  /**
   * Pin → Vietnamese address components.
   *
   * Authenticated and rate limited because every call bills Google. A signed-in
   * user dropping a pin makes a handful of these; anything near the limit is
   * someone using us as a free geocoding proxy.
   */
  @Get('reverse-geocode')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async reverseGeocode(
    @Query(new ZodValidationPipe(ReverseQuerySchema))
    query: z.infer<typeof ReverseQuerySchema>,
  ): Promise<ReverseGeocodeResult> {
    return this.geocoding.reverse(query.lat, query.lng);
  }

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
