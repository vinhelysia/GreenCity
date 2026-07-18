import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request, Response } from 'express';
import { MEDIA_MAX_BYTES } from '@greencity/shared';
import { getRequestId } from '../common/request-id';
import { CurrentUser } from '../authz/current-user.decorator';
import type { AuthContext } from '../authz/auth-context';
import { MediaService } from './media.service';

@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MEDIA_MAX_BYTES },
    }),
  )
  async upload(
    @CurrentUser() auth: AuthContext,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException({
        code: 'MISSING_FILE',
        message: 'Multipart field "file" is required',
      });
    }
    return this.media.upload(
      auth,
      {
        buffer: file.buffer,
        mimetype: file.mimetype,
        originalname: file.originalname,
      },
      getRequestId(req),
    );
  }

  @Get(':id')
  async meta(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.media.getMeta(auth, id, getRequestId(req));
  }

  @Get(':id/content')
  async content(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const { asset, body } = await this.media.getAuthorized(
      auth,
      id,
      getRequestId(req),
    );
    res.setHeader('Content-Type', asset.contentType);
    res.setHeader('Content-Length', String(body.length));
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(body);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    await this.media.softDelete(auth, id, getRequestId(req));
    return { ok: true };
  }
}
