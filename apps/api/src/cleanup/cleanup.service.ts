import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CleanupReportDto,
  CleanupReportList,
  CleanupReportStatus,
  CreateCleanupReport,
} from '@greencity/shared';
import type { AuthContext } from '../authz/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import { toCleanupReportDto } from './cleanup.mapper';

@Injectable()
export class CleanupService {
  constructor(private readonly prisma: PrismaService) {}

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

  async adminList(status?: CleanupReportStatus): Promise<CleanupReportList> {
    const rows = await this.prisma.cleanupReport.findMany({
      where: status ? { status } : {},
      include: { media: true },
      orderBy: { createdAt: 'asc' },
    });
    return { reports: rows.map(toCleanupReportDto) };
  }

  async adminVerify(id: string): Promise<CleanupReportDto> {
    const res = await this.prisma.cleanupReport.updateMany({
      where: { id, status: 'SUBMITTED' },
      data: { status: 'VERIFIED', verifiedAt: new Date() },
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
