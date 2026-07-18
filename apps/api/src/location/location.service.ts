import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateLocationRequest,
  LocationExactDto,
  LocationPublicDto,
} from '@greencity/shared';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../authz/auth-context';
import {
  assertOwnerOrAdmin,
  isOwner,
} from '../authz/ownership.policy';
import { PrismaService } from '../prisma/prisma.service';
import {
  toExactDto,
  toPublicDto,
  toPublicFromExact,
} from './location.redaction';

@Injectable()
export class LocationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createExact(
    auth: AuthContext,
    input: CreateLocationRequest,
    requestId?: string,
  ): Promise<{ exact: LocationExactDto; public: LocationPublicDto }> {
    const coarse = toPublicFromExact({
      id: 'tmp',
      ownerId: auth.user.id,
      label: input.label ?? null,
      addressLine: input.addressLine ?? null,
      ward: input.ward ?? null,
      district: input.district ?? null,
      city: input.city ?? null,
      country: input.country ?? 'VN',
      latitude: input.latitude,
      longitude: input.longitude,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const exact = await this.prisma.locationExact.create({
      data: {
        ownerId: auth.user.id,
        label: input.label ?? null,
        addressLine: input.addressLine ?? null,
        ward: input.ward ?? null,
        district: input.district ?? null,
        city: input.city ?? null,
        country: input.country ?? 'VN',
        latitude: input.latitude,
        longitude: input.longitude,
        publicView: {
          create: {
            approxLatitude: coarse.approxLatitude,
            approxLongitude: coarse.approxLongitude,
            city: coarse.city,
            district: coarse.district,
            ward: coarse.ward,
            gridCell: coarse.gridCell,
          },
        },
      },
      include: { publicView: true },
    });

    await this.audit.record({
      actorId: auth.user.id,
      action: 'location.create',
      targetType: 'LocationExact',
      targetId: exact.id,
      requestId,
      metadata: {
        city: exact.city,
        district: exact.district,
        // never log exact lat/lng
      },
    });

    if (!exact.publicView) {
      throw new Error('LocationPublic missing after create');
    }

    return {
      exact: toExactDto(exact),
      public: toPublicDto(exact.publicView),
    };
  }

  async getExact(
    auth: AuthContext,
    id: string,
    requestId?: string,
  ): Promise<LocationExactDto> {
    const exact = await this.prisma.locationExact.findFirst({
      where: {
        id,
        ...(auth.roles.includes('ADMIN') ? {} : { ownerId: auth.user.id }),
      },
    });
    if (!exact) {
      throw new NotFoundException({
        code: 'LOCATION_NOT_FOUND',
        message: 'Location not found',
      });
    }
    assertOwnerOrAdmin(
      auth,
      exact.ownerId,
      'Not allowed to view exact location',
    );
    if (auth.user.id !== exact.ownerId) {
      await this.audit.record({
        actorId: auth.user.id,
        action: 'location.read_exact',
        targetType: 'LocationExact',
        targetId: exact.id,
        requestId,
      });
    }
    return toExactDto(exact);
  }

  async getPublic(
    auth: AuthContext | null,
    id: string,
  ): Promise<LocationPublicDto> {
    // Public read allowed for authenticated users; Phase 1 requires auth for API consistency.
    const pub = await this.prisma.locationPublic.findFirst({
      where: { OR: [{ id }, { exactId: id }] },
    });
    if (!pub) {
      throw new NotFoundException({
        code: 'LOCATION_NOT_FOUND',
        message: 'Location not found',
      });
    }
    void auth;
    return toPublicDto(pub);
  }

  canViewExact(auth: AuthContext, ownerId: string): boolean {
    return isOwner(auth, ownerId) || auth.roles.includes('ADMIN');
  }
}
