import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CreateQuoteRequest,
  CreateScrapRequest,
  Quote as QuoteDto,
  ScrapRequestDto,
  ScrapRequestList,
  ScrapRequestStatus,
} from '@greencity/shared';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../authz/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import { toQuoteDto, toScrapRequestDto } from './marketplace.mapper';

const QUOTABLE_STATUSES = ['SUBMITTED', 'QUOTED'] as const;

@Injectable()
export class ScrapRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async submit(
    auth: AuthContext,
    body: CreateScrapRequest,
    requestId?: string,
  ): Promise<ScrapRequestDto> {
    // 404 either way — a foreign or missing asset must not confirm existence.
    const media = await this.prisma.mediaAsset.findFirst({
      where: { id: body.mediaAssetId, ownerId: auth.user.id, deletedAt: null },
    });
    if (!media) {
      throw new NotFoundException({
        code: 'MEDIA_NOT_OWNED',
        message: 'Media asset not found',
      });
    }

    const category = await this.prisma.scrapCategory.findFirst({
      where: { id: body.categoryId, active: true },
    });
    if (!category) {
      throw new NotFoundException({
        code: 'CATEGORY_NOT_FOUND',
        message: 'Category not found',
      });
    }

    let created;
    try {
      created = await this.prisma.scrapRequest.create({
        data: {
          sellerId: auth.user.id,
          categoryId: category.id,
          estimatedWeightKg: body.estimatedWeightKg,
          mediaAssetId: body.mediaAssetId,
          note: body.note ?? null,
        },
        include: { category: true, media: true },
      });
    } catch (err) {
      // mediaAssetId is @unique — a photo can only ever back one request.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'MEDIA_ALREADY_USED',
          message: 'This photo is already attached to a scrap request',
        });
      }
      throw err;
    }

    return toScrapRequestDto({ ...created, quotes: [] });
  }

  async mine(auth: AuthContext): Promise<ScrapRequestList> {
    const rows = await this.prisma.scrapRequest.findMany({
      where: { sellerId: auth.user.id },
      include: {
        category: true,
        media: true,
        quotes: {
          where: { status: { not: 'SUPERSEDED' } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { requests: rows.map(toScrapRequestDto) };
  }

  private async findOwned(auth: AuthContext, id: string) {
    const existing = await this.prisma.scrapRequest.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!existing || existing.sellerId !== auth.user.id) {
      throw new NotFoundException({
        code: 'SCRAP_REQUEST_NOT_FOUND',
        message: 'Scrap request not found',
      });
    }
    return existing;
  }

  async accept(
    auth: AuthContext,
    id: string,
    requestId?: string,
  ): Promise<{ ok: true; listingId: string }> {
    const existing = await this.findOwned(auth, id);

    const listing = await this.prisma.$transaction(async (tx) => {
      const reqUpdate = await tx.scrapRequest.updateMany({
        where: { id, status: 'QUOTED' },
        data: { status: 'ACCEPTED' },
      });
      if (reqUpdate.count === 0) {
        throw new ConflictException({
          code: 'SCRAP_REQUEST_NOT_QUOTABLE',
          message: 'Scrap request is not awaiting acceptance',
        });
      }

      const quoteUpdate = await tx.quote.updateMany({
        where: { scrapRequestId: id, status: 'PENDING' },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });
      if (quoteUpdate.count === 0) {
        throw new ConflictException({
          code: 'QUOTE_NOT_PENDING',
          message: 'Quote is no longer pending',
        });
      }

      const quote = await tx.quote.findFirstOrThrow({
        where: { scrapRequestId: id, status: 'ACCEPTED' },
      });

      return tx.marketplaceListing.create({
        data: {
          quoteId: quote.id,
          scrapRequestId: id,
          sellerId: existing.sellerId,
          categoryName: existing.category.name,
          estimatedWeightKg: existing.estimatedWeightKg,
          // ponytail: buyer margin is a pending business decision — buyer pays
          // the seller price for now. Change this one line when it lands.
          sellerPricePerKgVnd: quote.pricePerKgVnd,
          buyerPricePerKgVnd: quote.pricePerKgVnd,
          mediaAssetId: existing.mediaAssetId,
        },
      });
    });

    await this.audit.record({
      actorId: auth.user.id,
      action: 'quote.accept',
      targetType: 'ScrapRequest',
      targetId: id,
      requestId,
    });
    await this.audit.record({
      actorId: auth.user.id,
      action: 'listing.create',
      targetType: 'MarketplaceListing',
      targetId: listing.id,
      requestId,
      metadata: { scrapRequestId: id },
    });

    return { ok: true, listingId: listing.id };
  }

  async reject(
    auth: AuthContext,
    id: string,
    requestId?: string,
  ): Promise<{ ok: true }> {
    await this.findOwned(auth, id);

    await this.prisma.$transaction(async (tx) => {
      const reqUpdate = await tx.scrapRequest.updateMany({
        where: { id, status: 'QUOTED' },
        data: { status: 'REJECTED' },
      });
      if (reqUpdate.count === 0) {
        throw new ConflictException({
          code: 'SCRAP_REQUEST_NOT_QUOTABLE',
          message: 'Scrap request is not awaiting a decision',
        });
      }

      const quoteUpdate = await tx.quote.updateMany({
        where: { scrapRequestId: id, status: 'PENDING' },
        data: { status: 'REJECTED' },
      });
      if (quoteUpdate.count === 0) {
        throw new ConflictException({
          code: 'QUOTE_NOT_PENDING',
          message: 'Quote is no longer pending',
        });
      }
    });

    await this.audit.record({
      actorId: auth.user.id,
      action: 'quote.reject',
      targetType: 'ScrapRequest',
      targetId: id,
      requestId,
    });

    return { ok: true };
  }

  async adminList(status?: ScrapRequestStatus) {
    const rows = await this.prisma.scrapRequest.findMany({
      where: status ? { status } : {},
      include: { category: true, seller: true },
      orderBy: { createdAt: 'asc' },
    });
    return {
      requests: rows.map((r) => ({
        id: r.id,
        sellerId: r.sellerId,
        sellerDisplayName: r.seller.displayName ?? r.seller.email,
        category: {
          id: r.category.id,
          name: r.category.name,
          minPricePerKgVnd: r.category.minPricePerKgVnd,
          maxPricePerKgVnd: r.category.maxPricePerKgVnd,
          active: r.category.active,
        },
        estimatedWeightKg: r.estimatedWeightKg,
        note: r.note,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        mediaDownloadPath: `/media/${r.mediaAssetId}/content`,
      })),
    };
  }

  async adminQuote(
    auth: AuthContext,
    id: string,
    body: CreateQuoteRequest,
    requestId?: string,
  ): Promise<QuoteDto> {
    const existing = await this.prisma.scrapRequest.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'SCRAP_REQUEST_NOT_FOUND',
        message: 'Scrap request not found',
      });
    }
    if (!QUOTABLE_STATUSES.includes(existing.status as 'SUBMITTED' | 'QUOTED')) {
      throw new ConflictException({
        code: 'SCRAP_REQUEST_NOT_QUOTABLE',
        message: 'Scrap request cannot be quoted in its current state',
      });
    }
    if (
      body.pricePerKgVnd < existing.category.minPricePerKgVnd ||
      body.pricePerKgVnd > existing.category.maxPricePerKgVnd
    ) {
      throw new UnprocessableEntityException({
        code: 'QUOTE_OUT_OF_PUBLISHED_RANGE',
        message: 'Quote price is outside the published band',
      });
    }

    const quote = await this.prisma.$transaction(async (tx) => {
      await tx.quote.updateMany({
        where: { scrapRequestId: id, status: 'PENDING' },
        data: { status: 'SUPERSEDED' },
      });

      const reqUpdate = await tx.scrapRequest.updateMany({
        where: { id, status: { in: [...QUOTABLE_STATUSES] } },
        data: { status: 'QUOTED' },
      });
      if (reqUpdate.count === 0) {
        throw new ConflictException({
          code: 'SCRAP_REQUEST_NOT_QUOTABLE',
          message: 'Scrap request cannot be quoted in its current state',
        });
      }

      return tx.quote.create({
        data: {
          scrapRequestId: id,
          pricePerKgVnd: body.pricePerKgVnd,
          status: 'PENDING',
        },
      });
    });

    await this.audit.record({
      actorId: auth.user.id,
      action: 'quote.create',
      targetType: 'Quote',
      targetId: quote.id,
      requestId,
      metadata: { scrapRequestId: id, pricePerKgVnd: body.pricePerKgVnd },
    });

    return toQuoteDto(quote);
  }
}
