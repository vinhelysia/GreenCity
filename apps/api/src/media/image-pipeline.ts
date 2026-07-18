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

export function extensionForMime(mime: string): string {
  return MIME_TO_EXT[mime] ?? 'bin';
}

/**
 * Validate magic bytes, size, dimensions; re-encode to strip EXIF/GPS.
 */
export async function processImageUpload(
  raw: Buffer,
  claimedMime?: string,
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

  let pipeline = sharp(raw, { failOn: 'error' }).rotate(); // apply orientation, drop EXIF
  const meta = await pipeline.metadata();
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

  // Re-encode without metadata (EXIF/GPS stripped).
  let out: Buffer;
  if (contentType === 'image/png') {
    out = await sharp(raw).rotate().png().toBuffer();
  } else if (contentType === 'image/webp') {
    out = await sharp(raw).rotate().webp({ quality: 85 }).toBuffer();
  } else {
    out = await sharp(raw).rotate().jpeg({ quality: 85, mozjpeg: true }).toBuffer();
  }

  const outMeta = await sharp(out).metadata();
  return {
    buffer: out,
    contentType,
    width: outMeta.width ?? width,
    height: outMeta.height ?? height,
    byteSize: out.length,
  };
}
