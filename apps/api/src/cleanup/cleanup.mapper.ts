import type { CleanupReportDto } from '@greencity/shared';
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
