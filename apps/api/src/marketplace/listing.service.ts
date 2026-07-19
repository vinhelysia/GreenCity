import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { MarketplaceListingList } from '@greencity/shared';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../authz/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from '../storage/storage.types';
import { SubscriptionService } from './subscription.service';
import { toListingDto } from './marketplace.mapper';

@Injectable()
export class ListingService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly subscriptions: SubscriptionService,
    private readonly audit: AuditService,
  ) {}

  /** Buyer-facing browse. viewerId is resolved from an optional session cookie. */
  async list(viewerId: string | null): Promise<MarketplaceListingList> {
    // ponytail: only AVAILABLE items are "on the market" today; add a status
    // filter param if a buyer-facing history view is ever requested.
    const rows = await this.prisma.marketplaceListing.findMany({
      where: { status: 'AVAILABLE' },
      orderBy: { createdAt: 'desc' },
    });
    return { listings: rows.map((row) => toListingDto(row, viewerId)) };
  }

  async getPhoto(id: string): Promise<{ contentType: string; body: Buffer }> {
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id },
    });
    if (!listing) {
      throw new NotFoundException({
        code: 'LISTING_NOT_AVAILABLE',
        message: 'Listing not found',
      });
    }
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: listing.mediaAssetId },
    });
    if (!asset || asset.deletedAt) {
      throw new NotFoundException({
        code: 'LISTING_NOT_AVAILABLE',
        message: 'Listing photo not found',
      });
    }
    const body = await this.storage.getObject(asset.objectKey);
    return { contentType: asset.contentType, body };
  }

  async reserve(
    auth: AuthContext,
    id: string,
    requestId?: string,
  ): Promise<{ ok: true; reservationId: string }> {
    const eligible = await this.subscriptions.isEligible(auth.user.id);
    if (!eligible) {
      throw new ForbiddenException({
        code: 'SUBSCRIPTION_REQUIRED',
        message: 'An active subscription is required to reserve listings',
      });
    }

    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id },
    });
    if (!listing) {
      throw new NotFoundException({
        code: 'LISTING_NOT_AVAILABLE',
        message: 'Listing not found',
      });
    }
    if (listing.sellerId === auth.user.id) {
      throw new ForbiddenException({
        code: 'CANNOT_RESERVE_OWN_LISTING',
        message: 'Sellers cannot reserve their own listing',
      });
    }

    const reservation = await this.prisma.$transaction(async (tx) => {
      const update = await tx.marketplaceListing.updateMany({
        where: { id, status: 'AVAILABLE' },
        data: { status: 'RESERVED' },
      });
      if (update.count === 0) {
        throw new ConflictException({
          code: 'LISTING_NOT_AVAILABLE',
          message: 'Listing is no longer available',
        });
      }

      // The @unique on listingId is the backstop, not the mechanism — the
      // conditional updateMany above is what actually serializes concurrent
      // reservations. This catch only guards against a logic regression.
      return tx.reservation
        .create({ data: { listingId: id, buyerId: auth.user.id } })
        .catch((err: unknown) => {
          if (
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === 'P2002'
          ) {
            throw new ConflictException({
              code: 'LISTING_NOT_AVAILABLE',
              message: 'Listing is no longer available',
            });
          }
          throw err;
        });
    });

    await this.audit.record({
      actorId: auth.user.id,
      action: 'listing.reserve',
      targetType: 'MarketplaceListing',
      targetId: id,
      requestId,
      metadata: { reservationId: reservation.id },
    });

    return { ok: true, reservationId: reservation.id };
  }

  async adminComplete(
    auth: AuthContext,
    id: string,
    requestId?: string,
  ): Promise<{ ok: true }> {
    const update = await this.prisma.marketplaceListing.updateMany({
      where: { id, status: 'RESERVED' },
      data: { status: 'COMPLETED' },
    });
    if (update.count === 0) {
      throw new ConflictException({
        code: 'LISTING_NOT_AVAILABLE',
        message: 'Listing is not reserved',
      });
    }

    await this.audit.record({
      actorId: auth.user.id,
      action: 'listing.complete',
      targetType: 'MarketplaceListing',
      targetId: id,
      requestId,
    });

    return { ok: true };
  }
}
