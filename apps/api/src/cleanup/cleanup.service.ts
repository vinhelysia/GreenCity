import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CleanupReportDto,
  CleanupReportList,
  CleanupReportStatus,
  CreateCleanupReport,
  PublicCleanupReportList,
} from '@greencity/shared';
import type { AuthContext } from '../authz/auth-context';
import { PointsService } from '../points/points.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from '../storage/storage.types';
import {
  toCleanupReportDto,
  toPublicCleanupReportDto,
} from './cleanup.mapper';

@Injectable()
export class CleanupService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly points: PointsService,
  ) {}

  async submit(
    auth: AuthContext,
    body: CreateCleanupReport,
  ): Promise<CleanupReportDto> {
    const media = await this.prisma.mediaAsset.findFirst({
      where: { id: body.mediaAssetId, ownerId: auth.user.id, deletedAt: null },
    });
    if (!media) {
      throw new NotFoundException({
        code: 'MEDIA_NOT_OWNED',
        message: 'Media asset not found',
      });
    }

    let created;
    try {
      created = await this.prisma.cleanupReport.create({
        data: {
          reporterId: auth.user.id,
          description: body.description,
          addressLine: body.addressLine ?? null,
          ward: body.ward ?? null,
          district: body.district ?? null,
          city: body.city ?? null,
          mediaAssetId: body.mediaAssetId,
          status: 'SUBMITTED',
        },
        include: { media: true },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'MEDIA_ALREADY_USED',
          message: 'Photo already used',
        });
      }
      throw err;
    }

    return toCleanupReportDto(created);
  }

  async mine(auth: AuthContext): Promise<CleanupReportList> {
    const rows = await this.prisma.cleanupReport.findMany({
      where: { reporterId: auth.user.id },
      include: { media: true },
      orderBy: { createdAt: 'desc' },
    });
    return { reports: rows.map(toCleanupReportDto) };
  }

  async listPublicVerified(): Promise<PublicCleanupReportList> {
    const rows = await this.prisma.cleanupReport.findMany({
      where: { status: 'VERIFIED' },
      orderBy: { verifiedAt: 'desc' },
      take: 12,
    });
    return { reports: rows.map(toPublicCleanupReportDto) };
  }

  async getPublicPhoto(
    id: string,
  ): Promise<{ contentType: string; body: Buffer }> {
    const report = await this.prisma.cleanupReport.findFirst({
      where: { id, status: 'VERIFIED' },
    });
    if (!report) {
      throw new NotFoundException({
        code: 'CLEANUP_REPORT_NOT_FOUND',
        message: 'Cleanup report not found',
      });
    }
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: report.mediaAssetId },
    });
    if (!asset || asset.deletedAt) {
      throw new NotFoundException({
        code: 'CLEANUP_REPORT_NOT_FOUND',
        message: 'Cleanup report not found',
      });
    }
    let body: Buffer;
    try {
      body = await this.storage.getObject(asset.objectKey);
    } catch {
      throw new NotFoundException({
        code: 'CLEANUP_REPORT_NOT_FOUND',
        message: 'Cleanup report not found',
      });
    }
    return { contentType: asset.contentType, body };
  }

  async adminList(status?: CleanupReportStatus): Promise<CleanupReportList> {
    const rows = await this.prisma.cleanupReport.findMany({
      where: status ? { status } : {},
      include: { media: true },
      orderBy: { createdAt: 'asc' },
    });
    return { reports: rows.map(toCleanupReportDto) };
  }

  async adminVerify(id: string): Promise<CleanupReportDto> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.cleanupReport.updateMany({
        where: { id, status: 'SUBMITTED' },
        data: { status: 'VERIFIED', verifiedAt: new Date() },
      });
      if (res.count === 0) {
        const existing = await tx.cleanupReport.findUnique({
          where: { id },
        });
        if (!existing) {
          throw new NotFoundException({
            code: 'CLEANUP_REPORT_NOT_FOUND',
            message: 'Cleanup report not found',
          });
        }
        throw new ConflictException({
          code: 'CLEANUP_REPORT_NOT_PENDING',
          message: 'Cleanup report is not pending',
        });
      }

      const report = await tx.cleanupReport.findUniqueOrThrow({
        where: { id },
        include: { media: true },
      });
      await this.points.awardCleanupVerified(tx, report);
      return report;
    });

    return toCleanupReportDto(updated);
  }

  async adminReject(id: string): Promise<CleanupReportDto> {
    const res = await this.prisma.cleanupReport.updateMany({
      where: { id, status: 'SUBMITTED' },
      data: { status: 'REJECTED' },
    });

    if (res.count === 0) {
      const existing = await this.prisma.cleanupReport.findUnique({
        where: { id },
      });
      if (!existing) {
        throw new NotFoundException({
          code: 'CLEANUP_REPORT_NOT_FOUND',
          message: 'Cleanup report not found',
        });
      }
      throw new ConflictException({
        code: 'CLEANUP_REPORT_NOT_PENDING',
        message: 'Cleanup report is not pending',
      });
    }

    const updated = await this.prisma.cleanupReport.findUniqueOrThrow({
      where: { id },
      include: { media: true },
    });
    return toCleanupReportDto(updated);
  }
}
