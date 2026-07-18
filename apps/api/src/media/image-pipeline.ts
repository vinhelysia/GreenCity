import { BadRequestException } from '@nestjs/common';
import {
  ALLOWED_IMAGE_MIME,
  MEDIA_MAX_BYTES,
  MEDIA_MAX_DIMENSION,
} from '@greencity/shared';
import sharp from 'sharp';

export interface ProcessedImage {
  buffer: Buffer;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  width: number;
  height: number;
  byteSize: number;
}

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const MIME_TO_ALLOWED_EXT: Record<string, readonly string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
};

const SHARP_OPTIONS = {
  failOn: 'error' as const,
  limitInputPixels: MEDIA_MAX_DIMENSION * MEDIA_MAX_DIMENSION,
};

export function extensionForMime(mime: string): string {
  return MIME_TO_EXT[mime] ?? 'bin';
}

/**
 * Validate magic bytes, size, dimensions; re-encode to strip EXIF/GPS.
 */
export async function processImageUpload(
  raw: Buffer,
  claimedMime?: string,
  originalName?: string,
): Promise<ProcessedImage> {
  if (!raw || raw.length === 0) {
    throw new BadRequestException({
      code: 'INVALID_UPLOAD',
      message: 'Empty upload',
    });
  }
  if (raw.length > MEDIA_MAX_BYTES) {
    throw new BadRequestException({
      code: 'FILE_TOO_LARGE',
      message: `File exceeds ${MEDIA_MAX_BYTES} bytes`,
    });
  }

  const { detectImageMime } = await import('./magic-bytes');
  const detectedMime = detectImageMime(raw);
  if (
    !detectedMime ||
    !(ALLOWED_IMAGE_MIME as readonly string[]).includes(detectedMime)
  ) {
    throw new BadRequestException({
      code: 'INVALID_IMAGE_TYPE',
      message: 'Only JPEG, PNG, and WebP images are allowed',
    });
  }

  // Content-Type spoof: claimed type must match magic bytes when provided.
  if (
    claimedMime &&
    claimedMime !== 'application/octet-stream' &&
    claimedMime !== detectedMime
  ) {
    throw new BadRequestException({
      code: 'MIME_MISMATCH',
      message: 'Content-Type does not match file contents',
    });
  }

  const contentType = detectedMime;

  const originalExt = /\.([^.]+)$/.exec(originalName ?? '')?.[1]?.toLowerCase();
  if (
    originalExt &&
    !MIME_TO_ALLOWED_EXT[contentType]?.includes(originalExt)
  ) {
    throw new BadRequestException({
      code: 'MIME_MISMATCH',
      message: 'Filename extension does not match file contents',
    });
  }
  try {
    const meta = await sharp(raw, SHARP_OPTIONS).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    if (width <= 0 || height <= 0) {
      throw new BadRequestException({
        code: 'INVALID_IMAGE',
        message: 'Could not read image dimensions',
      });
    }
    if (width > MEDIA_MAX_DIMENSION || height > MEDIA_MAX_DIMENSION) {
      throw new BadRequestException({
        code: 'IMAGE_TOO_LARGE',
        message: `Image dimensions exceed ${MEDIA_MAX_DIMENSION}px`,
      });
    }
    if ((meta.pages ?? 1) > 1) {
      throw new BadRequestException({
        code: 'ANIMATED_IMAGE_NOT_ALLOWED',
        message: 'Animated images are not allowed',
      });
    }

    let out: Buffer;
    if (contentType === 'image/png') {
      out = await sharp(raw, SHARP_OPTIONS).rotate().png().toBuffer();
    } else if (contentType === 'image/webp') {
      out = await sharp(raw, SHARP_OPTIONS)
        .rotate()
        .webp({ quality: 85 })
        .toBuffer();
    } else {
      out = await sharp(raw, SHARP_OPTIONS)
        .rotate()
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer();
    }

    const outMeta = await sharp(out).metadata();
    return {
      buffer: out,
      contentType,
      width: outMeta.width ?? width,
      height: outMeta.height ?? height,
      byteSize: out.length,
    };
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException({
      code: 'INVALID_IMAGE',
      message: 'Image is corrupt or unsupported',
    });
  }
}
