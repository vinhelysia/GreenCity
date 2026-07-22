import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  CreateCleanupReportSchema,
  type CreateCleanupReport,
} from '@greencity/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentUser } from '../authz/current-user.decorator';
import type { AuthContext } from '../authz/auth-context';
import { CleanupService } from './cleanup.service';

@Controller('cleanup-reports')
export class CleanupController {
  constructor(private readonly cleanupService: CleanupService) {}

  @Post()
  async submit(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(CreateCleanupReportSchema))
    body: CreateCleanupReport,
  ) {
    return this.cleanupService.submit(auth, body);
  }

  @Get('mine')
  async mine(@CurrentUser() auth: AuthContext) {
    return this.cleanupService.mine(auth);
  }
}
