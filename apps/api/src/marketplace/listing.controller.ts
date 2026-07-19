import { Controller, Get, Param, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { loadEnv } from '../config/env';
import { getRequestId } from '../common/request-id';
import { Public } from '../authz/authenticated.guard';
import { CurrentUser } from '../authz/current-user.decorator';
import type { AuthContext } from '../authz/auth-context';
import { SessionService } from '../auth/session.service';
import { ListingService } from './listing.service';

@Controller('marketplace/listings')
export class ListingController {
  constructor(
    private readonly listings: ListingService,
    private readonly sessions: SessionService,
  ) {}

  @Public()
  @Get()
  async list(@Req() req: Request) {
    const viewerId = await this.resolveOptionalViewerId(req);
    return this.listings.list(viewerId);
  }

  /** Photo visibility follows the listing, not the underlying asset's ownership. */
  @Public()
  @Get(':id/photo')
  async photo(@Param('id') id: string, @Res() res: Response) {
    const { contentType, body } = await this.listings.getPhoto(id);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', String(body.length));
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Deliberately public/cacheable, unlike /media/:id: a listing photo is
    // meant to be shown to any buyer browsing the market.
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(body);
  }

  @Post(':id/reserve')
  async reserve(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.listings.reserve(auth, id, getRequestId(req));
  }

  /** Best-effort session resolution — an absent or invalid cookie is not an error here. */
  private async resolveOptionalViewerId(req: Request): Promise<string | null> {
    const env = loadEnv();
    const raw = (req as Request & { cookies?: Record<string, string> })
      .cookies?.[env.SESSION_COOKIE_NAME];
    if (!raw) return null;
    try {
      const active = await this.sessions.resolveActiveSession(raw);
      return active.user.id;
    } catch {
      return null;
    }
  }
}
