import type {
  CleanupReportDto,
  PublicCleanupReport,
} from '@greencity/shared';
import type { CleanupReport, MediaAsset } from '@prisma/client';
import { toMediaPublicDto } from '../marketplace/marketplace.mapper';

export function toCleanupReportDto(
  r: CleanupReport & { media: MediaAsset },
): CleanupReportDto {
  return {
    id: r.id,
    reporterId: r.reporterId,
    description: r.description,
    addressLine: r.addressLine,
    ward: r.ward,
    district: r.district,
    city: r.city,
    media: toMediaPublicDto(r.media),
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  };
}

export function toPublicCleanupReportDto(
  r: CleanupReport,
): PublicCleanupReport {
  return {
    id: r.id,
    description: r.description,
    city: r.city,
    district: r.district,
    photoPath: `/cleanup-reports/${r.id}/photo`,
    verifiedAt: r.verifiedAt!.toISOString(),
  };
}
