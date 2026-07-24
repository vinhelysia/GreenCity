import {
  ConflictException,
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
    const processed = await processImageUpload(
      file.buffer,
      file.mimetype,
      file.originalname,
    );
    const idPart = randomBytes(16).toString('hex');
    const ext = extensionForMime(processed.contentType);
    const objectKey = `media/${auth.user.id}/${idPart}.${ext}`;

    await this.storage.putObject({
      key: objectKey,
      body: processed.buffer,
      contentType: processed.contentType,
    });

    const asset = await this.prisma.mediaAsset
      .create({
        data: {
          ownerId: auth.user.id,
          objectKey,
          contentType: processed.contentType,
          byteSize: processed.byteSize,
          width: processed.width,
          height: processed.height,
          originalName: file.originalname?.slice(0, 200) ?? null,
        },
      })
      .catch(async (error: unknown) => {
        try {
          await this.storage.deleteObject(objectKey);
        } catch (cleanupError) {
          throw new AggregateError(
            [error, cleanupError],
            'Failed to roll back stored upload after metadata failure',
          );
        }
        throw error;
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
    requestId?: string,
  ): Promise<{ asset: import('@prisma/client').MediaAsset; body: Buffer }> {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(auth.roles.includes('ADMIN') ? {} : { ownerId: auth.user.id }),
      },
    });
    if (!asset) {
      throw new NotFoundException({
        code: 'MEDIA_NOT_FOUND',
        message: 'Media not found',
      });
    }
    assertOwnerOrAdmin(auth, asset.ownerId, 'Not allowed to read this media');
    const body = await this.storage.getObject(asset.objectKey);
    if (auth.user.id !== asset.ownerId) {
      await this.audit.record({
        actorId: auth.user.id,
        action: 'media.read_content',
        targetType: 'MediaAsset',
        targetId: asset.id,
        requestId,
      });
    }
    return { asset, body };
  }

  async getMeta(
    auth: AuthContext,
    id: string,
    requestId?: string,
  ): Promise<MediaAssetPublic> {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(auth.roles.includes('ADMIN') ? {} : { ownerId: auth.user.id }),
      },
    });
    if (!asset) {
      throw new NotFoundException({
        code: 'MEDIA_NOT_FOUND',
        message: 'Media not found',
      });
    }
    assertOwnerOrAdmin(auth, asset.ownerId, 'Not allowed to read this media');
    if (auth.user.id !== asset.ownerId) {
      await this.audit.record({
        actorId: auth.user.id,
        action: 'media.read_metadata',
        targetType: 'MediaAsset',
        targetId: asset.id,
        requestId,
      });
    }
    return this.toPublic(asset);
  }

  async softDelete(
    auth: AuthContext,
    id: string,
    requestId?: string,
  ): Promise<void> {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(auth.roles.includes('ADMIN') ? {} : { ownerId: auth.user.id }),
      },
    });
    if (!asset) {
      throw new NotFoundException({
        code: 'MEDIA_NOT_FOUND',
        message: 'Media not found',
      });
    }
    assertOwnerOrAdmin(auth, asset.ownerId, 'Not allowed to delete this media');

    // A photo that backs a live listing or a cleanup report is not the
    // uploader's to remove: deleting it leaves a record pointing at nothing.
    const [listings, reports, requests] = await Promise.all([
      this.prisma.marketplaceListing.count({ where: { mediaAssetId: id } }),
      this.prisma.cleanupReport.count({ where: { mediaAssetId: id } }),
      this.prisma.scrapRequest.count({ where: { mediaAssetId: id } }),
    ]);
    if (listings + reports + requests > 0) {
      throw new ConflictException({
        code: 'MEDIA_IN_USE',
        message: 'Media is attached to a submission and cannot be deleted',
      });
    }

    // deletedAt is what stops the file being served, so the row is the source
    // of truth and is marked first. Deleting the object first inverts the
    // failure: storage succeeds, the update then fails, and a live record is
    // left pointing at a file that no longer exists — a permanently broken
    // image. This way the worst case is an unreferenced object still sitting
    // in the bucket, which costs bytes and nothing else.
    await this.prisma.mediaAsset.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    try {
      await this.storage.deleteObject(asset.objectKey);
    } catch {
      // The delete already took effect for every reader. Failing the request
      // now would tell the caller nothing happened, which is not true.
    }
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
