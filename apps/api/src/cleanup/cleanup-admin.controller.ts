import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import {
  CleanupReportStatusSchema,
  type CleanupReportStatus,
} from '@greencity/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { Roles } from '../authz/roles.decorator';
import { RolesGuard } from '../authz/roles.guard';
import { CleanupService } from './cleanup.service';

const AdminCleanupReportQuerySchema = z.object({
  status: CleanupReportStatusSchema.optional(),
});

@Controller('admin/cleanup-reports')
@UseGuards(RolesGuard)
@Roles('ADMIN')
export class CleanupAdminController {
  constructor(private readonly cleanupService: CleanupService) {}

  @Get()
  async list(
    @Query(new ZodValidationPipe(AdminCleanupReportQuerySchema))
    query: { status?: CleanupReportStatus },
  ) {
    return this.cleanupService.adminList(query.status);
  }

  @Post(':id/verify')
  async verify(@Param('id') id: string) {
    return this.cleanupService.adminVerify(id);
  }

  @Post(':id/reject')
  async reject(@Param('id') id: string) {
    return this.cleanupService.adminReject(id);
  }
}
