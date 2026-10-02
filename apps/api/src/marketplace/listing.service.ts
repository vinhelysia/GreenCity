import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AdminListingList, CancelReservation, CompleteReservation,
  ListingStatus, MarketplaceListingList, ScheduleReservation,
} from '@greencity/shared';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../authz/auth-context';
import { PointsService } from '../points/points.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  encodePaginationCursor,
  paginationKeysetWhere,
  type PaginationParams,
} from '../common/pagination';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from '../storage/storage.types';
import { SubscriptionService } from './subscription.service';
import { toListingDto, toReservationDto } from './marketplace.mapper';

const contactSelect = { displayName: true, email: true, phone: true } as const;
const reservationInclude = {
  listing: { include: { seller: { select: contactSelect } } },
  buyer: { select: contactSelect },
} as const;

@Injectable()
export class ListingService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly subscriptions: SubscriptionService,
    private readonly audit: AuditService,
    private readonly points: PointsService,
  ) {}

  /** Buyer-facing browse. viewerId is resolved from an optional session cookie. */
  async list(
    viewerId: string | null,
    pagination: PaginationParams = { limit: 20 },
  ): Promise<MarketplaceListingList> {
    // ponytail: only AVAILABLE items are "on the market" today; add a status
    // filter param if a buyer-facing history view is ever requested.
    const rows = await this.prisma.marketplaceListing.findMany({
      where: pagination.cursor
        ? {
            AND: [
              { status: 'AVAILABLE' },
              paginationKeysetWhere(pagination.cursor),
            ],
          }
        : { status: 'AVAILABLE' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pagination.limit + 1,
      include: { scrapRequest: { include: { category: true } } },
    });
    const page = rows.slice(0, pagination.limit);
    const next = rows.length > pagination.limit ? page.at(-1) : undefined;
    return {
      listings: page.map((row) => toListingDto(row, viewerId)),
      ...(next
        ? {
            nextCursor: encodePaginationCursor({
              createdAt: next.createdAt,
              id: next.id,
            }),
          }
        : {}),
    };
  }

  /**
   * Admin queue. Unlike the buyer-facing browse this can list any status —
   * completing a sale needs the RESERVED ones, which never appear on the market.
   */
  async adminList(
    status?: ListingStatus,
    pagination: PaginationParams = { limit: 20 },
  ): Promise<AdminListingList> {
    const baseWhere = status ? { status } : {};
    const rows = await this.prisma.marketplaceListing.findMany({
      where: pagination.cursor
        ? { AND: [baseWhere, paginationKeysetWhere(pagination.cursor)] }
        : baseWhere,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pagination.limit + 1,
      include: {
        scrapRequest: { include: { category: true } },
        reservations: { where: { status: 'RESERVED' }, take: 1, include: reservationInclude },
      },
    });
    // No viewer: an admin is acting on the listing, not shopping for it.
    const page = rows.slice(0, pagination.limit);
    const next = rows.length > pagination.limit ? page.at(-1) : undefined;
    return {
      listings: page.map((row) => ({
        ...toListingDto(row, null),
        reservation: row.reservations[0] ? toReservationDto(row.reservations[0], true) : null,
      })),
      ...(next
        ? {
            nextCursor: encodePaginationCursor({
              createdAt: next.createdAt,
              id: next.id,
            }),
          }
        : {}),
    };
  }

  async getPhoto(id: string): Promise<{ contentType: string; body: Buffer }> {
    const listing = await this.prisma.marketplaceListing.findFirst({
      where: { id, status: 'AVAILABLE' },
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
    let body: Buffer;
    try {
      body = await this.storage.getObject(asset.objectKey);
    } catch {
      // A missing/unreadable object is a 404, not a 500 — the metadata row can
      // outlive its file (e.g. a wiped local storage dir).
      throw new NotFoundException({
        code: 'LISTING_NOT_AVAILABLE',
        message: 'Listing photo not found',
      });
    }
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

  async getReservation(auth: AuthContext, id: string) {
    const isAdmin = auth.roles.includes('ADMIN');
    const row = await this.prisma.reservation.findFirst({
      where: {
        id,
        ...(isAdmin ? {} : { OR: [{ buyerId: auth.user.id }, { listing: { sellerId: auth.user.id } }] }),
      },
      include: reservationInclude,
    });
    if (!row) throw new NotFoundException({ code: 'RESERVATION_NOT_FOUND', message: 'Reservation not found.' });
    return toReservationDto(row, isAdmin);
  }

  async adminSchedule(auth: AuthContext, id: string, body: ScheduleReservation, requestId?: string) {
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.reservation.updateMany({
        where: { id, status: 'RESERVED' },
        data: { ...body, scheduledAt: new Date(body.scheduledAt), scheduledById: auth.user.id },
      });
      if (!updated.count) throw new ConflictException({ code: 'RESERVATION_NOT_ACTIVE', message: 'Reservation is no longer active.' });
      await tx.auditLog.create({ data: { actorId: auth.user.id, action: 'reservation.schedule', targetType: 'Reservation', targetId: id, requestId } });
    });
    return { ok: true };
  }

  adminComplete(auth: AuthContext, id: string, body: CompleteReservation, requestId?: string) {
    return this.finishReservation(auth, id, { status: 'COMPLETED', settlement: body }, requestId);
  }

  adminCancel(auth: AuthContext, id: string, body: CancelReservation, requestId?: string) {
    return this.finishReservation(auth, id, { status: 'CANCELLED', reason: body.reason }, requestId);
  }

  private async finishReservation(
    auth: AuthContext, id: string,
    outcome: { status: 'COMPLETED'; settlement: CompleteReservation } | { status: 'CANCELLED'; reason: string },
    requestId?: string,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const row = await tx.reservation.findUnique({ where: { id }, include: { listing: true } });
      if (!row) throw new NotFoundException({ code: 'RESERVATION_NOT_FOUND', message: 'Reservation not found.' });
      // Lock listing before reservation, matching reserve(). The relation guard
      // prevents an old reservation from changing a rebooked listing.
      const listing = await tx.marketplaceListing.updateMany({
        where: { id: row.listingId, status: 'RESERVED', reservations: { some: { id, status: 'RESERVED' } } },
        data: { status: outcome.status === 'COMPLETED' ? 'COMPLETED' : 'AVAILABLE' },
      });
      if (!listing.count) throw new ConflictException({ code: 'RESERVATION_NOT_ACTIVE', message: 'Reservation is no longer active.' });
      const updated = await tx.reservation.updateMany({
        where: { id, status: 'RESERVED' },
        data: outcome.status === 'COMPLETED'
          ? { status: outcome.status, ...outcome.settlement, completedAt: new Date(), completedById: auth.user.id }
          : { status: outcome.status, cancelReason: outcome.reason, cancelledAt: new Date(), cancelledById: auth.user.id },
      });
      if (!updated.count) throw new ConflictException({ code: 'RESERVATION_NOT_ACTIVE', message: 'Reservation is no longer active.' });
      if (outcome.status === 'COMPLETED') {
        await this.points.awardListingCompleted(tx, row.listing, outcome.settlement.sellerReceivedAmountVnd);
      }
      await tx.auditLog.create({ data: {
        actorId: auth.user.id, action: outcome.status === 'COMPLETED' ? 'reservation.complete' : 'reservation.cancel',
        targetType: 'Reservation', targetId: id, requestId, metadata: { listingId: row.listingId },
      } });
    });
    return { ok: true };
  }
}
