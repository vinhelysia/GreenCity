import { BadRequestException } from '@nestjs/common';
import {
  PaginationCursorSchema,
  type PaginationQuery,
} from '@greencity/shared';

export type DecodedPaginationCursor = {
  createdAt: Date;
  id: string;
};

export type PaginationParams = {
  limit: number;
  cursor?: DecodedPaginationCursor;
};

function invalidCursor(): never {
  throw new BadRequestException({
    code: 'VALIDATION_ERROR',
    message: 'Request validation failed',
  });
}

/** Decode only canonical tokens emitted by encodePaginationCursor. */
export function decodePaginationCursor(
  token: string,
): DecodedPaginationCursor {
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8');
    const payload = PaginationCursorSchema.safeParse(JSON.parse(raw));
    if (!payload.success) return invalidCursor();

    const createdAt = new Date(payload.data.createdAt);
    if (
      Number.isNaN(createdAt.getTime()) ||
      createdAt.toISOString() !== payload.data.createdAt ||
      Buffer.from(JSON.stringify(payload.data), 'utf8').toString('base64url') !== token
    ) {
      return invalidCursor();
    }
    return { createdAt, id: payload.data.id };
  } catch {
    return invalidCursor();
  }
}

export function encodePaginationCursor(cursor: DecodedPaginationCursor): string {
  const payload = PaginationCursorSchema.parse({
    createdAt: cursor.createdAt.toISOString(),
    id: cursor.id,
  });
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

/** Convert a validated HTTP query into the values services need. */
export function parsePaginationQuery(query: PaginationQuery): PaginationParams {
  return {
    limit: query.limit,
    ...(query.cursor ? { cursor: decodePaginationCursor(query.cursor) } : {}),
  };
}

/** The deterministic second half of a (createdAt DESC, id DESC) keyset query. */
export function paginationKeysetWhere(cursor: DecodedPaginationCursor) {
  return {
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ],
  };
}
