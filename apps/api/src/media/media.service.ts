import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { MediaAssetPublic } from '@greencity/shared';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../authz/auth-context';
import { assertOwnerOrAdmin } from '../authz/ownership.policy';
import { PrismaService } from '../prisma/prisma.service';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from '../storage/storage.types';
import { extensionForMime, processImageUpload } from './image-pipeline';

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly audit: AuditService,
  ) {}

  async upload(
    auth: AuthContext,
    file: { buffer: Buffer; mimetype?: string; originalname?: string },
    requestId?: string,
  ): Promise<MediaAssetPublic> {
    const processed = await processImageUpload(file.buffer, file.mimetype);
    const idPart = randomBytes(16).toString('hex');
    const ext = extensionForMime(processed.contentType);
    const objectKey = `media/${auth.user.id}/${idPart}.${ext}`;

    await this.storage.putObject({
      key: objectKey,
      body: processed.buffer,
      contentType: processed.contentType,
    });

    const asset = await this.prisma.mediaAsset.create({
      data: {
        ownerId: auth.user.id,
        objectKey,
        contentType: processed.contentType,
        byteSize: processed.byteSize,
        width: processed.width,
        height: processed.height,
        originalName: file.originalname?.slice(0, 200) ?? null,
      },
    });

    await this.audit.record({
      actorId: auth.user.id,
      action: 'media.upload',
      targetType: 'MediaAsset',
      targetId: asset.id,
      requestId,
      metadata: {
        contentType: asset.contentType,
        byteSize: asset.byteSize,
      },
    });

    return this.toPublic(asset);
  }

  async getAuthorized(
    auth: AuthContext,
    id: string,
  ): Promise<{ asset: import('@prisma/client').MediaAsset; body: Buffer }> {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id, deletedAt: null },
    });
    if (!asset) {
      throw new NotFoundException({
        code: 'MEDIA_NOT_FOUND',
        message: 'Media not found',
      });
    }
    assertOwnerOrAdmin(auth, asset.ownerId, 'Not allowed to read this media');
    const body = await this.storage.getObject(asset.objectKey);
    return { asset, body };
  }

  async getMeta(auth: AuthContext, id: string): Promise<MediaAssetPublic> {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id, deletedAt: null },
    });
    if (!asset) {
      throw new NotFoundException({
        code: 'MEDIA_NOT_FOUND',
        message: 'Media not found',
      });
    }
    assertOwnerOrAdmin(auth, asset.ownerId, 'Not allowed to read this media');
    return this.toPublic(asset);
  }

  async softDelete(
    auth: AuthContext,
    id: string,
    requestId?: string,
  ): Promise<void> {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id, deletedAt: null },
    });
    if (!asset) {
      throw new NotFoundException({
        code: 'MEDIA_NOT_FOUND',
        message: 'Media not found',
      });
    }
    assertOwnerOrAdmin(auth, asset.ownerId, 'Not allowed to delete this media');
    await this.prisma.mediaAsset.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.storage.deleteObject(asset.objectKey).catch(() => undefined);
    await this.audit.record({
      actorId: auth.user.id,
      action: 'media.delete',
      targetType: 'MediaAsset',
      targetId: id,
      requestId,
    });
  }

  private toPublic(asset: {
    id: string;
    ownerId: string;
    contentType: string;
    byteSize: number;
    width: number | null;
    height: number | null;
    createdAt: Date;
  }): MediaAssetPublic {
    return {
      id: asset.id,
      ownerId: asset.ownerId,
      contentType: asset.contentType,
      byteSize: asset.byteSize,
      width: asset.width,
      height: asset.height,
      createdAt: asset.createdAt.toISOString(),
      downloadPath: `/media/${asset.id}/content`,
    };
  }
}
