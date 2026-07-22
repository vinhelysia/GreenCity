import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import {
  CreateCleanupReportSchema,
  type CreateCleanupReport,
} from '@greencity/shared';
import type { Response } from 'express';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { Public } from '../authz/authenticated.guard';
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

  @Public()
  @Get('public')
  async listPublicVerified() {
    return this.cleanupService.listPublicVerified();
  }

  @Public()
  @Get(':id/photo')
  async photo(@Param('id') id: string, @Res() res: Response) {
    const { contentType, body } = await this.cleanupService.getPublicPhoto(id);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', String(body.length));
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(body);
  }
}
